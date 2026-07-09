/**
 * Offline Sync and Local Cache Interceptor for IRIS FABRICS
 * Automatically caches GET requests and queues POST/PUT/DELETE mutations when offline.
 * Optimistically updates local cache so that offline operations are immediately visible.
 */

import { Batch, StageKey, StageStatus } from "./types";

// Types
export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: number;
}

// Global state
let isOnline = navigator.onLine;
let isSyncing = false;
const ORIGINAL_FETCH = window.fetch;

// Helper to calculate stats from a list of batches
function calculateStats(batches: Batch[]) {
  const todayStr = new Date().toISOString().split("T")[0];
  
  const totalBatch = batches.length;
  const wetRunning = batches.filter((b) => b.stages && b.stages.wet === "running").length;
  
  const finishedToday = batches.filter((b) => {
    const isFinished = b.stages && (b.stages.rfd === "completed" || b.stages.delivered === "completed");
    if (!isFinished) return false;
    return b.updated_at && b.updated_at.split("T")[0] === todayStr;
  }).length;

  const deliveredToday = batches.filter((b) => b.delivery_date === todayStr).length;

  const rfdToday = batches.filter((b) => {
    return b.stages && b.stages.rfd === "completed" && b.updated_at && b.updated_at.split("T")[0] === todayStr;
  }).length;

  const shadePending = batches.filter((b) => b.stages && b.stages.finish === "completed" && b.shade_status === "pending").length;
  const shadeNotOk = batches.filter((b) => b.shade_status === "not_ok").length;
  const qualityPending = batches.filter((b) => b.stages && b.stages.finish === "completed" && b.quality_status === "pending").length;
  const qualityNotOk = batches.filter((b) => b.quality_status === "not_ok").length;
  const reprocess = batches.filter((b) => b.rework_count > 0).length;

  const trimsPending = batches.filter((b) => {
    const hasTrims = !!(b.trims && b.trims.trim() !== "" && b.trims.trim().toLowerCase() !== "n/a" && b.trims.trim().toLowerCase() !== "none");
    return hasTrims && b.body_delivered && !b.trims_delivered;
  }).length;

  return {
    totalBatch,
    wetRunning,
    finishedToday,
    deliveredToday,
    rfdToday,
    shadePending,
    shadeNotOk,
    qualityPending,
    qualityNotOk,
    reprocess,
    trimsPending
  };
}

// Local cache utilities
const getCache = (key: string) => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

const setCache = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Local storage write failed:", e);
  }
};

// Queue handling
export function getOfflineQueue(): QueuedRequest[] {
  return getCache("offline_write_queue") || [];
}

function saveOfflineQueue(queue: QueuedRequest[]) {
  setCache("offline_write_queue", queue);
  notifyStatus();
}

function pushToOfflineQueue(url: string, method: string, headers: Record<string, string>, body: string | null) {
  const queue = getOfflineQueue();
  const newItem: QueuedRequest = {
    id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    url,
    method,
    headers,
    body,
    timestamp: Date.now(),
  };
  queue.push(newItem);
  saveOfflineQueue(queue);
  return newItem;
}

// Notify components via CustomEvents
function notifyStatus() {
  const event = new CustomEvent("offline-sync-status", {
    detail: {
      onLine: isOnline,
      isSyncing,
      pendingCount: getOfflineQueue().length,
    },
  });
  window.dispatchEvent(event);
}

// Local filtering for GET fallback when offline
function localFilterBatches(batches: Batch[], urlObj: URL): Batch[] {
  let result = [...batches];
  const q = urlObj.searchParams.get("q")?.toLowerCase();
  const fabricType = urlObj.searchParams.get("fabric_type");
  const stage = urlObj.searchParams.get("stage") as StageKey | null;
  const status = urlObj.searchParams.get("status") as StageStatus | null;
  const shade = urlObj.searchParams.get("shade");
  const quality = urlObj.searchParams.get("quality");

  if (q) {
    result = result.filter(
      (b) =>
        b.batch_number.toLowerCase().includes(q) ||
        (b.buyer && b.buyer.toLowerCase().includes(q)) ||
        (b.buyer_reference && b.buyer_reference.toLowerCase().includes(q)) ||
        (b.order_number && b.order_number.toLowerCase().includes(q))
    );
  }
  if (fabricType) {
    result = result.filter(
      (b) =>
        String(b.fabric_type_id) === fabricType ||
        b.fabric_type_name?.toLowerCase() === fabricType.toLowerCase()
    );
  }
  if (stage && status) {
    result = result.filter((b) => b.stages && b.stages[stage] === status);
  }
  if (shade) {
    result = result.filter((b) => b.shade_status === shade);
  }
  if (quality) {
    result = result.filter((b) => b.quality_status === quality);
  }
  return result;
}

