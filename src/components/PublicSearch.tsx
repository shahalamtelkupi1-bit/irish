/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { Search, Loader2, ArrowRight, RefreshCw, Lock, Calendar, ClipboardCheck, Info, Layers, ArrowUp, Clock, AlertTriangle, X } from "lucide-react";
import { Batch, StageKey } from "../types";
import { getStatusDotClass, getStatusLabel, getFabricBadgeClass, formatDate, calcLossParts, getBatchBadgeText } from "../utils";

// Beautiful SVG logo for IRIS group
export function IrisLogo({ className = "w-12 h-12" }: { className?: string }) {
  const numSpikes = 32;
  const outerRadius = 45;
  const innerRadius = 25;
  const cx = 50;
  const cy = 50;
  const points: string[] = [];
  for (let i = 0; i < numSpikes * 2; i++) {
    const angle = (i * Math.PI) / numSpikes;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return (
    <svg viewBox="0 0 100 100" className={className}>
      {/* Black Diamond Background */}
      <polygon points="50,2 98,50 50,98 2,50" fill="#000000" />
      
      {/* Yellow Sunburst overlapping the black diamond */}
      <polygon points={points.join(" ")} fill="#ffeb00" />
      
      {/* "IRIS" Text in bold red */}
      <text 
        x="51" 
        y="45" 
        fill="#e31e24" 
        fontFamily="'Impact', 'Arial Black', 'Inter', sans-serif" 
        fontWeight="950" 
        fontSize="30" 
        letterSpacing="-1.5"
        textAnchor="middle"
      >
        IRIS
      </text>

      {/* "group" Text in bold green */}
      <text 
        x="50" 
        y="65" 
        fill="#009639" 
        fontFamily="'Arial', 'Inter', sans-serif" 
        fontWeight="bold" 
        fontSize="20" 
        letterSpacing="-0.5"
        textAnchor="middle"
      >
        group
      </text>
    </svg>
  );
}

interface PublicSearchProps {
  onAdminClick: () => void;
}

export default function PublicSearch({ onAdminClick }: PublicSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showResultsDropdown, setShowResultsDropdown] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [recentBatches, setRecentBatches] = useState<Batch[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Handle browser back/close with confirmation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Handle back button with custom popup
  useEffect(() => {
    const handlePopState = () => {
      setShowExitModal(true);
      // Push state again to stay on page until user confirms
      window.history.pushState(null, "", window.location.href);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Fetch recent 10 batches on mount
  useEffect(() => {
    fetchRecent();
  }, []);

  const fetchRecent = async () => {
    setLoadingRecent(true);
    try {
      const res = await fetch("/api/batches");
      if (res.ok) {
        const data = await res.json();
        setRecentBatches(data.slice(0, 10));
      }
    } catch (err) {
      console.error("Error fetching recent batches:", err);
    } finally {
      setLoadingRecent(false);
    }
  };

  // Monitor scroll for Go to Top system
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleGoHome = () => {
    setSearchQuery("");
    setSelectedBatch(null);
    setSearchResults([]);
    setShowResultsDropdown(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Perform search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResultsDropdown(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/batches?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowResultsDropdown(true);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Fetch single batch detail
  const handleSelectBatch = async (batchId: number) => {
    setLoadingDetail(true);
    setShowResultsDropdown(false);
    try {
      const res = await fetch(`/api/batches/${batchId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedBatch(data);
      }
    } catch (err) {
      console.error("Error fetching batch details:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const stageKeys: StageKey[] = ["wet", "finish", "shade", "quality", "rfd", "delivered"];
  const stageLabels: Record<StageKey, string> = {
    wet: "Wet",
    dry: "Dry",
    finish: "Finish",
    shade: "Shade",
    quality: "Quality",
    rfd: "RFD",
    delivered: "Delivered",
  };

  // Render stage dots (7 dots)
  const renderDots = (batch: Batch) => {
    return (
      <div className="flex gap-1.5 items-center">
        {stageKeys.map((key) => {
          const status = batch.stages?.[key] || "pending";
          let dotColor = "bg-gray-200 dark:bg-slate-700";
          if (status === "completed") dotColor = "bg-emerald-500";
          else if (status === "running") dotColor = "bg-amber-500 animate-pulse";
          else if (status === "hold") dotColor = "bg-rose-500";

          return (
            <span
              key={key}
              title={`${stageLabels[key]}: ${getStatusLabel(status)}`}
              className={`w-3.5 h-3.5 rounded-full border border-white dark:border-slate-950 ${dotColor}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen glass-bg text-slate-100 flex flex-col font-sans pb-12 relative overflow-hidden">
      {/* Decorative Glow Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <header className="no-print relative z-10 w-full max-w-7xl mx-auto px-4 py-5 flex justify-between items-center border-b border-white/10">
        <button
          onClick={handleGoHome}
          className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-xl p-1 transition hover:opacity-90 cursor-pointer"
        >
          <IrisLogo className="w-12 h-12 shrink-0 shadow-lg" />
          <div>
            <h1 className="text-lg md:text-xl font-display font-bold tracking-tight text-white uppercase">
              Iris Fabrics Ltd
            </h1>
          </div>
        </button>
        <button
          onClick={onAdminClick}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass-button-secondary transition duration-200 text-sm font-medium shadow-sm cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-indigo-400" />
          <span>Admin</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-4 mt-8 md:mt-12 flex-1">
        
        {/* Global Search Bar */}
        <div className="no-print relative mb-12 max-w-2xl mx-auto">
          <form autoComplete="off" onSubmit={(e) => e.preventDefault()} className="relative group shadow-2xl rounded-2xl">
            <input type="text" name="dummy" autoComplete="off" style={{display: "none"}} aria-hidden="true" />
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              {loading ? (
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              ) : (
                <Search className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-400 transition" />
              )}
            </div>
            <input
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name="x"
              placeholder="Enter Buyer, Batch, Ref"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-4 rounded-2xl glass-input placeholder-slate-500 font-sans focus:outline-none shadow-inner"
            />
          </form>

          {/* Instant Dropdown Results */}
          {showResultsDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 glass-card rounded-2xl shadow-2xl p-2 z-50 divide-y divide-white/10 overflow-hidden max-h-80 overflow-y-auto">
              {searchResults.map((batch) => (
                <button
                  key={batch.id}
                  onClick={() => handleSelectBatch(batch.id)}
                  className="w-full text-left px-4 py-3 flex justify-between items-center hover:bg-white/5 transition rounded-xl cursor-pointer"
                >
                  <div>
                    <div className="font-display font-semibold text-white">{batch.batch_number}</div>
                    <div className="text-xs text-slate-400">
                      Ref: {batch.buyer_reference} • Buyer: {batch.buyer}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {renderDots(batch)}
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {showResultsDropdown && searchQuery.trim().length >= 2 && searchResults.length === 0 && !loading && (
            <div className="absolute top-full left-0 right-0 mt-2 glass-card rounded-2xl shadow-2xl p-5 z-50 text-center text-slate-400 text-sm">
              No matching production records found. Verify the batch number.
            </div>
          )}
        </div>

        {/* Loading details */}
        {loadingDetail && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="ml-3 text-slate-400 text-sm font-mono">Retrieving timeline info...</span>
          </div>
        )}

        {/* Selected Batch Detailed Timeline View */}
        {selectedBatch && !loadingDetail && (
          <div className="glass-card overflow-hidden mb-12 slide-in">
            {/* Batch Header Card (Stunning design showing all fabric details) */}
            <div className="p-6 md:p-8 bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border-b border-white/10">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                  <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">Active Production Batch</div>
                  <h3 className="text-3xl md:text-4xl font-display font-black text-white mt-1 tracking-tight drop-shadow-md">
                    {selectedBatch.batch_number}
                  </h3>
                </div>

                {/* Overall Status Badge */}
                <div className="flex flex-col lg:items-end">
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Overall Status</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      selectedBatch.stages?.delivered === "completed" ? "bg-emerald-500 animate-pulse" :
                      selectedBatch.stages_list?.some((s) => s.status === "hold") ? "bg-rose-500 animate-ping" :
                      selectedBatch.stages_list?.some((s) => s.status === "running") ? "bg-amber-500 animate-pulse" : "bg-slate-400"
                    }`} />
                    <span className="text-lg font-display font-bold text-white">
                      {selectedBatch.stages?.delivered === "completed" ? "Delivered" :
                       selectedBatch.stages_list?.some((s) => s.status === "hold") ? "On Hold" :
                       selectedBatch.stages_list?.some((s) => s.status === "running") ? "In Production" : "Queued"}
                    </span>
                  </div>
                  {selectedBatch.rework_count > 0 && (
                    <span className="mt-1.5 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase tracking-wider">
                      Reprocessed {selectedBatch.rework_count}x ({selectedBatch.rework_type})
                    </span>
                  )}
                </div>
              </div>

              {/* Header Metadata Grid: buyer, ref, color, fabric type, qty, trims, trims qty */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                {/* Buyer */}
                <div className="p-2">
                  <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Buyer</div>
                  <div className="text-sm font-semibold text-white mt-0.5 truncate" title={selectedBatch.buyer || "—"}>
                    {selectedBatch.buyer || "—"}
                  </div>
                </div>

                {/* Ref */}
                <div className="p-2 border-l border-white/5 pl-4 sm:pl-2">
                  <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Ref</div>
                  <div className="text-sm font-semibold text-indigo-300 mt-0.5 truncate" title={selectedBatch.buyer_reference || "—"}>
                    {selectedBatch.buyer_reference || "—"}
                  </div>
                </div>

                {/* Color */}
                <div className="p-2 border-l border-white/5 pl-4 sm:pl-2">
                  <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Color</div>
                  <div className="text-sm font-semibold text-slate-300 mt-0.5 truncate" title={selectedBatch.color || "—"}>
                    {selectedBatch.color || "—"}
                  </div>
                </div>

                {/* Fabric Type */}
                <div className="p-2 border-l border-white/5 pl-4 sm:pl-2">
                  <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Fabric Type</div>
                  <div className="mt-0.5">
                    <span className={`inline-block max-w-full truncate px-2 py-0.5 rounded-md text-[10px] font-bold border ${getFabricBadgeClass(selectedBatch.badge_color || "secondary")}`} title={getBatchBadgeText(selectedBatch)}>
                      {getBatchBadgeText(selectedBatch)}
                    </span>
                  </div>
                </div>

                {/* Qty (Fabric Weight) */}
                <div className="p-2 border-l border-white/5 pl-4 sm:pl-2">
                  <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Fabric Qty</div>
                  <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5 truncate">
                    {selectedBatch.fabric_quantity ? `${selectedBatch.fabric_quantity} KG` : "—"}
                  </div>
                </div>

                {/* Trims */}
                <div className="p-2 border-l border-white/5 pl-4 sm:pl-2">
                  <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Trims</div>
                  <div className="text-sm font-semibold text-amber-300 mt-0.5 truncate" title={selectedBatch.trims || "—"}>
                    {selectedBatch.trims || "—"}
                  </div>
                </div>

                {/* Trims Qty */}
                <div className="p-2 border-l border-white/5 pl-4 sm:pl-2">
                  <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Trims Qty</div>
                  <div className="text-sm font-mono font-bold text-amber-400 mt-0.5 truncate" title={selectedBatch.trims_quantity || "—"}>
                    {selectedBatch.trims_quantity || "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Production Progress Step Bar */}
            <div className="p-6 md:p-8 border-b border-white/10 bg-white/5">
              <h4 className="text-sm font-display font-bold text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Production Timeline</span>
              </h4>

              {/* Interactive Timeline Stepper */}
              <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-0 mt-4 px-2">
                {/* Connecting Line (Desktop) */}
                <div className="hidden md:block absolute left-4 right-4 top-[17px] h-0.5 bg-white/10 z-0" />

                {stageKeys.map((key, index) => {
                  const status = selectedBatch.stages?.[key] || "pending";
                  const label = stageLabels[key];

                  // Color mapping
                  let circleStyle = "bg-slate-900 border-white/10 text-slate-500";
                  let textStyle = "text-slate-500";

                  if (status === "completed") {
                    circleStyle = "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/30";
                    textStyle = "text-emerald-400 font-semibold";
                  } else if (status === "running") {
                    circleStyle = "bg-amber-500 border-amber-400 text-white animate-pulse shadow-lg shadow-amber-500/30";
                    textStyle = "text-amber-400 font-semibold";
                  } else if (status === "hold") {
                    circleStyle = "bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-500/30 animate-bounce";
                    textStyle = "text-rose-400 font-semibold";
                  }

                  return (
                    <div key={key} className="relative z-10 flex md:flex-col items-center gap-3 md:gap-2 md:w-24">
                      {/* Circle Number */}
                      <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-mono ${circleStyle}`}>
                        {index + 1}
                      </div>
                      {/* Stage Info */}
                      <div className="flex flex-col md:items-center text-left md:text-center">
                        <span className={`text-xs md:text-sm font-medium ${textStyle}`}>{label}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {status === "completed" ? "Done" : status === "running" ? "Running" : status === "hold" ? "HOLD" : "Pending"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quality, Shade, Delivery and Process Loss specifications */}
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white/2">
              {/* Left Column: Complete Fabric & Production Specifications */}
              <div className="space-y-6">
                {/* Delivery details panel (replaces old shade/quality panels) */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-xl bg-white/[0.02]">
                  <h4 className="text-sm font-display font-bold text-slate-200 uppercase tracking-wider mb-4 pb-3 border-b border-white/10 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span>Delivery to</span>
                  </h4>
                  {selectedBatch.delivery_date ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span className="text-xs text-slate-400 font-mono">Delivery Date</span>
                        <span className="text-sm font-bold text-indigo-300 font-mono">{formatDate(selectedBatch.delivery_date)}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span className="text-xs text-slate-400 font-mono">Delivery Qty</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md">
                          {selectedBatch.delivery_qty === "N/A" ? "N/A" : `${selectedBatch.delivery_qty} KG`}
                        </span>
                      </div>
                      {selectedBatch.delivery_remarks && (
                        <div className="pt-2">
                          <span className="text-xs text-slate-400 font-mono block mb-1">Remarks</span>
                          <div className="text-xs text-slate-300 italic bg-slate-950/30 p-3 rounded-xl border border-white/10">
                            "{selectedBatch.delivery_remarks}"
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-500 text-sm italic">
                      Batch not yet dispatched or delivery not scheduled.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Trims Breakdown & Advanced Process Loss Calculations */}
              <div className="space-y-6">
                <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-xl bg-white/[0.02]">
                  <h4 className="text-sm font-display font-bold text-slate-200 uppercase tracking-wider mb-5 pb-3 border-b border-white/10 flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>Trims Process Loss Analytics</span>
                  </h4>

                  {selectedBatch.stages?.delivered === "completed" ? (
                    <>
                      {/* Summary Metric card */}
                      <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border border-indigo-500/15 p-5 rounded-2xl mb-6 shadow-inner">
                        <div className="text-[11px] text-indigo-300 uppercase font-mono tracking-wider">Overall Trims Process Loss</div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <div className="text-3xl font-display font-black text-white">
                            {calcLossParts(selectedBatch.trims_quantity, selectedBatch.delivery_qty, selectedBatch.trims).text.split(" (")[0]}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            (Calculated from Trims Qty)
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1 font-mono pt-2 border-t border-white/5">
                          <div>Input Trims: <strong className="text-slate-200">{selectedBatch.trims_quantity || "N/A"}</strong></div>
                          <div>Delivered: <strong className="text-emerald-400">{selectedBatch.delivery_qty || "N/A"}</strong></div>
                        </div>
                      </div>

                      {/* Itemized Trims Breakdown List */}
                      <div>
                        <h5 className="text-xs text-slate-300 uppercase font-mono tracking-wider mb-3">Itemized Breakdown & Formula Details</h5>
                        
                        {(() => {
                          const trimsNames = selectedBatch.trims ? selectedBatch.trims.split("+").map(s => s.trim()) : [];
                          const trimsQtys = selectedBatch.trims_quantity ? selectedBatch.trims_quantity.split("+").map(s => s.trim()) : [];
                          const deliveryQtys = selectedBatch.delivery_qty ? selectedBatch.delivery_qty.split("+").map(s => s.trim()) : [];

                          const maxParts = Math.max(trimsNames.length, trimsQtys.length);
                          
                          if (maxParts === 0) {
                            return (
                              <div className="text-center py-4 text-xs text-slate-500 bg-white/5 rounded-xl border border-white/5">
                                No Trims specifications found for this batch.
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {Array.from({ length: maxParts }).map((_, i) => {
                                const name = trimsNames[i] || `Trim Item ${i + 1}`;
                                const inputQtyStr = trimsQtys[i] || "0";
                                const inputQty = parseFloat(inputQtyStr) || 0;
                                const delQtyStr = deliveryQtys[i] || "0";
                                const delQty = parseFloat(delQtyStr) || 0;

                                const lossQty = Math.max(0, inputQty - delQty);
                                const lossPct = inputQty > 0 ? (lossQty / inputQty) * 100 : 0;

                                return (
                                  <div key={i} className="p-4 bg-white/[0.03] hover:bg-white/[0.05] transition rounded-xl border border-white/5">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <div className="text-xs font-bold text-white font-sans">{name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                          Formula: <span className="text-amber-400">{inputQty}</span> - <span className="text-emerald-400">{delQty}</span> = <span className="text-rose-400">{lossQty.toFixed(1)} loss</span>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-black font-mono text-rose-400">{lossPct.toFixed(1)}%</div>
                                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Process Loss</div>
                                      </div>
                                    </div>

                                    {/* Modern Progress Bar comparing Input vs Delivered */}
                                    <div className="mt-2.5">
                                      <div className="flex justify-between text-[9px] text-slate-500 font-mono mb-1">
                                        <span>Delivered: {delQty}</span>
                                        <span>Input: {inputQty}</span>
                                      </div>
                                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex">
                                        <div 
                                          className="bg-emerald-500 h-full rounded-l-full transition-all" 
                                          style={{ width: `${inputQty > 0 ? Math.min(100, (delQty / inputQty) * 100) : 0}%` }} 
                                        />
                                        <div 
                                          className="bg-rose-500/80 h-full rounded-r-full transition-all" 
                                          style={{ width: `${inputQty > 0 ? Math.min(100, (lossQty / inputQty) * 100) : 0}%` }} 
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center bg-slate-950/20 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-3">
                      <Clock className="w-10 h-10 text-amber-500 animate-pulse" />
                      <span className="text-sm font-bold text-slate-300 font-mono">Delivery Pending</span>
                      <p className="text-[11px] text-slate-500 px-6 leading-relaxed max-w-sm">
                        Process loss calculations and formulas will be available once the batch delivery is completed.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Remarks Footer Tag Panel */}
            {selectedBatch.remarks && (
              <div className="p-6 bg-slate-950/40 border-t border-white/10 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold">
                  Requirement: {selectedBatch.remarks}
                </span>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Recent 10 Batches Section */}
      <section className="no-print w-full max-w-4xl mx-auto px-4 mt-12 mb-16">
        <h3 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 text-emerald-400 ${loadingRecent ? "animate-spin" : ""}`} />
          <span>Last Updated</span>
        </h3>

        {loadingRecent ? (
          <div className="flex justify-center items-center py-10 glass-card rounded-2xl border border-white/5 bg-white/[0.02]">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : recentBatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentBatches.map((batch) => {
              const isHold = batch.stages_list?.some((s) => s.status === "hold");
              const isDone = batch.stages?.delivered === "completed";

              return (
                <div
                  key={batch.id}
                  onClick={() => handleSelectBatch(batch.id)}
                  className="p-5 glass-card glass-card-hover cursor-pointer flex justify-between items-center group rounded-2xl border border-white/5 bg-white/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex gap-2 items-center">
                      <span className="text-white font-display font-bold text-base group-hover:text-indigo-400 transition">
                        {batch.batch_number}
                      </span>
                      <span className={`px-2 py-0.2 text-[9px] font-bold rounded-md border ${getFabricBadgeClass(batch.badge_color || "secondary")}`}>
                        {getBatchBadgeText(batch)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      {batch.buyer} • Ref: {batch.buyer_reference}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Updated {timeAgo(batch.updated_at)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 ml-4">
                    {renderDots(batch)}
                    <span className={`text-[10px] font-semibold tracking-wider uppercase ${isDone ? "text-emerald-400" : isHold ? "text-rose-400 animate-pulse" : "text-amber-400"}`}>
                      {isDone ? "Delivered" : isHold ? "Hold Defect" : "In Progress"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center p-8 glass-card text-slate-400 text-sm rounded-2xl border border-white/5 bg-white/[0.02]">
            No active batches are registered. Click Admin to setup and add batch records.
          </div>
        )}
      </section>

      {/* Go to Top Floating Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="no-print fixed bottom-6 right-6 z-50 bg-slate-800/90 hover:bg-slate-700/95 text-white p-4 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 border border-white/10 group cursor-pointer animate-fade-in"
          title="Scroll to Top"
        >
          <ArrowUp className="w-5 h-5 text-indigo-300 group-hover:text-indigo-200" />
        </button>
      )}

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-lg font-display font-bold text-white mb-2">Leave Iris Fabrics?</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Are you sure you want to close this page?
              </p>
            </div>
            <div className="flex border-t border-white/10 divide-x divide-white/10">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-4 text-sm font-semibold text-slate-300 hover:bg-white/5 transition cursor-pointer"
              >
                Stay
              </button>
              <button
                onClick={() => { window.location.href = "about:blank"; }}
                className="flex-1 py-4 text-sm font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Relative helper inline
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
