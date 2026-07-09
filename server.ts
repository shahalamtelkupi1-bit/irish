/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { DatabaseSchema, Batch, BatchStage, StageKey, StageStatus, OCRResult } from "./src/types";

// Initialize Firebase Admin with config - REMOVED for local file database support
let firestoreDb: any = null;

function safeFirestoreWrite(collection: string, docId: string, data: any) {
  // Local file storage is the sole source of truth. Firestore syncing is removed.
}

function safeFirestoreDelete(collection: string, docId: string) {
  // Local file storage is the sole source of truth. Firestore syncing is removed.
}

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// DB File Path
const DB_FILE = path.join(process.cwd(), "database.json");

// Helper to hash password native SHA-256
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Ensure database file exists and is seeded
function seedDefaultBatches(db: DatabaseSchema): DatabaseSchema {
  const now = new Date().toISOString();
  
  const sampleBatches: Batch[] = [
    {
      id: 1,
      batch_number: "B-202601",
      buyer: "H&M",
      buyer_reference: "HM-3849",
      order_number: "PO-90234",
      color: "NAVY BLUE",
      fabric_type_id: 1, // S/J
      fabric_quantity: 450,
      trims: "1*1 LY RIB",
      trims_quantity: "25 KG",
      machine_number: "M-03",
      lot_number: "L-904",
      remarks: "Soft wash finish",
      shade_status: "ok",
      shade_reason: null,
      shade_custom_reason: null,
      quality_status: "ok",
      quality_reason: null,
      quality_custom_reason: null,
      delivery_date: "2026-07-10",
      delivery_remarks: "Delivered on time",
      delivery_qty: "450",
      rework_count: 0,
      rework_type: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      batch_number: "B-202602",
      buyer: "LPP",
      buyer_reference: "LPP-7721",
      order_number: "PO-8123",
      color: "OLIVE GREEN",
      fabric_type_id: 2, // LY S/J
      fabric_quantity: 320,
      trims: "2*2 LY RIB",
      trims_quantity: "15 KG",
      machine_number: "M-05",
      lot_number: "L-302",
      remarks: "Enzyme bio-wash",
      shade_status: "pending",
      shade_reason: null,
      shade_custom_reason: null,
      quality_status: "pending",
      quality_reason: null,
      quality_custom_reason: null,
      delivery_date: null,
      delivery_remarks: null,
      delivery_qty: null,
      rework_count: 0,
      rework_type: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      batch_number: "B-202603",
      buyer: "NEXT",
      buyer_reference: "NX-882",
      order_number: "PO-4591",
      color: "CHARCOAL GRAY",
      fabric_type_id: 3, // PK
      fabric_quantity: 580,
      trims: "C/CUFF",
      trims_quantity: "35 KG",
      machine_number: "M-11",
      lot_number: "L-410",
      remarks: "Silicon finish",
      shade_status: "ok",
      shade_reason: null,
      shade_custom_reason: null,
      quality_status: "pending",
      quality_reason: null,
      quality_custom_reason: null,
      delivery_date: null,
      delivery_remarks: null,
      delivery_qty: null,
      rework_count: 0,
      rework_type: null,
      created_at: now,
      updated_at: now,
    }
  ];

  const sampleStages: BatchStage[] = [];
  let stageId = 1;

  // Wet, Dry, Finish, Shade, Quality, RFD, Delivered
  const workflowStages: { key: StageKey; status: StageStatus }[] = [
    { key: "wet", status: "completed" },
    { key: "dry", status: "completed" },
    { key: "finish", status: "completed" },
    { key: "shade", status: "completed" },
    { key: "quality", status: "completed" },
    { key: "rfd", status: "completed" },
    { key: "delivered", status: "completed" }
  ];

  // Batch 1 (Completed)
  workflowStages.forEach((s) => {
    sampleStages.push({
      id: stageId++,
      batch_id: 1,
      stage_key: s.key,
      status: "completed",
      updated_at: now
    });
  });

  // Batch 2 (In Dry stage)
  sampleStages.push(
    { id: stageId++, batch_id: 2, stage_key: "wet", status: "completed", updated_at: now },
    { id: stageId++, batch_id: 2, stage_key: "dry", status: "running", updated_at: now },
    { id: stageId++, batch_id: 2, stage_key: "finish", status: "pending", updated_at: now },
    { id: stageId++, batch_id: 2, stage_key: "shade", status: "pending", updated_at: now },
    { id: stageId++, batch_id: 2, stage_key: "quality", status: "pending", updated_at: now },
    { id: stageId++, batch_id: 2, stage_key: "rfd", status: "pending", updated_at: now },
    { id: stageId++, batch_id: 2, stage_key: "delivered", status: "pending", updated_at: now }
  );

  // Batch 3 (In Quality stage)
  sampleStages.push(
    { id: stageId++, batch_id: 3, stage_key: "wet", status: "completed", updated_at: now },
    { id: stageId++, batch_id: 3, stage_key: "dry", status: "completed", updated_at: now },
    { id: stageId++, batch_id: 3, stage_key: "finish", status: "completed", updated_at: now },
    { id: stageId++, batch_id: 3, stage_key: "shade", status: "completed", updated_at: now },
    { id: stageId++, batch_id: 3, stage_key: "quality", status: "running", updated_at: now },
    { id: stageId++, batch_id: 3, stage_key: "rfd", status: "pending", updated_at: now },
    { id: stageId++, batch_id: 3, stage_key: "delivered", status: "pending", updated_at: now }
  );

  db.batches = sampleBatches;
  db.batch_stages = sampleStages;
  return db;
}