// Perform optimistic cache updates for batch writes
function performOptimisticUpdate(url: string, method: string, bodyStr: string | null) {
  try {
    let body: any = {};
    if (bodyStr) {
      body = JSON.parse(bodyStr);
    }

    const batchesCacheKey = "/api/batches";
    let batches: Batch[] = getCache(batchesCacheKey) || [];

    if (url.includes("/api/stages/update")) {
      const { batch_id, stage_key, status } = body;
      const bId = Number(batch_id);
      batches = batches.map((b) => {
        if (b.id === bId) {
          const updatedStages = { ...(b.stages || {}) } as Record<StageKey, StageStatus>;
          updatedStages[stage_key as StageKey] = status as StageStatus;
          
          // Re-evaluate delivered state
          const hasTrims = !!(b.trims && b.trims.trim() !== "" && b.trims.trim().toLowerCase() !== "n/a" && b.trims.trim().toLowerCase() !== "none");
          const bodyDelivered = b.body_delivered;
          const trimsDelivered = b.trims_delivered;
          let isFullyDelivered = false;
          if (hasTrims) {
            isFullyDelivered = !!(bodyDelivered && trimsDelivered);
          } else {
            isFullyDelivered = !!bodyDelivered;
          }
          if (isFullyDelivered) {
            updatedStages.delivered = "completed";
          }

          return {
            ...b,
            stages: updatedStages,
            updated_at: new Date().toISOString(),
          };
        }
        return b;
      });
    } else if (url.includes("/api/delivery/update")) {
      const { batch_id, delivery_date, delivery_qty, delivery_remarks, mark_delivered, body_delivered, trims_delivered } = body;
      const bId = Number(batch_id);
      batches = batches.map((b) => {
        if (b.id === bId) {
          const hasTrims = !!(b.trims && b.trims.trim() !== "" && b.trims.trim().toLowerCase() !== "n/a" && b.trims.trim().toLowerCase() !== "none");
          const bodyDel = body_delivered !== undefined ? body_delivered : !!mark_delivered;
          const trimsDel = trims_delivered !== undefined ? trims_delivered : (!!mark_delivered && !hasTrims);

          let isFullyDelivered = false;
          if (hasTrims) {
            isFullyDelivered = !!(bodyDel && trimsDel);
          } else {
            isFullyDelivered = !!bodyDel;
          }

          const updatedStages = { ...(b.stages || {}) } as Record<StageKey, StageStatus>;
          if (isFullyDelivered) {
            updatedStages.delivered = "completed";
            updatedStages.rfd = "completed";
          }

          return {
            ...b,
            delivery_date: isFullyDelivered ? (delivery_date || new Date().toISOString().split("T")[0]) : b.delivery_date,
            delivery_qty: delivery_qty || b.delivery_qty,
            delivery_remarks: delivery_remarks || b.delivery_remarks,
            body_delivered: bodyDel,
            trims_delivered: trimsDel,
            stages: updatedStages,
            updated_at: new Date().toISOString(),
          };
        }
        return b;
      });
    } else if (url.includes("/api/shade/update")) {
      const { batch_id, status, reason, custom_reason } = body;
      const bId = Number(batch_id);
      batches = batches.map((b) => {
        if (b.id === bId) {
          return {
            ...b,
            shade_status: status,
            shade_reason: reason,
            shade_custom_reason: custom_reason,
            updated_at: new Date().toISOString(),
          };
        }
        return b;
      });
    } else if (url.includes("/api/quality/update")) {
      const { batch_id, status, reason, custom_reason } = body;
      const bId = Number(batch_id);
      batches = batches.map((b) => {
        if (b.id === bId) {
          return {
            ...b,
            quality_status: status,
            quality_reason: reason,
            quality_custom_reason: custom_reason,
            updated_at: new Date().toISOString(),
          };
        }
        return b;
      });
    } else if (url.includes("/api/rework/update")) {
      const { batch_id, rework_type, reason, custom_reason, remarks } = body;
      const bId = Number(batch_id);
      batches = batches.map((b) => {
        if (b.id === bId) {
          const reworkCount = (b.rework_count || 0) + 1;
          return {
            ...b,
            rework_count: reworkCount,
            rework_type: rework_type,
            updated_at: new Date().toISOString(),
          };
        }
        return b;
      });
    } else if (url.includes("/api/batches") && method === "POST") {
      // Create new batch
      const newId = Date.now();
      const newBatch: Batch = {
        id: newId,
        buyer: body.buyer || "Unknown",
        buyer_reference: body.buyer_reference || "",
        batch_number: body.batch_number || `B-${newId}`,
        order_number: body.order_number || "",
        color: body.color || "",
        fabric_type_id: body.fabric_type_id ? Number(body.fabric_type_id) : null,
        fabric_quantity: body.fabric_quantity ? Number(body.fabric_quantity) : null,
        trims: body.trims || "",
        trims_quantity: body.trims_quantity || "",
        machine_number: body.machine_number || "",
        lot_number: body.lot_number || "",
        remarks: body.remarks || "",
        shade_status: "pending",
        shade_reason: null,
        shade_custom_reason: null,
        quality_status: "pending",
        quality_reason: null,
        quality_custom_reason: null,
        delivery_date: null,
        delivery_remarks: null,
        delivery_qty: null,
        body_delivered: false,
        trims_delivered: false,
        rework_count: 0,
        rework_type: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stages: {
          wet: "pending",
          dry: "pending",
          finish: "pending",
          shade: "pending",
          quality: "pending",
          rfd: "pending",
          delivered: "pending",
        },
      };
      batches.unshift(newBatch);
    } else if (url.match(/\/api\/batches\/\d+/) && method === "PUT") {
      // Edit batch
      const urlParts = url.split("/");
      const bId = Number(urlParts[urlParts.length - 1]);
      batches = batches.map((b) => {
        if (b.id === bId) {
          return {
            ...b,
            ...body,
            updated_at: new Date().toISOString(),
          };
        }
        return b;
      });
    } else if (url.match(/\/api\/batches\/\d+/) && method === "DELETE") {
      // Delete batch
      const urlParts = url.split("/");
      const bId = Number(urlParts[urlParts.length - 1]);
      batches = batches.filter((b) => b.id !== bId);
    }

    // Save back to local storage GET cache
    setCache(batchesCacheKey, batches);

    // Also update statistics cache!
    const updatedStats = calculateStats(batches);
    setCache("/api/dashboard/stats", updatedStats);

    // Dispatch reload event so active components refresh from the newly updated cache
    window.dispatchEvent(new CustomEvent("offline-data-updated"));
  } catch (err) {
    console.error("Failed to perform optimistic update:", err);
  }
}

