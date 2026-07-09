/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Check, X, AlertTriangle, AlertCircle, RotateCw, RefreshCw, Loader2, ArrowRight, CornerDownRight, Tag, Search
} from "lucide-react";
import { Batch } from "../types";
import { getFabricBadgeClass, getBatchBadgeText } from "../utils";
import { useOfflineSync } from "../hooks/useOfflineSync";

interface ShadeManagementProps {
  token: string;
  preFilter?: string; // e.g. "pending" or "not_ok" from dashboard
  onBack?: () => void;
}

export default function ShadeManagement({ token, preFilter, onBack }: ShadeManagementProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  
  useOfflineSync(() => {
    fetchBatches();
  });
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "ok" | "not_ok">(
    (preFilter as any) || "all"
  );
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [reworkConfirmBatchId, setReworkConfirmBatchId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Active form entries (temporary state per batch ID)
  const [shadeStates, setShadeStates] = useState<Record<number, {
    status: "ok" | "not_ok" | "pending";
    reason: string;
    custom_reason: string;
    isSaving?: boolean;
    reworkType?: "Dyeing Rework" | "Finishing Rework";
    reworkRemarks?: string;
    isReworking?: boolean;
  }>>({});

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/batches");
      if (res.ok) {
        const data = await res.json();
        // Eligible for shade updates (finished batches, not delivered)
        const active = data.filter((b: Batch) => b.stages?.finish === "completed" && b.stages?.delivered !== "completed");
        setBatches(active);

        // Prepopulate shade states
        const initialStates: typeof shadeStates = {};
        active.forEach((b: Batch) => {
          initialStates[b.id] = {
            status: b.shade_status || "pending",
            reason: b.shade_reason || "Dull",
            custom_reason: b.shade_custom_reason || "",
            reworkType: "Dyeing Rework",
            reworkRemarks: "",
          };
        });
        setShadeStates(initialStates);
      }
    } catch (err) {
      console.error("Error loading batches for shade assessment:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateState = (id: number, key: string, value: any) => {
    setShadeStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [key]: value,
      },
    }));
  };

  const handleSaveShade = async (id: number) => {
    const state = shadeStates[id];
    if (!state) return;

    updateState(id, "isSaving", true);
    try {
      const res = await fetch("/api/shade/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          batch_id: id,
          shade_status: state.status,
          shade_reason: state.status === "not_ok" ? state.reason : "",
          shade_custom_reason: state.status === "not_ok" ? state.custom_reason : "",
        }),
      });

      if (res.ok) {
        // Refresh batch database
        const updatedRes = await fetch("/api/batches");
        if (updatedRes.ok) {
          const data = await updatedRes.json();
          setBatches(data.filter((b: Batch) => b.stages?.finish === "completed" && b.stages?.delivered !== "completed"));
        }
        setSelectedBatchId(null);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update shade assessment.");
      }
    } catch (err) {
      console.error("Save shade error:", err);
    } finally {
      updateState(id, "isSaving", false);
    }
  };

  const handleTriggerRework = async (id: number) => {
    const state = shadeStates[id];
    if (!state) return;

    updateState(id, "isReworking", true);
    try {
      const mappedType = state.reworkType === "Finishing Rework" ? "Finishing" : "Dyeing";
      const res = await fetch("/api/rework/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          batch_id: id,
          type: mappedType,
          remarks: state.reworkRemarks || `Shade Assessment Rejection Rework - ${state.reason}`,
          reason: state.reason || "Shade Defect",
          custom_reason: state.custom_reason || "",
        }),
      });

      if (res.ok) {
        alert("Batch reprocess initiated successfully. Stage workflow was recycled.");
        fetchBatches();
        setSelectedBatchId(null);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to trigger rework.");
      }
    } catch (err) {
      console.error("Rework trigger error:", err);
    } finally {
      updateState(id, "isReworking", false);
    }
  };

  const predefinedReasons = [
    "Dull",
    "Bright",
    "Lighter",
    "Darker",
    "Out of Tone",
  ];

  // Filtering based on active tab and search query
  const filteredBatches = batches.filter((b) => {
    const currentStatus = b.shade_status || "pending";
    const matchesTab = activeTab === "all" ? true : currentStatus === activeTab;
    if (!matchesTab) return false;

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
      
      {/* Tab Filter Links */}
      <section className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto no-print">
        {(["all", "pending", "ok", "not_ok"] as const).map((tab) => {
          const labels = { all: "All Batches", pending: "Pending Shade", ok: "Shade APPROVED (OK)", not_ok: "Shade REJECTED (NOT OK)" };
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition duration-200 ${
                active 
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400" 
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </section>

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

      {/* Batches assessment list */}
      {loading ? (
        <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : filteredBatches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBatches.map((batch) => {
            return (
              <div 
                key={batch.id}
                onClick={() => setSelectedBatchId(batch.id)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-display font-extrabold text-base text-slate-900 dark:text-white">
                      {batch.batch_number}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md border ${getFabricBadgeClass(batch.badge_color || "secondary")}`}>
                      {getBatchBadgeText(batch)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Buyer: <strong className="text-slate-700 dark:text-slate-300">{batch.buyer}</strong> <br/>
                    Ref: <strong className="text-indigo-500 font-medium">{batch.buyer_reference}</strong> &nbsp;•&nbsp; 
                    Target Color: <strong className="text-slate-700 dark:text-slate-300">{batch.color}</strong>
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    {batch.shade_status === "ok" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-900/30">
                        <Check className="w-3.5 h-3.5" /> OK Approved
                      </span>
                    ) : batch.shade_status === "not_ok" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-md border border-rose-100 dark:border-rose-900/30">
                        <X className="w-3.5 h-3.5" /> NOT OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-900/30">
                        <AlertCircle className="w-3.5 h-3.5" /> Awaiting Test
                      </span>
                    )}
                  </div>
                  <button className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                    Assess Shade <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
          No batches found matching the chosen shade category.
        </div>
      )}

      {/* Pop-up Modal for Shade Assessment */}
      {selectedBatchId !== null && (() => {
        const batch = batches.find(b => b.id === selectedBatchId);
        if (!batch) return null;

        const state = shadeStates[batch.id] || { status: "pending", reason: "Dull", custom_reason: "" };
        const isSaving = state.isSaving;
        const isReworking = state.isReworking;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start gap-4 p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/25">
                <div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="font-display font-extrabold text-xl text-slate-900 dark:text-white">
                      {batch.batch_number}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md border ${getFabricBadgeClass(batch.badge_color || "secondary")}`}>
                      {getBatchBadgeText(batch)}
                    </span>
                    {batch.rework_count > 0 && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded">
                        Reprocessed {batch.rework_count}x
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Buyer: <strong className="text-slate-600 dark:text-slate-300">{batch.buyer}</strong> &nbsp;•&nbsp; 
                    Ref: <strong className="text-indigo-500 font-medium">{batch.buyer_reference}</strong> &nbsp;•&nbsp; 
                    Target Color: <strong className="text-slate-600 dark:text-slate-300">{batch.color}</strong>
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedBatchId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-mono text-slate-400">Status:</span>
                  {batch.shade_status === "ok" ? (
                    <span className="text-emerald-500 font-bold">OK Approved</span>
                  ) : batch.shade_status === "not_ok" ? (
                    <span className="text-rose-500 font-bold">NOT OK</span>
                  ) : (
                    <span className="text-amber-500 font-bold">Awaiting Test</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Left segment: decision OK / NOT OK / PENDING and specs */}
                  <div className="md:col-span-5 space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                      <span className="text-[10px] text-slate-400 font-mono block uppercase font-bold tracking-wider border-b border-slate-200/50 dark:border-slate-800/50 pb-1">Batch Specifications</span>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 text-[11px]">
                        <div>
                          <span className="text-[9px] text-slate-400 font-mono block uppercase">Buyer</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate" title={batch.buyer}>{batch.buyer}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-mono block uppercase">Ref No</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 block truncate" title={batch.buyer_reference}>{batch.buyer_reference}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-mono block uppercase">Color</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate" title={batch.color}>{batch.color}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-mono block uppercase">Fabric Type</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate" title={getBatchBadgeText(batch)}>{getBatchBadgeText(batch)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-mono block uppercase">Input Qty</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono block">{batch.fabric_quantity || "0"} KG</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-mono block uppercase">Trims Item</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400 block truncate" title={batch.trims || "N/A"}>
                            {batch.trims ? batch.trims : <span className="text-slate-400 font-normal italic">None</span>}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[9px] text-slate-400 font-mono block uppercase">Trims Qty</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400 block truncate" title={batch.trims_quantity || "N/A"}>
                            {batch.trims_quantity ? batch.trims_quantity : <span className="text-slate-400 font-normal italic">N/A</span>}
                          </span>
                        </div>
                        <div className="col-span-2 border-t border-slate-200/40 dark:border-slate-800/40 pt-2 flex gap-2">
                          <div className="flex-1">
                            <span className="text-[9px] text-slate-400 font-mono block uppercase">Shade Trial</span>
                            {batch.shade_status === "ok" ? (
                              <span className="text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1 py-0.5 rounded block text-center">OK Approved</span>
                            ) : (
                              <span className="text-[9px] text-amber-500 font-semibold bg-amber-500/10 px-1 py-0.5 rounded block text-center">Pending</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="text-[9px] text-slate-400 font-mono block uppercase">Quality Check</span>
                            {batch.quality_status === "ok" ? (
                              <span className="text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1 py-0.5 rounded block text-center">OK Passed</span>
                            ) : (
                              <span className="text-[9px] text-amber-500 font-semibold bg-amber-500/10 px-1 py-0.5 rounded block text-center">Pending</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs uppercase font-mono text-slate-400 tracking-wider font-semibold block">
                        Select Assessment
                      </span>
                    <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
                      <button
                        onClick={() => updateState(batch.id, "status", "ok")}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          state.status === "ok"
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400"
                            : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span>OK (Approved)</span>
                      </button>

                      <button
                        onClick={() => updateState(batch.id, "status", "not_ok")}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          state.status === "not_ok"
                            ? "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400"
                            : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <X className="w-4 h-4" />
                        <span>NOT OK (Reject)</span>
                      </button>

                      <button
                        onClick={() => updateState(batch.id, "status", "pending")}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          state.status === "pending"
                            ? "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                            : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>Awaiting</span>
                      </button>
                    </div>

                    <button
                      disabled={isSaving}
                      onClick={() => handleSaveShade(batch.id)}
                      className="w-full mt-3 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                      <span>Apply Decision</span>
                    </button>
                    </div>
                  </div>

                  {/* Right segment: reasons / custom overrides (Visible only if NOT OK is selected) */}
                  <div className="md:col-span-7">
                    {state.status === "not_ok" ? (
                      <div className="p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/10 space-y-3.5">
                        <div className="flex gap-2 items-center text-rose-600 dark:text-rose-400 font-bold text-xs font-mono uppercase">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Defect Rejection Diagnostics</span>
                        </div>

                        {/* Predefined check */}
                        <div className="space-y-1.5">
                          <label className="text-xs text-slate-500 font-semibold block">Select Failure Reason</label>
                          <div className="flex flex-wrap gap-1.5">
                            {predefinedReasons.map((reason) => {
                              const active = state.reason === reason;
                              return (
                                <button
                                  key={reason}
                                  onClick={() => updateState(batch.id, "reason", reason)}
                                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                                    active
                                      ? "bg-rose-500 text-white border-rose-500"
                                      : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900"
                                  }`}
                                >
                                  {reason}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Custom explanation */}
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500 font-semibold block">Custom Remarks / Notes</label>
                          <input
                            type="text"
                            placeholder="Type additional specific details of mismatch..."
                            value={state.custom_reason}
                            onChange={(e) => updateState(batch.id, "custom_reason", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
                          />
                        </div>

                        {/* Dynamic Reprocess Trigger section inside shade not ok */}
                        <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-3.5 mt-2 space-y-3">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <RotateCw className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Quick Rework & Reprocess</span>
                          </div>

                          <div className="flex flex-col gap-2">
                            <select
                              value={state.reworkType}
                              onChange={(e) => updateState(batch.id, "reworkType", e.target.value)}
                              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none text-slate-800 dark:text-white w-full"
                            >
                              <option value="Dyeing Rework">Dyeing Rework (wet process reset)</option>
                              <option value="Finishing Rework">Finishing Rework (finish stage reset)</option>
                            </select>

                            <input
                              type="text"
                              placeholder="Rework remarks (optional)..."
                              value={state.reworkRemarks}
                              onChange={(e) => updateState(batch.id, "reworkRemarks", e.target.value)}
                              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none text-slate-800 dark:text-white w-full"
                            />

                            {reworkConfirmBatchId === batch.id ? (
                              <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">
                                  Confirm: Recycle stages and increment rework?
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setReworkConfirmBatchId(null)}
                                    className="flex-1 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 rounded-lg transition"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    disabled={isReworking}
                                    onClick={async () => {
                                      await handleTriggerRework(batch.id);
                                      setReworkConfirmBatchId(null);
                                    }}
                                    className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1 shadow-sm"
                                  >
                                    {isReworking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                    <span>Yes, Rework</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setReworkConfirmBatchId(batch.id)}
                                className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Initiate Rework</span>
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            * Wet stage will be set to running, other stages reset to pending.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/20">
                        <CornerDownRight className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
                        <span className="text-xs font-medium">Select "NOT OK (Reject)" to write diagnoses or start immediate reprocess.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