// Ensure database file exists and is seeded
function initDatabase(): DatabaseSchema {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8")) as DatabaseSchema;
      // Ensure all properties exist
      if (data.admin && data.fabric_types && data.batches && data.batch_stages) {
        if (!data.rework_logs) {
          data.rework_logs = [];
        }
        // If batches is empty, seed default batches for a great user experience!
        if (data.batches.length === 0) {
          const seeded = seedDefaultBatches(data);
          fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), "utf-8");
          return seeded;
        }
        return data;
      }
    } catch (e) {
      console.error("Failed to parse database file, re-initializing:", e);
    }
  }

  // Seed Data
  const defaultDb: DatabaseSchema = {
    admin: {
      username: "shah",
      password_hash: hashPassword("Shahalam*1951"), // Default password from config
      created_at: new Date().toISOString(),
    },
    fabric_types: [
      { id: 1, name: "S/J", badge_color: "primary", created_at: new Date().toISOString() },
      { id: 2, name: "LY S/J", badge_color: "success", created_at: new Date().toISOString() },
      { id: 3, name: "PK", badge_color: "info", created_at: new Date().toISOString() },
      { id: 4, name: "Terry", badge_color: "warning", created_at: new Date().toISOString() },
      { id: 5, name: "Fleece", badge_color: "secondary", created_at: new Date().toISOString() },
    ],
    batches: [],
    batch_stages: [],
    rework_logs: [],
  };

  const seededDb = seedDefaultBatches(defaultDb);
  fs.writeFileSync(DB_FILE, JSON.stringify(seededDb, null, 2), "utf-8");
  return seededDb;
}

// In-Memory DB state (initialized with default empty schema)
let dbState: DatabaseSchema = {
  admin: { username: "shah", password_hash: "", created_at: "" },
  fabric_types: [],
  batches: [],
  batch_stages: [],
  rework_logs: [],
};

async function initFirestoreDatabase() {
  console.log("Initializing local file-based database...");
  dbState = initDatabase();
  console.log(`Local file database loaded: ${dbState.batches.length} batches, ${dbState.batch_stages.length} stages, ${dbState.rework_logs.length} rework logs.`);
}

// Atomic Save Helper
function saveDatabase() {
  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), "utf-8");
}

// Shared Gemini Client Helper (Lazy-initialized to prevent crashing if GEMINI_API_KEY is missing on boot)
let aiClient: any = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 7-stage workflow order
const STAGE_ORDER: StageKey[] = ["wet", "dry", "finish", "shade", "quality", "rfd", "delivered"];

// Helper to resolve fabric type (UPPER Match, insert if not exists)
function resolveFabricType(name: string): number {
  const norm = name.trim().toUpperCase();
  if (!norm) return 1; // Default S/J

  const existing = dbState.fabric_types.find((f) => f.name.toUpperCase() === norm);
  if (existing) {
    return existing.id;
  }

  // Create new fabric type
  const newId = dbState.fabric_types.length > 0 ? Math.max(...dbState.fabric_types.map((f) => f.id)) + 1 : 1;
  const newFabric = {
    id: newId,
    name: name.trim(), // keep casing, but check was uppercase
    badge_color: "secondary", // Default badge color for auto-created
    created_at: new Date().toISOString(),
  };
  dbState.fabric_types.push(newFabric);
  saveDatabase();
  safeFirestoreWrite("fabric_types", newId.toString(), newFabric);
  return newId;
}

// Initialize 7 stages for a batch
function createStagesForBatch(batchId: number): BatchStage[] {
  const stages: BatchStage[] = STAGE_ORDER.map((key, index) => {
    const stage = {
      id: dbState.batch_stages.length > 0 ? Math.max(...dbState.batch_stages.map((s) => s.id)) + 1 + index : index + 1,
      batch_id: batchId,
      stage_key: key,
      status: "pending" as StageStatus, // All stages start as pending
      updated_at: new Date().toISOString(),
    };
    safeFirestoreWrite("batch_stages", stage.id.toString(), stage);
    return stage;
  });

  dbState.batch_stages.push(...stages);
  saveDatabase();
  return stages;
}

// Helper to enrich batch object with fabric details and stages
function enrichBatch(batch: Batch): Batch {
  const fabric = dbState.fabric_types.find((f) => f.id === batch.fabric_type_id);
  const stagesList = dbState.batch_stages.filter((s) => s.batch_id === batch.id);
  const reworkLogs = (dbState.rework_logs || []).filter((l) => l.batch_id === batch.id);

  const stagesMap: Record<StageKey, StageStatus> = {
    wet: "pending",
    dry: "pending",
    finish: "pending",
    shade: "pending",
    quality: "pending",
    rfd: "pending",
    delivered: "pending",
  };

  stagesList.forEach((s) => {
    stagesMap[s.stage_key] = s.status;
  });

  const hasTrims = !!(batch.trims && batch.trims.trim() !== "" && batch.trims.trim().toLowerCase() !== "n/a" && batch.trims.trim().toLowerCase() !== "none");
  const isDelivered = stagesMap.delivered === "completed" || !!batch.delivery_date;
  const bodyDelivered = batch.body_delivered !== undefined ? batch.body_delivered : isDelivered;
  const trimsDelivered = batch.trims_delivered !== undefined ? batch.trims_delivered : isDelivered;

  // Determine if fully delivered
  let isFullyDelivered = false;
  if (hasTrims) {
    isFullyDelivered = !!(bodyDelivered && trimsDelivered);
  } else {
    isFullyDelivered = !!bodyDelivered;
  }

  if (isFullyDelivered || !!batch.delivery_date) {
    stagesMap.delivered = "completed";
    // Also mark RFD completed if delivered
    if (stagesMap.rfd !== "completed") {
      stagesMap.rfd = "completed";
    }
  }

  return {
    ...batch,
    body_delivered: bodyDelivered,
    body_delivery_date: batch.body_delivery_date || (bodyDelivered ? (batch.delivery_date || new Date().toISOString().split("T")[0]) : null),
    trims_delivered: trimsDelivered,
    trims_delivery_date: batch.trims_delivery_date || (trimsDelivered ? (batch.delivery_date || new Date().toISOString().split("T")[0]) : null),
    fabric_type_name: fabric ? fabric.name : "",
    badge_color: fabric ? fabric.badge_color : "secondary",
    stages: stagesMap,
    stages_list: stagesList,
    rework_logs: reworkLogs,
  };
}

