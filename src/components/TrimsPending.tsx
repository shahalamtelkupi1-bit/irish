/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  HelpCircle, CheckCircle, Circle, Loader2, AlertCircle, ShoppingBag, Truck, Package, Calendar, Search
} from "lucide-react";
import { Batch } from "../types";
import { getFabricBadgeClass, getBatchBadgeText } from "../utils";
import { useOfflineSync } from "../hooks/useOfflineSync";

interface TrimsPendingProps {
  token?: string;
  onNavigate?: (panel: any, batchId?: number) => void;
}

export default function TrimsPending({ token, onNavigate }: TrimsPendingProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useOfflineSync(() => {
    fetchTrimsBatches();
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "body_delivered">("body_delivered");

  useEffect(() => {
    fetchTrimsBatches();
  }, []);

  const fetchTrimsBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/batches");
      if (res.ok) {
        const data = await res.json();
        // Show batches that have trim specifications
        const withTrims = data.filter((b: Batch) => b.trims && b.trims.trim() !== "" && b.trims.trim().toLowerCase() !== "n/a" && b.trims.trim().toLowerCase() !== "none");
        setBatches(withTrims);
      }
    } catch (err) {
      console.error("Error loading trims batches:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch (e) {
      return dateStr;
    }
  };

  // Filter logic based on tabs and search query
  const filteredBatches = batches.filter((b) => {
    // Search query filter
    const matchSearch = 
      b.batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.buyer && b.buyer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.buyer_reference && b.buyer_reference.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.trims && b.trims.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchSearch) return false;

    // Tab filter
    if (activeTab === "pending") {
      return !b.trims_delivered;
    } else if (activeTab === "body_delivered") {
      // Body is delivered, but trims are pending!
      return b.body_delivered && !b.trims_delivered;
    }

    return true; // "all" tab
  });

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Custom Tab Filters */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => { setActiveTab("body_delivered"); }}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition duration-150 flex items-center justify-center gap-1.5 ${
              activeTab === "body_delivered"
                ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            <span>Body OK, Trims Pending ({batches.filter(b => b.body_delivered && !b.trims_delivered).length})</span>
          </button>
          <button
            onClick={() => { setActiveTab("pending"); }}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition duration-150 flex items-center justify-center gap-1.5 ${
              activeTab === "pending"
                ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>Trims Pending ({batches.filter(b => !b.trims_delivered).length})</span>
          </button>
          <button
            onClick={() => { setActiveTab("all"); }}
            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition duration-150 flex items-center justify-center gap-1.5 ${
              activeTab === "all"
                ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>All Trims Batches ({batches.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Search trims, batch or buyer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Trims Grid List */}
      {loading ? (
        <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
          <span className="ml-2 text-slate-500 text-sm font-mono">Loading trim specifications...</span>
        </div>
      ) : filteredBatches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredBatches.map((batch) => {
            const isDelivered = batch.stages?.delivered === "completed";

            return (
              <div 
                key={batch.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between gap-5 hover:border-teal-500/40 hover:shadow-md transition duration-200"
              >
                <div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="font-display font-black text-base text-slate-900 dark:text-white">
                      {batch.batch_number}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${getFabricBadgeClass(batch.badge_color || "secondary")}`}>
                      {batch.fabric_type_name || "Fabric"}
                    </span>
                    {isDelivered && (
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded-lg border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        Fully Delivered
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mt-2">
                    Buyer: <strong className="text-slate-800 dark:text-slate-200">{batch.buyer}</strong> &nbsp;•&nbsp; 
                    Ref: <strong className="text-indigo-500 dark:text-indigo-400 font-semibold">{batch.buyer_reference}</strong> &nbsp;•&nbsp;
                    Color: <strong className="text-slate-700 dark:text-slate-300 font-mono">{batch.color || "N/A"}</strong>
                  </p>

                  {/* Delivery Status Badge */}
                  <div className="mt-4">
                    {/* Body delivery status */}
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 w-full ${
                      batch.body_delivered 
                        ? "bg-teal-50/40 dark:bg-teal-950/10 border-teal-100 dark:border-teal-900/50 text-teal-700 dark:text-teal-400" 
                        : "bg-slate-100/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-400"
                    }`}>
                      <Truck className={`w-4 h-4 ${batch.body_delivered ? "text-teal-500" : "text-slate-400"}`} />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase font-mono tracking-wider font-bold">
                          Body Fabric {batch.fabric_quantity ? `(${batch.fabric_quantity} KG)` : ""}
                        </div>
                        <div className="text-xs font-bold truncate">
                          {batch.body_delivered ? `Delivered (${formatDate(batch.body_delivery_date)})` : "Pending"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trims Specs Box */}
                  <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl flex gap-3">
                    <div className="p-2 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-lg h-fit">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h6 className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
                        Trims Type Specifications
                      </h6>
                      <p className="text-sm text-slate-800 dark:text-slate-100 mt-1 font-semibold leading-relaxed">
                        {batch.trims}
                      </p>
                      {batch.trims_quantity && (
                        <p className="text-xs text-teal-600 dark:text-teal-400 font-bold font-mono mt-1.5 flex items-center gap-1">
                          <span>Required Trims weight/qty:</span>
                          <span className="bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded border border-teal-100 dark:border-teal-900/30 text-teal-700 dark:text-teal-300">
                            {batch.trims_quantity}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {onNavigate && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
                    <button
                      onClick={() => onNavigate("delivery", batch.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 dark:bg-teal-500 hover:bg-teal-500 dark:hover:bg-teal-400 text-white shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Go to Delivery Page</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center p-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm text-slate-400">
          <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold">No pending trims batches found matching this filter.</p>
          <p className="text-xs text-slate-500 mt-1">Everything is up-to-date.</p>
        </div>
      )}
    </div>
  );
}