// Periodic connection validation via real server ping
async function verifyConnection() {
  try {
    const res = await ORIGINAL_FETCH("/api/health", { method: "GET" });
    if (res.ok) {
      if (!isOnline) {
        isOnline = true;
        notifyStatus();
        triggerSync();
      }
    } else {
      if (isOnline) {
        isOnline = false;
        notifyStatus();
      }
    }
  } catch {
    if (isOnline) {
      isOnline = false;
      notifyStatus();
    }
  }
}

// Background loop for ping and synchronization
setInterval(verifyConnection, 15000);

// Auto-sync process queue
export async function triggerSync() {
  if (isSyncing || getOfflineQueue().length === 0) return;
  isSyncing = true;
  notifyStatus();

  const queue = getOfflineQueue();
  const successfulIds: string[] = [];

  for (const item of queue) {
    try {
      const headers = { ...item.headers };
      // Retrieve fresh token from storage if needed
      const token = localStorage.getItem("admin_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await ORIGINAL_FETCH(item.url, {
        method: item.method,
        headers,
        body: item.body,
      });

      if (res.ok) {
        successfulIds.push(item.id);
      } else {
        console.warn(`Failed to sync queued request: ${item.url}`, res.status);
        // If it is an authentication error, don't block everything forever, but pause retrying
        if (res.status === 401 || res.status === 403) {
          isSyncing = false;
          notifyStatus();
          return;
        }
      }
    } catch (err) {
      console.error(`Sync network error for ${item.url}:`, err);
      // Network failure, halt queue processing and keep remaining queue
      isSyncing = false;
      notifyStatus();
      return;
    }
  }

  // Remove successful syncs from queue
  const remaining = getOfflineQueue().filter((item) => !successfulIds.includes(item.id));
  saveOfflineQueue(remaining);

  isSyncing = false;
  notifyStatus();

  // If we processed everything successfully, refetch fresh data from server to align states
  if (successfulIds.length > 0) {
    window.dispatchEvent(new CustomEvent("offline-sync-completed"));
  }
}

// Window state event listeners
window.addEventListener("online", () => {
  isOnline = true;
  notifyStatus();
  triggerSync();
});