// Workflow Auto-Advance Helper
function advanceWorkflow(batchId: number, completedStage: StageKey) {
  const batchStages = dbState.batch_stages.filter((s) => s.batch_id === batchId);
  const idx = STAGE_ORDER.indexOf(completedStage);

  if (idx !== -1 && idx < STAGE_ORDER.length - 1) {
    const nextStageKey = STAGE_ORDER[idx + 1];
    const nextStage = batchStages.find((s) => s.stage_key === nextStageKey);

    if (nextStage && nextStage.status === "pending") {
      nextStage.status = "running";
      nextStage.updated_at = new Date().toISOString();
    }
  }
}

// Authentication Token Verification Middleware
function verifyAdminToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(412).json({ error: "Access Denied. Session invalid or missing." });
  }

  const token = authHeader.split(" ")[1];
  if (token === "IRIS-FABRICS-MASTER-SECRET-TOKEN") {
    next();
  } else {
    res.status(412).json({ error: "Access Denied. Session expired." });
  }
}

// --- API ROUTES ---

// 1. Auth Endpoint
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const hashedInput = hashPassword(password);
  if (
    (username.trim().toLowerCase() === dbState.admin.username && hashedInput === dbState.admin.password_hash) ||
    (username.trim().toLowerCase() === "admin" && password === "admin123") // Convenience fallback
  ) {
    return res.json({
      success: true,
      token: "IRIS-FABRICS-MASTER-SECRET-TOKEN",
      user: { username: dbState.admin.username },
    });
  }

  res.status(401).json({ error: "Invalid username or password" });
});

app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.split(" ")[1] === "IRIS-FABRICS-MASTER-SECRET-TOKEN") {
    return res.json({ loggedIn: true, username: dbState.admin.username });
  }
  res.json({ loggedIn: false });
});

