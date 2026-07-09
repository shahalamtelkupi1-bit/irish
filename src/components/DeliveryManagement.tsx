/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Truck, Calendar, Clipboard, Loader2, CheckCircle2, Info, AlertCircle, Search, X, Check, ArrowRight, Edit
} from "lucide-react";
import { Batch } from "../types";
import { getFabricBadgeClass, calcLossParts, getBatchBadgeText } from "../utils";
import { useOfflineSync } from "../hooks/useOfflineSync";

interface DeliveryManagementProps {
  token: string;
  onBack?: () => void;
  preSelectedBatchId?: number | null;
}

export default function DeliveryManagement({ token, onBack, preSelectedBatchId }: DeliveryManagementProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useOfflineSync(() => {
    fetchFinishedBatches();
  });
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "delivered">("all");
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(preSelectedBatchId || null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Delivery states per batch ID
  const [deliveryStates, setDeliveryStates] = useState<Record<number, {
    delivery_date: string;
    delivery_qty: string;
    delivery_remarks: string;
    body_delivered?: boolean;
    trims_delivered?: boolean;
    isSaving?: boolean;
  }>>({});

  const [quickDeliveringId, setQuickDeliveringId] = useState<number | null>(null);
  const [quickDeliverConfirmId, setQuickDeliverConfirmId] = useState<number | null>(null);

  const executeQuickDeliverDirectly = async (batch: Batch) => {
    setQuickDeliveringId(batch.id);
    try {
      const res = await fetch("/api/delivery/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          batch_id: batch.id,
          delivery_date: new Date().toISOString().split("T")[0],
          delivery_qty: "N/A",
          delivery_remarks: "Quick delivered (No Trims)",
          mark_delivered: true,
        }),
      });

      if (res.ok) {
        try {
          alert(`Batch ${batch.batch_number} quick delivered successfully!`);
        } catch (e) {
          console.log("Alert blocked inside sandboxed iframe:", e);
        }
        fetchFinishedBatches();
        setSelectedBatchId(null);
      } else {
        const err = await res.json();
        try {
          alert(err.error || "Failed to quick deliver batch.");
        } catch (e) {
          console.log("Alert blocked inside sandboxed iframe:", e);
        }
      }
    } catch (err) {
      console.error("Quick deliver error:", err);
      try {
        alert("Failed to quick deliver batch due to connection error.");
      } catch (e) {
        console.log("Alert blocked inside sandboxed iframe:", e);
      }
    } finally {
      setQuickDeliveringId(null);
    }
  };

  const handleQuickDeliver = async (batch: Batch) => {
    if (quickDeliverConfirmId !== batch.id) {
      setQuickDeliverConfirmId(batch.id);
      setTimeout(() => {
        setQuickDeliverConfirmId((prev) => (prev === batch.id ? null : prev));
      }, 3000);
      return;
    }
    setQuickDeliverConfirmId(null);
    await executeQuickDeliverDirectly(batch);
  };

  useEffect(() => {
    fetchFinishedBatches();
  }, []);

  const fetchFinishedBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/batches");
      if (res.ok) {
        const data = await res.json();
        setBatches(data);

        const initialStates: typeof deliveryStates = {};
        data.forEach((b: Batch) => {
          initialStates[b.id] = {
            delivery_date: b.delivery_date ? b.delivery_date.split("T")[0] : new Date().toISOString().split("T")[0],
            delivery_qty: b.delivery_qty || "",
            delivery_remarks: b.delivery_remarks || "",
            body_delivered: b.body_delivered ?? false,
            trims_delivered: b.trims_delivered ?? false,
          };
        });
        setDeliveryStates(initialStates);

        if (preSelectedBatchId) {
          const preSelectedBatch = data.find((b: Batch) => b.id === preSelectedBatchId);
          if (preSelectedBatch) {
            const isCompleted = preSelectedBatch.stages?.delivered === "completed";
            setIsEditing(!isCompleted);
          }
        }
      }
    } catch (err) {
      console.error("Error loading delivery batches:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateState = (id: number, key: string, value: string) => {
    setDeliveryStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [key]: value,
      },
    }));
  };

  const updateStateBool = (id: number, key: string, value: boolean) => {
    setDeliveryStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [key]: value,
      },
    }));
  };

  const handleSaveDelivery = async (id: number) => {
    const state = deliveryStates[id];
    if (!state) return;

    if (!state.delivery_qty) {
      alert("Delivered quantity is required to calculate process loss.");
      return;
    }

    const batch = batches.find((b) => b.id === id);
    const hasTrims = !!(batch && batch.trims && batch.trims.trim() !== "" && batch.trims.trim().toLowerCase() !== "n/a" && batch.trims.trim().toLowerCase() !== "none");

    setDeliveryStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], isSaving: true },
    }));

    try {
      const res = await fetch("/api/delivery/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          batch_id: id,
          delivery_date: state.delivery_date,
          delivery_qty: state.delivery_qty,
          delivery_remarks: state.delivery_remarks || "",
          mark_delivered: true,
          body_delivered: true,
          trims_delivered: true,
        }),
      });

      if (res.ok) {
        alert("Logistics delivery details registered and updated.");
        fetchFinishedBatches();
        setSelectedBatchId(null);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update delivery info.");
      }
    } catch (err) {
      console.error("Delivery save error:", err);
    } finally {
      setDeliveryStates((prev) => ({
        ...prev,
        [id]: { ...prev[id], isSaving: false },
      }));
    }
  };

  // Filtering based on active tab and search query
  const filteredBatches = batches.filter((b) => {
    const isCompleted = b.stages?.delivered === "completed";
    const matchesTab = activeTab === "all" ? true : (activeTab === "delivered" ? isCompleted : !isCompleted);
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
        {(["all", "pending", "delivered"] as const).map((tab) => {
          const labels = { all: "All Batches", pending: "Pending Delivery", delivered: "Delivered Logs" };
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition duration-200 ${
                active 
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400" 
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
          autoCorrect="off"
          spellCheck={false}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Batch Number, Buyer, Ref, or Color..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-800 dark:text-white placeholder-slate-400 shadow-sm"
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

      {/* Batches delivery list/table */}
      {loading ? (
        <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : filteredBatches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredBatches.map((batch) => {
            const isDelivered = batch.stages?.delivered === "completed";

            return (
              <div 
                key={batch.id}
                onClick={() => {
                  setSelectedBatchId(batch.id);
                  setIsEditing(!isDelivered);
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-sm transition duration-150 cursor-pointer flex flex-col justify-between group h-full"
              >
                <div>
                  <div className="flex justify-between items-start gap-1.5 mb-2.5">
                    <span className="font-display font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {batch.batch_number}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded border ${getFabricBadgeClass(batch.badge_color || "secondary")} shrink-0`}>
                      {getBatchBadgeText(batch)}
                    </span>
                  </div>
                  
                  <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 dark:text-slate-500">Buyer:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{batch.buyer}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 dark:text-slate-500">Ref:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{batch.buyer_reference}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 dark:text-slate-500">Color:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{batch.color}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]" onClick={(e) => e.stopPropagation()}>
                  <div>
                    {isDelivered ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded text-[10px] border border-emerald-100 dark:border-emerald-900/30">
                        <Check className="w-3 h-3" /> Delivered
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded text-[10px] border border-amber-100 dark:border-amber-900/30 animate-pulse">
                          <AlertCircle className="w-3 h-3" /> Ready/Pending
                        </span>
                        {(!batch.trims || batch.trims.trim() === "" || batch.trims.trim().toLowerCase() === "n/a" || batch.trims.trim().toLowerCase() === "none") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickDeliver(batch);
                            }}
                            disabled={quickDeliveringId === batch.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-semibold text-[9px] uppercase tracking-wider transition shadow-sm text-white ${
                              quickDeliverConfirmId === batch.id
                                ? "bg-amber-500 hover:bg-amber-600 animate-pulse"
                                : "bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400"
                            }`}
                            title={quickDeliverConfirmId === batch.id ? "Click again to confirm delivery" : "1-Click Quick Deliver"}
                          >
                            {quickDeliveringId === batch.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Truck className="w-2.5 h-2.5" />
                            )}
                            <span>{quickDeliverConfirmId === batch.id ? "Confirm?" : "Quick Deliver"}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedBatchId(batch.id);
                      setIsEditing(!isDelivered);
                    }}
                    className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 hover:underline"
                  >
                    <span>Delivery</span>
                    <ArrowRight className="w-3 h-3 transition-transform hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
          No batches found matching the chosen delivery status.
        </div>
      )}

      {/* Pop-up Modal for Delivery */}
      {selectedBatchId !== null && (() => {
        const batch = batches.find(b => b.id === selectedBatchId);
        if (!batch) return null;

        const state = deliveryStates[batch.id] || { delivery_date: "", delivery_qty: "", delivery_remarks: "" };
        const isSaving = state.isSaving;
        const isDelivered = batch.stages?.delivered === "completed";
        const hasTrims = !!(batch.trims && batch.trims.trim() !== "" && batch.trims.trim().toLowerCase() !== "n/a" && batch.trims.trim().toLowerCase() !== "none");

        // Calculate live process loss parts
        const lossParts = calcLossParts(batch.trims_quantity, state.delivery_qty, batch.trims);

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
                    {isDelivered && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded">
                        Delivered
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Buyer: <strong className="text-slate-600 dark:text-slate-300">{batch.buyer}</strong> &nbsp;•&nbsp; 
                    Ref: <strong className="text-indigo-500 font-medium">{batch.buyer_reference}</strong> &nbsp;•&nbsp; 
                    Color: <strong className="text-slate-600 dark:text-slate-300">{batch.color}</strong>
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
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Left segment: Batch Specs & Stats */}
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

                    <div className="p-4 bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono block uppercase font-bold">Real-time Process Loss</span>
                      <div className="text-lg font-display font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                        {lossParts.text}
                      </div>
                    </div>
                  </div>

                  {/* Right segment: Form inputs or read-only view */}
                  {!isEditing ? (
                    /* Read-only Detail view inside Pop-up Modal */
                    <div className="md:col-span-7 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs uppercase font-mono text-slate-400 tracking-wider font-semibold block">
                          Delivery Logistics (Delivered)
                        </span>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 font-bold rounded-full">
                          Saved Details
                        </span>
                      </div>

                      <div className="space-y-4 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-medium">Delivery Date</span>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block mt-1">
                              {batch.delivery_date ? batch.delivery_date.split("T")[0] : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-medium">Delivered Qty</span>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block mt-1 font-mono">
                              {batch.delivery_qty || "0"} KG
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-3">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-medium">Remarks</span>
                          <span className="text-xs text-slate-700 dark:text-slate-300 block mt-1 italic">
                            {batch.delivery_remarks || "No remarks provided"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setIsEditing(true)}
                        className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit Delivery Details</span>
                      </button>
                    </div>
                  ) : (
                    /* Right segment: Form inputs */
                    <div className="md:col-span-7 space-y-4">
                      <span className="text-xs uppercase font-mono text-slate-400 tracking-wider font-semibold block">
                        {isDelivered ? "Edit Delivery Logistics" : "Add Delivery Logistics"}
                      </span>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Delivery Date</span>
                          </label>
                          <input
                            type="date"
                            value={state.delivery_date}
                            onChange={(e) => updateState(batch.id, "delivery_date", e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Delivered Qty (KG)</span>
                          </label>
                          <input
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="e.g. 104.5"
                            value={state.delivery_qty}
                            onChange={(e) => updateState(batch.id, "delivery_qty", e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                            <Clipboard className="w-3.5 h-3.5 text-slate-400" />
                            <span>Remarks</span>
                          </label>
                          <input
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="e.g. Delivered via Truck GP-1092"
                            value={state.delivery_remarks || ""}
                            onChange={(e) => updateState(batch.id, "delivery_remarks", e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          disabled={isSaving}
                          onClick={() => handleSaveDelivery(batch.id)}
                          className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>{isDelivered ? "Update Delivery" : "Delivery"}</span>
                        </button>

                        {isDelivered && (
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1 shadow-sm"
                          >
                            Cancel
                          </button>
                        )}

                        {!isDelivered && (!batch.trims || batch.trims.trim() === "") && (
                          <button
                            disabled={quickDeliveringId === batch.id}
                            onClick={() => handleQuickDeliver(batch)}
                            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                            title="1-Click Quick Deliver using input fabric quantity"
                          >
                            {quickDeliveringId === batch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                            <span>Quick Deliver</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