window.addEventListener("offline", () => {
  isOnline = false;
  notifyStatus();
});

// INTERCEPT WINDOW.FETCH SAFELY
const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method || "GET";

  // Only intercept API endpoints
  if (!urlStr.includes("/api/")) {
    return ORIGINAL_FETCH(input, init);
  }

  // Handle GET Requests
  if (method.toUpperCase() === "GET") {
    // If we are online, make real request first
    if (isOnline) {
      try {
        const res = await ORIGINAL_FETCH(input, init);
        if (res.ok) {
          // Clone response and cache its JSON payload
          const clone = res.clone();
          clone.json().then((data) => {
            // Strip out query params for standard base cache
            const urlObj = new URL(urlStr, window.location.origin);
            const basePath = urlObj.pathname;
            setCache(basePath, data);
            
            // Also cache exact URL for query precision
            setCache(urlStr, data);
          }).catch(() => {});
        }
        return res;
      } catch (err) {
        console.warn(`GET ${urlStr} failed. Serving from cache offline.`, err);
        isOnline = false;
        notifyStatus();
      }
    }

    // Serving from cache (Offline mode)
    const urlObj = new URL(urlStr, window.location.origin);
    const basePath = urlObj.pathname;
    
    // Attempt exact match first, then base path fallback
    let cachedData = getCache(urlStr) || getCache(basePath);

    // Dynamic filtering mock for batches list offline
    if (basePath === "/api/batches" && getCache("/api/batches")) {
      const allBatches = getCache("/api/batches") as Batch[];
      cachedData = localFilterBatches(allBatches, urlObj);
    }

    // Dynamic mock for single batch offline
    const batchIdMatch = basePath.match(/\/api\/batches\/(\d+)/);
    if (batchIdMatch && !cachedData && getCache("/api/batches")) {
      const bId = Number(batchIdMatch[1]);
      const allBatches = getCache("/api/batches") as Batch[];
      cachedData = allBatches.find((b) => b.id === bId) || null;
    }

    // Auth profile mock offline
    if (basePath === "/api/auth/me") {
      const token = localStorage.getItem("admin_token");
      const adminName = localStorage.getItem("admin_name") || "Administrator";
      if (token) {
        cachedData = { username: adminName };
      }
    }

    if (cachedData !== null) {
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        headers: { "Content-Type": "application/json", "x-offline-cache": "true" },
      });
    }

    // Cache miss and completely offline
    return new Response(JSON.stringify({ error: "Offline: cached resource not found" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Handle Write Mutation Requests (POST, PUT, DELETE)
  if (!isOnline) {
    // Save to queue
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = new Headers(init.headers);
      h.forEach((value, key) => {
        headers[key] = value;
      });
    }

    const bodyStr = typeof init?.body === "string" ? init.body : null;
    pushToOfflineQueue(urlStr, method, headers, bodyStr);

    // Trigger optimistic update locally immediately
    performOptimisticUpdate(urlStr, method, bodyStr);

    // Mock successful write response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Offline: changes saved locally and queued for auto-sync.",
        offline: true,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Online mutation: run normally
  try {
    const res = await ORIGINAL_FETCH(input, init);
    if (res.ok) {
      // Re-trigger GET refresh caches by calling them asynchronously
      setTimeout(() => {
        ORIGINAL_FETCH("/api/batches", {
          headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
        }).then((r) => r.json().then((data) => setCache("/api/batches", data))).catch(() => {});
        
        ORIGINAL_FETCH("/api/dashboard/stats", {
          headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
        }).then((r) => r.json().then((data) => setCache("/api/dashboard/stats", data))).catch(() => {});
      }, 500);
    }
    return res;
  } catch (err) {
    console.warn(`Mutation ${method} ${urlStr} failed. Queuing for sync later.`, err);
    isOnline = false;
    notifyStatus();

    // Fallback queue
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = new Headers(init.headers);
      h.forEach((value, key) => {
        headers[key] = value;
      });
    }
    const bodyStr = typeof init?.body === "string" ? init.body : null;
    pushToOfflineQueue(urlStr, method, headers, bodyStr);
    performOptimisticUpdate(urlStr, method, bodyStr);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Offline: connection lost. Saved locally.",
        offline: true,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

try {
  window.fetch = customFetch;
} catch (e) {
  console.warn("Direct window.fetch override failed. Using Object.defineProperty fallback.", e);
  try {
    Object.defineProperty(window, "fetch", {
      value: customFetch,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  } catch (err) {
    console.error("Critical: Could not intercept window.fetch", err);
  }
}