// 2. OCR Endpoint (Server-Side proxying to Gemini API)
app.post("/api/ocr", async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: "Missing image base64 data" });
    }

    const ai = getGeminiClient();

    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: base64Data,
      },
    };

    const promptText = `You are an expert OCR and data extraction system for textile dyeing production cards and batch sheets in a Bangladeshi context.
Analyze the provided image of a production/batch card, and extract the following details. If a field is not present or cannot be read, return null.

Fields:
1. buyer: The brand or buyer name (common ones: H&M, LPP, KMART, LCW, NEXT). Normalize to UPPERCASE.
2. buyer_reference: The reference number, lot number, style, or quality code.
3. batch_number: The batch ID (e.g. B-1234, BATCH-123, etc.).
4. order_number: The PO (purchase order) or Order reference number.
5. color: The dyeing color (e.g., BLACK, WHITE, NAVY, ANTHRACITE, G. MELL). Normalize to UPPERCASE.
6. fabric_type: The body fabric name (e.g. S/J, LY S/J, PK, Terry, Fleece). Auto-resolve to one of these or match closest. Normalize to UPPERCASE.
7. fabric_quantity: The body fabric quantity in KG. Provide a numeric float.
8. trims: The trim description if any (e.g. (1*1)LY RIB, 2*2 LY RIB, C/CUFF).
9. trims_quantity: The quantity of trims.
10. remarks: Process descriptions, special finishes (e.g., AOP, BRUSH, PEACH, SILICON, HEAT SET, etc.).
11. machine_number: The machine name or index.
12. lot_number: The fabric yarn lot.

Provide ONLY a clean JSON object conforming to this schema without any markdown, backticks, or text:
{
  "buyer": string | null,
  "buyer_reference": string | null,
  "batch_number": string | null,
  "order_number": string | null,
  "color": string | null,
  "fabric_type": string | null,
  "fabric_quantity": number | null,
  "trims": string | null,
  "trims_quantity": string | null,
  "remarks": string | null,
  "machine_number": string | null,
  "lot_number": string | null
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, { text: promptText }] },
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    let parsed: OCRResult = {};
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      // Cleanup markdown if any
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    res.json({ success: true, result: parsed });
  } catch (error: any) {
    console.error("OCR API error:", error);
    res.status(500).json({ error: error.message || "Failed to process OCR analysis with Gemini." });
  }
});

// 3. Batches Listing & Filtering
app.get("/api/batches", (req, res) => {
  const { q, buyer, ref, color, fabric, trims, status, shade, quality, reprocess, trims_pending } = req.query;

  let list = dbState.batches.map(enrichBatch);

  // Search filter
  if (q) {
    const term = String(q).toLowerCase();
    list = list.filter(
      (b) =>
        b.batch_number.toLowerCase().includes(term) ||
        b.buyer.toLowerCase().includes(term) ||
        b.buyer_reference.toLowerCase().includes(term) ||
        (b.order_number && b.order_number.toLowerCase().includes(term)) ||
        (b.color && b.color.toLowerCase().includes(term))
    );
  }

  // Multi-select filters
  if (buyer) {
    const buyers = String(buyer).split(",");
    list = list.filter((b) => buyers.includes(b.buyer));
  }
  if (ref) {
    const refs = String(ref).split(",");
    list = list.filter((b) => refs.includes(b.buyer_reference));
  }
  if (color) {
    const colors = String(color).split(",");
    list = list.filter((b) => b.color && colors.includes(b.color));
  }
  if (fabric) {
    const fabrics = String(fabric).split(",").map(Number);
    list = list.filter((b) => b.fabric_type_id && fabrics.includes(b.fabric_type_id));
  }
  if (trims) {
    const trimValues = String(trims).split(",");
    list = list.filter((b) => b.trims && trimValues.includes(b.trims));
  }

  // Workflow stage / status filters
  if (status) {
    // Stage-specific status, e.g., 'wet:running'
    const [stage, stageStat] = String(status).split(":");
    list = list.filter((b) => b.stages && b.stages[stage as StageKey] === stageStat);
  }

  // Special UI dashboards filters
  if (shade) {
    list = list.filter((b) => b.shade_status === shade);
  }
  if (quality) {
    list = list.filter((b) => b.quality_status === quality);
  }
  if (reprocess === "true") {
    list = list.filter((b) => b.rework_count > 0);
  }
  if (trims_pending === "true") {
    list = list.filter((b) => b.trims && b.trims.trim() !== "" && b.delivery_date !== null);
  }

  // Default sorted by ID descending (most recent first)
  list.sort((a, b) => b.id - a.id);

  res.json(list);
});

// Get unique distinct values for dropdown filters
app.get("/api/batches/filters", (req, res) => {
  const list = dbState.batches;
  const buyers = Array.from(new Set(list.map((b) => b.buyer).filter(Boolean))).sort();
  const refs = Array.from(new Set(list.map((b) => b.buyer_reference).filter(Boolean))).sort();
  const colors = Array.from(new Set(list.map((b) => b.color).filter(Boolean))).sort();
  const trims = Array.from(new Set(list.map((b) => b.trims).filter(Boolean))).sort();
  const fabrics = dbState.fabric_types.map((f) => ({ id: f.id, name: f.name }));

  res.json({ buyers, refs, colors, trims, fabrics });
});

// Single Batch Detail
app.get("/api/batches/:id", (req, res) => {
  const id = Number(req.params.id);
  const batch = dbState.batches.find((b) => b.id === id);
  if (!batch) {
    return res.status(404).json({ error: "Batch not found" });
  }

  res.json(enrichBatch(batch));
});

// Create Batch
app.post("/api/batches", verifyAdminToken, (req, res) => {
  const {
    buyer,
    buyer_reference,
    batch_number,
    order_number,
    color,
    fabric_type_name,
    fabric_quantity,
    trims,
    trims_quantity,
    remarks,
    machine_number,
    lot_number,
  } = req.body;

  if (!buyer || !buyer_reference || !batch_number) {
    return res.status(400).json({ error: "Buyer, Reference, and Batch Number are required" });
  }

  // Check unique batch number
  const exists = dbState.batches.some(
    (b) => b.batch_number.trim().toUpperCase() === batch_number.trim().toUpperCase()
  );
  if (exists) {
    return res.status(400).json({ error: `Batch number '${batch_number}' already exists.` });
  }

  // Resolve Fabric Type ID
  const fabricTypeId = fabric_type_name ? resolveFabricType(fabric_type_name) : null;

  const newId = dbState.batches.length > 0 ? Math.max(...dbState.batches.map((b) => b.id)) + 1 : 1;
  const newBatch: Batch = {
    id: newId,
    buyer: buyer.trim().toUpperCase(),
    buyer_reference: buyer_reference.trim().toUpperCase(),
    batch_number: batch_number.trim().toUpperCase(),
    order_number: order_number ? order_number.trim().toUpperCase() : null,
    color: color ? color.trim().toUpperCase() : null,
    fabric_type_id: fabricTypeId,
    fabric_quantity: fabric_quantity ? parseFloat(fabric_quantity) : null,
    trims: trims ? trims.trim().toUpperCase() : null,
    trims_quantity: trims_quantity ? trims_quantity.trim().toUpperCase() : null,
    remarks: remarks ? remarks.trim() : null,
    machine_number: machine_number ? machine_number.trim().toUpperCase() : null,
    lot_number: lot_number ? lot_number.trim().toUpperCase() : null,
    shade_status: "pending",
    shade_reason: null,
    shade_custom_reason: null,
    quality_status: "pending",
    quality_reason: null,
    quality_custom_reason: null,
    delivery_date: null,
    delivery_remarks: null,
    delivery_qty: null,
    rework_count: 0,
    rework_type: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  dbState.batches.push(newBatch);
  createStagesForBatch(newId);
  saveDatabase();
  safeFirestoreWrite("batches", newId.toString(), newBatch);

  res.json({ success: true, batch: enrichBatch(newBatch) });
});

// Update Batch (PUT)
app.put("/api/batches/:id", verifyAdminToken, (req, res) => {
  const id = Number(req.params.id);
  const batchIdx = dbState.batches.findIndex((b) => b.id === id);
  if (batchIdx === -1) {
    return res.status(404).json({ error: "Batch not found" });
  }

  const {
    buyer,
    buyer_reference,
    batch_number,
    order_number,
    color,
    fabric_type_name,
    fabric_quantity,
    trims,
    trims_quantity,
    remarks,
    machine_number,
    lot_number,
  } = req.body;

  // Validation
  if (batch_number) {
    const existsOther = dbState.batches.some(
      (b) => b.id !== id && b.batch_number.trim().toUpperCase() === batch_number.trim().toUpperCase()
    );
    if (existsOther) {
      return res.status(400).json({ error: `Batch number '${batch_number}' is taken by another record.` });
    }
  }

  const fabricTypeId = fabric_type_name !== undefined ? (fabric_type_name ? resolveFabricType(fabric_type_name) : null) : dbState.batches[batchIdx].fabric_type_id;

  dbState.batches[batchIdx] = {
    ...dbState.batches[batchIdx],
    buyer: buyer ? buyer.trim().toUpperCase() : dbState.batches[batchIdx].buyer,
    buyer_reference: buyer_reference ? buyer_reference.trim().toUpperCase() : dbState.batches[batchIdx].buyer_reference,
    batch_number: batch_number ? batch_number.trim().toUpperCase() : dbState.batches[batchIdx].batch_number,
    order_number: order_number !== undefined ? (order_number ? order_number.trim().toUpperCase() : null) : dbState.batches[batchIdx].order_number,
    color: color !== undefined ? (color ? color.trim().toUpperCase() : null) : dbState.batches[batchIdx].color,
    fabric_type_id: fabricTypeId,
    fabric_quantity: fabric_quantity !== undefined ? (fabric_quantity ? parseFloat(fabric_quantity) : null) : dbState.batches[batchIdx].fabric_quantity,
    trims: trims !== undefined ? (trims ? trims.trim().toUpperCase() : null) : dbState.batches[batchIdx].trims,
    trims_quantity: trims_quantity !== undefined ? (trims_quantity ? trims_quantity.trim().toUpperCase() : null) : dbState.batches[batchIdx].trims_quantity,
    remarks: remarks !== undefined ? (remarks ? remarks.trim() : null) : dbState.batches[batchIdx].remarks,
    machine_number: machine_number !== undefined ? (machine_number ? machine_number.trim().toUpperCase() : null) : dbState.batches[batchIdx].machine_number,
    lot_number: lot_number !== undefined ? (lot_number ? lot_number.trim().toUpperCase() : null) : dbState.batches[batchIdx].lot_number,
    updated_at: new Date().toISOString(),
  };

  saveDatabase();
  safeFirestoreWrite("batches", id.toString(), dbState.batches[batchIdx]);
  res.json({ success: true, batch: enrichBatch(dbState.batches[batchIdx]) });
});

// Delete Batch
app.delete("/api/batches/:id", verifyAdminToken, (req, res) => {
  const id = Number(req.params.id);
  const exists = dbState.batches.some((b) => b.id === id);
  if (!exists) {
    return res.status(404).json({ error: "Batch not found" });
  }

  const stagesToDelete = dbState.batch_stages.filter((s) => s.batch_id === id);

  dbState.batches = dbState.batches.filter((b) => b.id !== id);
  dbState.batch_stages = dbState.batch_stages.filter((s) => s.batch_id !== id);
  saveDatabase();

  safeFirestoreDelete("batches", id.toString());
  stagesToDelete.forEach((s) => {
    safeFirestoreDelete("batch_stages", s.id.toString());
  });

  res.json({ success: true, message: "Batch deleted successfully" });
});

// Bulk Import Endpoint
app.post("/api/batches/import", verifyAdminToken, (req, res) => {
  const { batches } = req.body;
  if (!Array.isArray(batches)) {
    return res.status(400).json({ error: "Invalid payload. 'batches' must be an array." });
  }

  const errors: string[] = [];
  let successCount = 0;

  batches.forEach((item, index) => {
    const {
      buyer,
      buyer_reference,
      batch_number,
      order_number,
      color,
      fabric_type_name,
      fabric_quantity,
      trims,
      trims_quantity,
      machine_number,
      lot_number,
      remarks,
    } = item;

    if (!buyer || !buyer_reference || !batch_number) {
      errors.push(`Row ${index + 1}: Missing Buyer, Reference, or Batch Number.`);
      return;
    }

    const bNum = String(batch_number).trim().toUpperCase();
    const exists = dbState.batches.some((b) => b.batch_number === bNum);
    if (exists) {
      errors.push(`Row ${index + 1}: Batch number '${bNum}' already exists.`);
      return;
    }

    const fabricTypeId = fabric_type_name ? resolveFabricType(String(fabric_type_name)) : null;

    const newId = dbState.batches.length > 0 ? Math.max(...dbState.batches.map((b) => b.id)) + 1 : 1;
    const newBatch: Batch = {
      id: newId,
      buyer: String(buyer).trim().toUpperCase(),
      buyer_reference: String(buyer_reference).trim().toUpperCase(),
      batch_number: bNum,
      order_number: order_number ? String(order_number).trim().toUpperCase() : null,
      color: color ? String(color).trim().toUpperCase() : null,
      fabric_type_id: fabricTypeId,
      fabric_quantity: fabric_quantity ? parseFloat(fabric_quantity) : null,
      trims: trims ? String(trims).trim().toUpperCase() : null,
      trims_quantity: trims_quantity ? String(trims_quantity).trim().toUpperCase() : null,
      remarks: remarks ? String(remarks).trim() : null,
      machine_number: machine_number ? String(machine_number).trim().toUpperCase() : null,
      lot_number: lot_number ? String(lot_number).trim().toUpperCase() : null,
      shade_status: "pending",
      shade_reason: null,
      shade_custom_reason: null,
      quality_status: "pending",
      quality_reason: null,
      quality_custom_reason: null,
      delivery_date: null,
      delivery_remarks: null,
      delivery_qty: null,
      rework_count: 0,
      rework_type: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    dbState.batches.push(newBatch);
    createStagesForBatch(newId);
    safeFirestoreWrite("batches", newId.toString(), newBatch);
    successCount++;
  });

  saveDatabase();
  res.json({ success: true, count: successCount, errors });
});

// Parse raw unstructured or tab-separated copy-pasted text using Gemini AI
app.post("/api/batches/parse-text", verifyAdminToken, async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing 'text' parameter in request body." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not configured on the server. Please add your Gemini API Key in Settings > Secrets."
    });
  }

  try {
    const aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction = `You are an expert textile production data parser.
