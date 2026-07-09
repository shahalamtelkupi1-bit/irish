/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  ChevronDown, ChevronUp, Loader2, Play, CheckCircle2, AlertCircle, Circle, Save, Clock, Search
} from "lucide-react";
import { Batch, StageKey, StageStatus } from "../types";
import { getStatusDotClass, getStatusLabel, getFabricBadgeClass, getBatchBadgeText } from "../utils";
import { useOfflineSync } from "../hooks/useOfflineSync";

interface ProductionManagementProps {
  token: string;
  preSelectedBatchId?: number | null;
  onBack?: () => void;
}

export default function ProductionManagement({ token, preSelectedBatchId, onBack }: ProductionManagementProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(preSelectedBatchId || null);
  const [updatingStage, setUpdatingStage] = useState<{ batchId: number; stage: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useOfflineSync(() => {
    fetchActiveBatches();
  });

  useEffect(() => {
    fetchActiveBatches();
  }, []);

  const fetchActiveBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/batches");
      if (res.ok) {
        const data = await res.json();
        // Show batches that are NOT completely delivered
        let active = data.filter((b: Batch) => b.stages?.delivered !== "completed");
        
        // If there's a preselected batch, ensure it is included in active list
        if (preSelectedBatchId && !active.some((b: Batch) => b.id === preSelectedBatchId)) {
          const preSelected = data.find((b: Batch) => b.id === preSelectedBatchId);
          if (preSelected) {
            active = [preSelected, ...active];
          }
        }
        
        setBatches(active);
        if (preSelectedBatchId) {
          setExpandedBatchId(preSelectedBatchId);
        }
      }
    } catch (err) {
      console.error("Error loading active batches:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (batchId: number, stageKey: StageKey, newStatus: StageStatus) => {
    setUpdatingStage({ batchId, stage: stageKey });
    try {
      const res = await fetch("/api/stages/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          batch_id: batchId,
          stage_key: stageKey,
          status: newStatus,
        }),
      });

      if (res.ok) {
        // Refresh local lists
        const updatedRes = await fetch("/api/batches");
        if (updatedRes.ok) {
          const data = await updatedRes.json();
          const active = data.filter((b: Batch) => b.stages?.delivered !== "completed");
          setBatches(active);
        }
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update stage status.");
      }
    } catch (err) {
      console.error("Stage update error:", err);
    } finally {
      setUpdatingStage(null);
    }
  };

  const productionStages: StageKey[] = ["wet", "dry", "finish", "rfd"];
  const stageTitles: Record<StageKey, string> = {
    wet: "Wet Dyeing Process",
    dry: "Drying & Hydroextraction",
    finish: "Finishing & Compacting",
    rfd: "Ready For Delivery (RFD)",
    shade: "Shade",
    quality: "Quality",
    delivered: "Delivered",
  };

  const filteredBatches = batches.filter((b) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (b.batch_number && b.batch_number.toLowerCase().includes(query)) ||
      (b.buyer && b.buyer.toLowerCase().includes(query)) ||
      (b.buyer_reference && b.buyer_reference.toLowerCase().includes(query)) ||
      (b.color && b.color.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Search Input */}
      <div className="relative no-print">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          <Search className="h-4.5 w-4.5 text-slate-400" />
        </span>
        <input
          type="text"
          autoComplete="off"
          data-lpignore="true"
          name="search_input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Batch Number, Buyer, Ref, or Color..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800 dark:text-white placeholder-slate-400 shadow-sm"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {/* Main Production Accordion */}
      {loading ? (
        <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="ml-3 text-slate-500 text-sm font-mono">Loading active batches...</span>
        </div>
      ) : filteredBatches.length > 0 ? (
        <div className="space-y-4">
          {filteredBatches.map((batch) => {
            const isExpanded = expandedBatchId === batch.id;
            const currentReworkCount = batch.rework_count || 0;

            return (
              <div 
                key={batch.id} 
                className={`bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-200 ${
                  isExpanded 
                    ? "border-indigo-500 ring-4 ring-indigo-500/5 shadow-md" 
                    : "border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {/* Accordion Trigger Header */}
                <button
                  onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                  className="w-full px-5 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-left focus:outline-none"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-extrabold text-base text-slate-900 dark:text-white">
                        {batch.batch_number}
                      </span>
                      <span className={`px-2 py-0.2 text-[9px] font-bold rounded-md border ${getFabricBadgeClass(batch.badge_color || "secondary")}`}>
                        {getBatchBadgeText(batch)}
                      </span>
                      {currentReworkCount > 0 && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded uppercase">
                          Rework {currentReworkCount}x
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-y-1 gap-x-2 items-center">
                      <span>Buyer: <strong className="text-slate-600 dark:text-slate-300">{batch.buyer}</strong></span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>Ref: <strong className="text-indigo-500 font-medium">{batch.buyer_reference}</strong></span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>Color: <strong className="text-slate-600 dark:text-slate-300">{batch.color || "—"}</strong></span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>Body: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{batch.fabric_type_name || "—"} {batch.fabric_quantity ? `(${batch.fabric_quantity} KG)` : ""}</strong></span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>Trims: <strong className="text-amber-600 dark:text-amber-400 font-semibold">{batch.trims || "None"} {batch.trims_quantity ? `(${batch.trims_quantity})` : ""}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                    {/* Small preview of progress dots */}
                    <div className="flex gap-1">
                      {productionStages.map((key) => {
                        const s = batch.stages?.[key] || "pending";
                        let dotColor = "bg-slate-200 dark:bg-slate-700";
                        if (s === "completed") dotColor = "bg-emerald-500";
                        else if (s === "running") dotColor = "bg-amber-500 animate-pulse";
                        else if (s === "hold") dotColor = "bg-rose-500";

                        return (
                          <span 
                            key={key} 
                            className={`w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900 ${dotColor}`} 
                            title={`${key}: ${s}`}
                          />
                        );
                      })}
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </button>

                {/* Expanded Panel Details */}
                {isExpanded && (
                  <div className="px-5 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 slide-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                      {productionStages.map((key) => {
                        const status = batch.stages?.[key] || "pending";
                        const isSaving = updatingStage?.batchId === batch.id && updatingStage?.stage === key;

                        return (
                          <div 
                            key={key} 
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl space-y-3 shadow-sm relative overflow-hidden"
                          >
                            {/* Card Glow Border reflecting the state */}
                            <div className={`absolute top-0 left-0 right-0 h-1 ${
                              status === "completed" ? "bg-emerald-500" : status === "running" ? "bg-amber-500" : status === "hold" ? "bg-rose-500" : "bg-slate-200 dark:bg-slate-800"
                            }`} />

                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-display font-bold text-xs text-slate-400 uppercase tracking-wider font-mono">
                                  {key.toUpperCase()}
                                </h5>
                                <h6 className="font-display font-bold text-sm text-slate-800 dark:text-white mt-0.5">
                                  {stageTitles[key]}
                                </h6>
                              </div>
                              {isSaving && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                            </div>

                            {/* Status Pills Choice */}
                            <div className="space-y-1 pt-1">
                              {/* Pending status choice */}
                              <button
                                disabled={isSaving}
                                onClick={() => handleStatusChange(batch.id, key, "pending")}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                  status === "pending"
                                    ? "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                                    : "border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                }`}
                              >
                                <Circle className="w-3.5 h-3.5 text-slate-400" />
                                <span>Pending</span>
                              </button>

                              {/* Running status choice */}
                              <button
                                disabled={isSaving}
                                onClick={() => handleStatusChange(batch.id, key, "running")}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                  status === "running"
                                    ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400"
                                    : "border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                }`}
                              >
                                <Play className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                <span>In Progress</span>
                              </button>

                              {/* Hold status choice */}
                              <button
                                disabled={isSaving}
                                onClick={() => handleStatusChange(batch.id, key, "hold")}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                  status === "hold"
                                    ? "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400"
                                    : "border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                }`}
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                <span>On Hold</span>
                              </button>

                              {/* Completed status choice */}
                              <button
                                disabled={isSaving}
                                onClick={() => handleStatusChange(batch.id, key, "completed")}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                  status === "completed"
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400"
                                    : "border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/10" />
                                <span>Completed</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
          No active, non-delivered production batches found to display. Create batches or clear filters.
        </div>
      )}
    </div>
  );
}
