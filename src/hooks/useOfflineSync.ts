import { useState, useEffect, useRef } from "react";

export interface OfflineStatus {
  onLine: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

/**
 * A custom React hook to subscribe to offline/online events, sync status, and pending write counts.
 * Optionally triggers a callback to re-fetch data when local state updates or sync completes.
 */
export function useOfflineSync(onRefresh?: () => void) {
  const [status, setStatus] = useState<OfflineStatus>(() => {
    let pendingCount = 0;
    try {
      const queue = JSON.parse(localStorage.getItem("offline_write_queue") || "[]");
      pendingCount = queue.length;
    } catch {}
    
    return {
      onLine: navigator.onLine,
      isSyncing: false,
      pendingCount,
    };
  });

  // Keep callback in ref to prevent listener re-registration issues
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    // Handle offline status updates from custom events
    const handleStatusChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setStatus({
          onLine: customEvent.detail.onLine,
          isSyncing: customEvent.detail.isSyncing,
          pendingCount: customEvent.detail.pendingCount,
        });
      }
    };

    // Handle data refresh requests (optimistic updates or sync completion)
    const handleDataUpdated = () => {
      if (onRefreshRef.current) {
        onRefreshRef.current();
      }
    };

    window.addEventListener("offline-sync-status", handleStatusChange);
    window.addEventListener("offline-data-updated", handleDataUpdated);
    window.addEventListener("offline-sync-completed", handleDataUpdated);

    // Initial manual verification of state on hook mounting
    try {
      const queue = JSON.parse(localStorage.getItem("offline_write_queue") || "[]");
      if (queue.length !== status.pendingCount) {
        setStatus(prev => ({ ...prev, pendingCount: queue.length }));
      }
    } catch {}

    return () => {
      window.removeEventListener("offline-sync-status", handleStatusChange);
      window.removeEventListener("offline-data-updated", handleDataUpdated);
      window.removeEventListener("offline-sync-completed", handleDataUpdated);
    };
  }, []); // Empty dependency array means listeners are created only once!

  return status;
}