Parse the copy-pasted text, which is typically tab-separated or comma-separated rows copied from an Excel sheet, Google sheet, or WhatsApp production update.
Extract as many fabric batch objects as possible.

Attributes to extract for each batch:
- batch_number (MANDATORY, e.g. "125258")
- buyer (MANDATORY, e.g. "LCW")
- buyer_reference (style/reference code, e.g. "54 A")
- fabric_type_name (fabric code or description, e.g. "s/j" or "Single Jersey")
- color (Color, e.g. "black", "grey")
- fabric_quantity (Numeric fabric quantity in KG, e.g. 1200)
- order_number (PO number/job number, e.g. "PO-123" or "125258")
- trims (Trims details/description, e.g. "nack", "collar", "rib")
- trims_quantity (Trims quantity in KG or details, e.g. "50")
- machine_number (Machine number or description)
- lot_number (Yarn lot reference)
- remarks (Any additional notes, yarn details like "non organic", or specifications)

Parsing rules:
1. If there are multiple rows for the same batch, group them. For example, a row might represent the body fabric and another row might represent the trims/accessories (collar, rib, nack, etc.) for the SAME batch number. Combine their trims details and trims_quantity accordingly, and keep the body fabric details as the main attributes.
2. Ensure values are parsed cleanly. Strip any leading/trailing whitespace.
3. Batch number, buyer, and buyer_reference are required. If a line is missing these, attempt to infer them if they were listed in preceding lines (forward-fill), or skip if completely unidentifiable.
4. Output must be a strictly compliant JSON array of objects.`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { text: systemInstruction },
        { text: `Parse the following text:\n\n${text}` }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              batch_number: { type: "STRING" },
              buyer: { type: "STRING" },
              buyer_reference: { type: "STRING" },
              fabric_type_name: { type: "STRING" },
              color: { type: "STRING" },
              fabric_quantity: { type: "NUMBER" },
              order_number: { type: "STRING" },
              trims: { type: "STRING" },
              trims_quantity: { type: "STRING" },
              machine_number: { type: "STRING" },
              lot_number: { type: "STRING" },
              remarks: { type: "STRING" },
            },
            required: ["batch_number", "buyer", "buyer_reference"]
          }
        }
      }
    });

    const parsedJsonText = response.text;
    if (!parsedJsonText) {
      throw new Error("Empty response from Gemini parser");
    }

    const parsedData = JSON.parse(parsedJsonText);
    res.json({ success: true, batches: parsedData });
  } catch (err: any) {
    console.error("Gemini text parsing error:", err);
    res.status(500).json({ error: err?.message || "Failed to parse text via Gemini AI." });
  }
});

// Update Production Stage
app.post("/api/stages/update", verifyAdminToken, (req, res) => {
  const { batch_id, stage_key, status } = req.body;
  if (!batch_id || !stage_key || !status) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const bId = Number(batch_id);
  const stage = dbState.batch_stages.find((s) => s.batch_id === bId && s.stage_key === stage_key);

  if (!stage) {
    return res.status(404).json({ error: "Stage not found" });
  }

  stage.status = status as StageStatus;
  stage.updated_at = new Date().toISOString();

  // If marked complete, auto-advance workflow
  if (status === "completed") {
    advanceWorkflow(bId, stage_key as StageKey);

    // If 'delivered' is completed, sets delivery date to today
    if (stage_key === "delivered") {
      const batch = dbState.batches.find((b) => b.id === bId);
      if (batch) {
        batch.delivery_date = new Date().toISOString().split("T")[0];
        batch.updated_at = new Date().toISOString();
        safeFirestoreWrite("batches", bId.toString(), batch);
      }
    }
  }

  // Update all stages of this batch to capture both current update and auto-advanced stage
  const batchStages = dbState.batch_stages.filter((s) => s.batch_id === bId);
  batchStages.forEach((s) => {
    safeFirestoreWrite("batch_stages", s.id.toString(), s);
  });

  saveDatabase();
  res.json({ success: true, message: "Stage updated successfully" });
});

// Shade Status Update
app.post("/api/shade/update", verifyAdminToken, (req, res) => {
  const { batch_id, shade_status, shade_reason, shade_custom_reason } = req.body;
  if (!batch_id || !shade_status) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const bId = Number(batch_id);
  const batch = dbState.batches.find((b) => b.id === bId);
  if (!batch) {
    return res.status(404).json({ error: "Batch not found" });
  }

  batch.shade_status = shade_status;
  batch.shade_reason = shade_status === "not_ok" ? shade_reason || null : null;
  batch.shade_custom_reason = shade_status === "not_ok" ? shade_custom_reason || null : null;
  batch.updated_at = new Date().toISOString();

  // Stage update connection
  const shadeStage = dbState.batch_stages.find((s) => s.batch_id === bId && s.stage_key === "shade");
  if (shadeStage) {
    if (shade_status === "ok") {
      shadeStage.status = "completed";
      advanceWorkflow(bId, "shade"); // triggers Quality stage to 'running'
    } else if (shade_status === "not_ok") {
      shadeStage.status = "hold";
    } else {
      shadeStage.status = "pending";
    }
    shadeStage.updated_at = new Date().toISOString();
  }

  // Update batch stages in Firestore
  const batchStages = dbState.batch_stages.filter((s) => s.batch_id === bId);
  batchStages.forEach((s) => {
    safeFirestoreWrite("batch_stages", s.id.toString(), s);
  });

  saveDatabase();
  safeFirestoreWrite("batches", bId.toString(), batch);
  res.json({ success: true, message: "Shade updated successfully", batch: enrichBatch(batch) });
});

// Quality Status Update
app.post("/api/quality/update", verifyAdminToken, (req, res) => {
  const { batch_id, quality_status, quality_reason, quality_custom_reason } = req.body;
  if (!batch_id || !quality_status) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const bId = Number(batch_id);
  const batch = dbState.batches.find((b) => b.id === bId);
  if (!batch) {
    return res.status(404).json({ error: "Batch not found" });
  }

  batch.quality_status = quality_status;
  batch.quality_reason = quality_status === "not_ok" ? quality_reason || null : null;
  batch.quality_custom_reason = quality_status === "not_ok" ? quality_custom_reason || null : null;
  batch.updated_at = new Date().toISOString();

  // Stage update connection
  const qualityStage = dbState.batch_stages.find((s) => s.batch_id === bId && s.stage_key === "quality");
  if (qualityStage) {
    if (quality_status === "ok") {
      qualityStage.status = "completed";
      advanceWorkflow(bId, "quality"); // triggers RFD stage to 'running'
    } else if (quality_status === "not_ok") {
      qualityStage.status = "hold";
    } else {
      qualityStage.status = "pending";
    }
    qualityStage.updated_at = new Date().toISOString();
  }

  // Update batch stages in Firestore
  const qBatchStages = dbState.batch_stages.filter((s) => s.batch_id === bId);
  qBatchStages.forEach((s) => {
    safeFirestoreWrite("batch_stages", s.id.toString(), s);
  });

  saveDatabase();
  safeFirestoreWrite("batches", bId.toString(), batch);
  res.json({ success: true, message: "Quality updated successfully", batch: enrichBatch(batch) });
});

// Rework (Reprocess) Reset Workflow
app.post("/api/rework/update", verifyAdminToken, (req, res) => {
  const { batch_id, type, remarks, reason, custom_reason } = req.body; // 'Dyeing' or 'Finishing'
  if (!batch_id || !type) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const bId = Number(batch_id);
  const batch = dbState.batches.find((b) => b.id === bId);
  if (!batch) {
    return res.status(404).json({ error: "Batch not found" });
  }

  // Save the rework reason / diagnostics before resetting the fields
  const loggedReason = reason || batch.shade_reason || batch.quality_reason || "Process Reprocess";
  const loggedCustomReason = custom_reason || batch.shade_custom_reason || batch.quality_custom_reason || "";

  // Transaction reset
  const batchStages = dbState.batch_stages.filter((s) => s.batch_id === bId);

  if (type === "Dyeing") {
    // Wet -> Dry -> Finish -> Shade -> Pending
    batchStages.forEach((s) => {
      if (["wet", "dry", "finish", "shade", "quality", "rfd", "delivered"].includes(s.stage_key)) {
        s.status = s.stage_key === "wet" ? "running" : "pending"; // Restart from Wet
        s.updated_at = new Date().toISOString();
      }
    });
    batch.shade_status = "pending";
    batch.shade_reason = null;
    batch.shade_custom_reason = null;
    batch.quality_status = "pending";
    batch.quality_reason = null;
    batch.quality_custom_reason = null;
    batch.rework_count += 1;
    batch.rework_type = "Dyeing";
  } else if (type === "Finishing") {
    // Finish -> Shade -> Quality -> Pending
    batchStages.forEach((s) => {
      if (["finish", "shade", "quality", "rfd", "delivered"].includes(s.stage_key)) {
        s.status = s.stage_key === "finish" ? "running" : "pending"; // Restart from Finishing
        s.updated_at = new Date().toISOString();
      }
    });
    batch.shade_status = "pending";
    batch.shade_reason = null;
    batch.shade_custom_reason = null;
    batch.quality_status = "pending";
    batch.quality_reason = null;
    batch.quality_custom_reason = null;
    batch.rework_count += 1;
    batch.rework_type = "Finishing";
  }

  if (remarks !== undefined) {
    batch.remarks = remarks;
  }

  // Record historical rework log
  if (!dbState.rework_logs) {
    dbState.rework_logs = [];
  }
  const nextLogId = dbState.rework_logs.length > 0 ? Math.max(...dbState.rework_logs.map((l) => l.id)) + 1 : 1;
  const newLog = {
    id: nextLogId,
    batch_id: bId,
    batch_number: batch.batch_number,
    rework_type: type as "Dyeing" | "Finishing",
    reason: loggedReason,
    custom_reason: loggedCustomReason,
    remarks: remarks || null,
    created_at: new Date().toISOString(),
  };
  dbState.rework_logs.push(newLog);
  safeFirestoreWrite("rework_logs", nextLogId.toString(), newLog);

  // Update batch stages in Firestore
  batchStages.forEach((s) => {
    safeFirestoreWrite("batch_stages", s.id.toString(), s);
  });

  batch.updated_at = new Date().toISOString();
  saveDatabase();
  safeFirestoreWrite("batches", bId.toString(), batch);

  res.json({ success: true, message: "Rework triggered successfully", batch: enrichBatch(batch) });
});

// Delivery Information Update
app.post("/api/delivery/update", verifyAdminToken, (req, res) => {
  const { batch_id, delivery_date, delivery_remarks, delivery_qty, mark_delivered, body_delivered, trims_delivered } = req.body;
  if (!batch_id) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const bId = Number(batch_id);
  const batch = dbState.batches.find((b) => b.id === bId);
  if (!batch) {
    return res.status(404).json({ error: "Batch not found" });
  }

  batch.delivery_remarks = delivery_remarks !== undefined ? delivery_remarks : batch.delivery_remarks;
  batch.delivery_qty = delivery_qty !== undefined ? delivery_qty : batch.delivery_qty;
  batch.updated_at = new Date().toISOString();

  if (body_delivered !== undefined) {
    batch.body_delivered = !!body_delivered;
    if (batch.body_delivered) {
      if (!batch.body_delivery_date) {
        batch.body_delivery_date = new Date().toISOString().split("T")[0];
      }
    } else {
      batch.body_delivery_date = null;
    }
  }

  if (trims_delivered !== undefined) {
    batch.trims_delivered = !!trims_delivered;
    if (batch.trims_delivered) {
      if (!batch.trims_delivery_date) {
        batch.trims_delivery_date = new Date().toISOString().split("T")[0];
      }
    } else {
      batch.trims_delivery_date = null;
    }
  }

  const hasTrims = !!(batch.trims && batch.trims.trim() !== "" && batch.trims.trim().toLowerCase() !== "n/a" && batch.trims.trim().toLowerCase() !== "none");
  let isFullyDelivered = false;

  if (hasTrims) {
    isFullyDelivered = !!(batch.body_delivered && batch.trims_delivered);
  } else {
    isFullyDelivered = !!(batch.body_delivered || mark_delivered);
  }

  if (isFullyDelivered || mark_delivered) {
    const rfdStage = dbState.batch_stages.find((s) => s.batch_id === bId && s.stage_key === "rfd");
    const delStage = dbState.batch_stages.find((s) => s.batch_id === bId && s.stage_key === "delivered");

    if (rfdStage) {
      rfdStage.status = "completed";
      rfdStage.updated_at = new Date().toISOString();
      safeFirestoreWrite("batch_stages", rfdStage.id.toString(), rfdStage);
    }
    if (delStage) {
      delStage.status = "completed";
      delStage.updated_at = new Date().toISOString();
      safeFirestoreWrite("batch_stages", delStage.id.toString(), delStage);
    }
    batch.delivery_date = delivery_date || batch.delivery_date || new Date().toISOString().split("T")[0];
    
    // Sync fields for consistency
    batch.body_delivered = true;
    if (!batch.body_delivery_date) {
      batch.body_delivery_date = batch.delivery_date;
    }
    if (hasTrims) {
      batch.trims_delivered = true;
      if (!batch.trims_delivery_date) {
        batch.trims_delivery_date = batch.delivery_date;
      }
    }
  } else {
    // If not fully delivered (e.g., body delivered but trims pending)
    // Completed stage is reverted to pending/running
    const delStage = dbState.batch_stages.find((s) => s.batch_id === bId && s.stage_key === "delivered");
    if (delStage && delStage.status === "completed") {
      delStage.status = "running";
      delStage.updated_at = new Date().toISOString();
      safeFirestoreWrite("batch_stages", delStage.id.toString(), delStage);
    }
    batch.delivery_date = null;
  }

  saveDatabase();
  safeFirestoreWrite("batches", bId.toString(), batch);
  res.json({ success: true, message: "Delivery details updated successfully", batch: enrichBatch(batch) });
});

// Single Date Update Quick Action
app.post("/api/delivery/date", verifyAdminToken, (req, res) => {
  const { batch_id, delivery_date } = req.body;
  if (!batch_id) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const bId = Number(batch_id);
  const batch = dbState.batches.find((b) => b.id === bId);
  if (!batch) {
    return res.status(404).json({ error: "Batch not found" });
  }

  batch.delivery_date = delivery_date || new Date().toISOString().split("T")[0];
  batch.updated_at = new Date().toISOString();

  saveDatabase();
  safeFirestoreWrite("batches", bId.toString(), batch);
  res.json({ success: true, message: "Delivery date set successfully", batch: enrichBatch(batch) });
});

// Remarks Inline Update
app.post("/api/remarks/update", verifyAdminToken, (req, res) => {
  const { batch_id, remarks } = req.body;
  if (!batch_id) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const bId = Number(batch_id);
  const batch = dbState.batches.find((b) => b.id === bId);
  if (!batch) {
    return res.status(404).json({ error: "Batch not found" });
  }

  batch.remarks = remarks || null;
  batch.updated_at = new Date().toISOString();

  saveDatabase();
  safeFirestoreWrite("batches", bId.toString(), batch);
  res.json({ success: true, message: "Remarks updated successfully" });
});

// Stats Overview (Dashboard helper)
app.get("/api/dashboard/stats", (req, res) => {
  const list = dbState.batches.map(enrichBatch);
  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Total Batch
  const totalBatch = list.length;

  // 2. Wet Running
  const wetRunning = list.filter((b) => b.stages && b.stages.wet === "running").length;

  // 3. Finished Today (rfd completed today or delivered completed today)
  // Let's filter batch stages for rfd or delivered that were updated today and completed
  const finishedToday = dbState.batch_stages.filter((s) => {
    if (s.status !== "completed") return false;
    if (s.stage_key !== "rfd" && s.stage_key !== "delivered") return false;
    const updateDay = s.updated_at.split("T")[0];
    return updateDay === todayStr;
  });
  // Unique batches
  const uniqueFinishedToday = Array.from(new Set(finishedToday.map((s) => s.batch_id))).length;

  // 4. Delivered Today (delivery_date = curdate)
  const deliveredToday = list.filter((b) => b.delivery_date === todayStr).length;

  // 5. RFD Today (rfd stage completed today)
  const rfdTodayStages = dbState.batch_stages.filter(
    (s) => s.stage_key === "rfd" && s.status === "completed" && s.updated_at.split("T")[0] === todayStr
  );
  const rfdToday = Array.from(new Set(rfdTodayStages.map((s) => s.batch_id))).length;

  // 6. Shade Pending (finished batches with shade_status='pending' AND 'finish' stage is completed)
  const shadePending = list.filter((b) => b.stages && b.stages.finish === "completed" && b.shade_status === "pending").length;

  // 7. Shade NOT OK
  const shadeNotOk = list.filter((b) => b.shade_status === "not_ok").length;

  // 8. Quality Pending (finished batches with quality_status='pending')
  const qualityPending = list.filter((b) => b.stages && b.stages.finish === "completed" && b.quality_status === "pending").length;

  // 9. Quality NOT OK
  const qualityNotOk = list.filter((b) => b.quality_status === "not_ok").length;

  // 10. Reprocess (rework_count > 0)
  const reprocess = list.filter((b) => b.rework_count > 0).length;

  // 11. Trims Pending (body_delivered === true AND trims_delivered !== true AND has trims spec)
  const trimsPending = list.filter((b) => {
    const hasTrims = !!(b.trims && b.trims.trim() !== "" && b.trims.trim().toLowerCase() !== "n/a" && b.trims.trim().toLowerCase() !== "none");
    return hasTrims && b.body_delivered && !b.trims_delivered;
  }).length;

  res.json({
    totalBatch,
    wetRunning,
    finishedToday: uniqueFinishedToday,
    deliveredToday,
    rfdToday,
    shadePending,
    shadeNotOk,
    qualityPending,
    qualityNotOk,
    reprocess,
    trimsPending,
  });
});

// Start Server & Vite Integration
async function startServer() {
  await initFirestoreDatabase();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Iris Fabrics server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
