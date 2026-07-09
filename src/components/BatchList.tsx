/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Search, SlidersHorizontal, Trash2, Edit2, ChevronDown, Check, X, Loader2, Info, Eye,
  Settings2, Calendar, Tag, Package, Sliders, MoreHorizontal, Truck, ArrowUp
} from "lucide-react";
import { Batch, StageKey, StageStatus, FabricType } from "../types";
import { getStatusDotClass, getStatusLabel, getFabricBadgeClass, formatDate } from "../utils";
import { AdminPanel } from "./Navbar";
import { useOfflineSync } from "../hooks/useOfflineSync";

interface BatchListProps {
  token: string;
  onEditBatch: (id: number) => void;
  onNavigate: (panel: AdminPanel) => void;
  onViewProduction?: (id: number) => void;
}

export default function BatchList({ token, onEditBatch, onNavigate, onViewProduction }: BatchListProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useOfflineSync(() => {
    fetchBatches();
    fetchFilters();
  });
  
  // Available filter values
  const [filterOpts, setFilterOpts] = useState<{
    buyers: string[];
    refs: string[];
    colors: string[];
    trims: string[];
    fabrics: { id: number; name: string }[];
  }>({ buyers: [], refs: [], colors: [], trims: [], fabrics: [] });

  // Selected filters
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedTrims, setSelectedTrims] = useState<string[]>([]);
  const [selectedFabrics, setSelectedFabrics] = useState<number[]>([]);

  // Filter dropdown state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Actions popup state
  const [selectedBatchForActions, setSelectedBatchForActions] = useState<Batch | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
          alert(`Batch ${batch.batch_number} delivered successfully!`);
        } catch (e) {
          console.log("Alert blocked inside sandboxed iframe:", e);
        }
        fetchBatches();
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

  const [deliverConfirmId, setDeliverConfirmId] = useState<number | null>(null);

  const handleDeliver = async (batch: Batch) => {
    if (deliverConfirmId !== batch.id) {
      setDeliverConfirmId(batch.id);
      setTimeout(() => {
        setDeliverConfirmId((prev) => (prev === batch.id ? null : prev));
      }, 3000);
      return;
    }
    setDeliverConfirmId(null);

    const hasTrims = !!(batch.trims && batch.trims.trim() !== "" && batch.trims.trim().toLowerCase() !== "n/a" && batch.trims.trim().toLowerCase() !== "none");
    if (hasTrims) {
      await executeBodyDeliverDirectly(batch);
    } else {
      await executeQuickDeliverDirectly(batch);
    }
  };

  const [bodyDeliveringId, setBodyDeliveringId] = useState<number | null>(null);

  const executeBodyDeliverDirectly = async (batch: Batch) => {
    setBodyDeliveringId(batch.id);
    try {
      const res = await fetch("/api/delivery/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          batch_id: batch.id,
          body_delivered: true,
          delivery_remarks: "Body Delivered (Trims Pending)",
        }),
      });

      if (res.ok) {
        try {
          alert(`Body fabric for Batch ${batch.batch_number} marked delivered!`);
        } catch (e) {
          console.log("Alert blocked inside sandboxed iframe:", e);
        }
        fetchBatches();
      } else {
        const err = await res.json();
        try {
          alert(err.error || "Failed to deliver body fabric.");
        } catch (e) {
          console.log("Alert blocked inside sandboxed iframe:", e);
        }
      }
    } catch (err) {
      console.error("Body deliver error:", err);
      try {
        alert("Failed to deliver body fabric due to connection error.");
      } catch (e) {
        console.log("Alert blocked inside sandboxed iframe:", e);
      }
    } finally {
      setBodyDeliveringId(null);
    }
  };


  const [showScrollTop, setShowScrollTop] = useState(false);

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

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [selectedBuyers, selectedRefs, selectedColors, selectedTrims, selectedFabrics, debouncedSearch]);

  const fetchFilters = async () => {
    try {
      const res = await fetch("/api/batches/filters");
      if (res.ok) {
        const data = await res.json();
        setFilterOpts(data);
      }
    } catch (err) {
      console.error("Error loading filter lists:", err);
    }
  };

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("q", debouncedSearch);
      if (selectedBuyers.length > 0) params.append("buyer", selectedBuyers.join(","));
      if (selectedRefs.length > 0) params.append("ref", selectedRefs.join(","));
      if (selectedColors.length > 0) params.append("color", selectedColors.join(","));
      if (selectedTrims.length > 0) params.append("trims", selectedTrims.join(","));
      if (selectedFabrics.length > 0) params.append("fabric", selectedFabrics.join(","));

      const res = await fetch(`/api/batches?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data);
      }
    } catch (err) {
      console.error("Error loading batches:", err);
    } finally {
      setLoading(false);
    }
  };

  const executeDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/batches/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        fetchBatches();
        fetchFilters();
        return true;
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete batch.");
        return false;
      }
    } catch (err) {
      console.error("Delete error:", err);
      return false;
    }
  };

  const toggleFilter = <T extends string | number>(
    list: T[],
    setList: React.Dispatch<React.SetStateAction<T[]>>,
    value: T
  ) => {
    if (list.includes(value)) {
      setList(list.filter((x) => x !== value));
    } else {
      setList([...list, value]);
    }
  };

  const clearAllFilters = () => {
    setSelectedBuyers([]);
    setSelectedRefs([]);
    setSelectedColors([]);
    setSelectedTrims([]);
    setSelectedFabrics([]);
    setSearch("");
  };

  const stageKeys: StageKey[] = ["wet", "dry", "finish", "shade", "quality", "rfd", "delivered"];
  const stageLabels: Record<StageKey, string> = {
    wet: "Wet",
    dry: "Dry",
    finish: "Finish",
    shade: "Shade",
    quality: "Quality",
    rfd: "RFD",
    delivered: "Delivered",
  };

  // Process Remarks click-tag visualizer helper
  const renderRemarksBadges = (remarks: string | null) => {
    if (!remarks) return null;
    const r = remarks.toUpperCase();
    const badges: React.ReactNode[] = [];

    if (r.includes("AOP")) {
      badges.push(
        <span key="aop" className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/30 font-bold text-[9px] tracking-wide">
          AOP
        </span>
      );
    }
    if (r.includes("BRUSH")) {
      badges.push(
        <span key="brush" className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 font-bold text-[9px] tracking-wide">
          BRUSH
        </span>
      );
    }
    if (r.includes("PEACH")) {
      badges.push(
        <span key="peach" className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 font-bold text-[9px] tracking-wide">
          PEACH
        </span>
      );
    }
    if (r.includes("SOLID")) {
      badges.push(
        <span key="solid" className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 font-bold text-[9px] tracking-wide">
          SOLID
        </span>
      );
    }
    if (r.includes("RIB")) {
      badges.push(
        <span key="rib" className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 font-bold text-[9px] tracking-wide">
          RIB
        </span>
      );
    }
    if (r.includes("FT")) {
      badges.push(
        <span key="ft" className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900/30 font-bold text-[9px] tracking-wide">
          FT
        </span>
      );
    }

    if (badges.length === 0) {
      return <span className="text-slate-400 text-[11px] truncate max-w-[120px] block">{remarks}</span>;
    }

    return <div className="flex flex-wrap gap-1 mt-0.5">{badges}</div>;
  };

  // Render 7-dots timeline indicator
  const renderProgressDots = (batch: Batch) => {
    return (
      <div className="flex gap-1 items-center">
        {stageKeys.map((key) => {
          const status = batch.stages?.[key] || "pending";
          let dotColor = "bg-slate-200 dark:bg-slate-700";
          if (status === "completed") dotColor = "bg-emerald-500";
          else if (status === "running") dotColor = "bg-amber-500 animate-pulse";
          else if (status === "hold") dotColor = "bg-rose-500";

          return (
            <span
              key={key}
              title={`${stageLabels[key]}: ${getStatusLabel(status)}`}
              className={`w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900 ${dotColor}`}
            />
          );
        })}
      </div>
    );
  };

  // Check if any filter is active
  const hasActiveFilters = 
    selectedBuyers.length > 0 || 
    selectedRefs.length > 0 || 
    selectedColors.length > 0 || 
    selectedTrims.length > 0 || 
    selectedFabrics.length > 0 ||
    search.trim() !== "";

  return (
    <div className="space-y-4 md:space-y-6">
      
      {/* Search & Filters Card */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 md:p-5 rounded-2xl shadow-sm space-y-3 md:space-y-4">
        
        {/* Row 1: Search & Reset */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:max-w-md group">
            <input
              type="text"
              placeholder="Search by Batch No, Buyer, Ref..."
              autoComplete="one-time-code"
              data-lpignore="true"
              name="search_input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 text-sm transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 group-focus-within:text-indigo-500" />
          </div>

          <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-500 text-sm font-semibold transition"
              >
                <X className="w-4 h-4" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Custom Dropdown Multi-Selects */}
        <div className="flex flex-wrap gap-2.5">
          
          {/* 1. Buyer Selector */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === "buyer" ? null : "buyer")}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
                selectedBuyers.length > 0 
                  ? "bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-400" 
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>Buyer {selectedBuyers.length > 0 ? `(${selectedBuyers.length})` : ""}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {activeDropdown === "buyer" && filterOpts.buyers.length > 0 && (
              <div className="absolute left-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-40 max-h-56 overflow-y-auto space-y-0.5">
                {filterOpts.buyers.map((b) => {
                  const checked = selectedBuyers.includes(b);
                  return (
                    <label key={b} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFilter(selectedBuyers, setSelectedBuyers, b)}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{b}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Buyer Reference Selector */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === "ref" ? null : "ref")}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
                selectedRefs.length > 0 
                  ? "bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-400" 
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>Ref {selectedRefs.length > 0 ? `(${selectedRefs.length})` : ""}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {activeDropdown === "ref" && filterOpts.refs.length > 0 && (
              <div className="absolute left-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-40 max-h-56 overflow-y-auto space-y-0.5">
                {filterOpts.refs.map((r) => {
                  const checked = selectedRefs.includes(r);
                  return (
                    <label key={r} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFilter(selectedRefs, setSelectedRefs, r)}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{r}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Color Selector */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === "color" ? null : "color")}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
                selectedColors.length > 0 
                  ? "bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-400" 
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>Color {selectedColors.length > 0 ? `(${selectedColors.length})` : ""}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {activeDropdown === "color" && filterOpts.colors.length > 0 && (
              <div className="absolute left-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-40 max-h-56 overflow-y-auto space-y-0.5">
                {filterOpts.colors.map((c) => {
                  const checked = selectedColors.includes(c);
                  return (
                    <label key={c} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFilter(selectedColors, setSelectedColors, c)}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{c}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Fabric Selector */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === "fabric" ? null : "fabric")}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
                selectedFabrics.length > 0 
                  ? "bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-400" 
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>Fabric Type {selectedFabrics.length > 0 ? `(${selectedFabrics.length})` : ""}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {activeDropdown === "fabric" && filterOpts.fabrics.length > 0 && (
              <div className="absolute left-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-40 max-h-56 overflow-y-auto space-y-0.5">
                {filterOpts.fabrics.map((f) => {
                  const checked = selectedFabrics.includes(f.id);
                  return (
                    <label key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFilter(selectedFabrics, setSelectedFabrics, f.id)}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{f.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Trims Selector */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === "trims" ? null : "trims")}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
                selectedTrims.length > 0 
                  ? "bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-400" 
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span>Trims {selectedTrims.length > 0 ? `(${selectedTrims.length})` : ""}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {activeDropdown === "trims" && filterOpts.trims.length > 0 && (
              <div className="absolute left-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-40 max-h-56 overflow-y-auto space-y-0.5">
                {filterOpts.trims.map((t) => {
                  const checked = selectedTrims.includes(t);
                  return (
                    <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFilter(selectedTrims, setSelectedTrims, t)}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{t}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Batches Table Card */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
            <span className="ml-2 text-slate-500 text-sm font-mono">Loading production batches...</span>
          </div>
        ) : batches.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse align-middle">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-400 font-mono tracking-wider bg-slate-50/50 dark:bg-slate-950/20">
                    <th className="px-6 py-4">Batch Number</th>
                    <th className="px-6 py-4">Buyer & Ref</th>
                    <th className="px-6 py-4">Color</th>
                    <th className="px-6 py-4">Fabric & Qty</th>
                    <th className="px-6 py-4">Trims & Qty</th>
                    <th className="px-6 py-4">Timeline Progress</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {batches.map((batch) => {
                    return (
                      <tr
                        key={batch.id}
                        onClick={() => setSelectedBatchForActions(batch)}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 cursor-pointer group transition-colors"
                      >
                        {/* Batch ID and Code */}
                        <td className="px-6 py-4.5">
                          <span className="font-display font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {batch.batch_number}
                          </span>
                          {renderRemarksBadges(batch.remarks)}
                        </td>

                        {/* Buyer and Reference */}
                        <td className="px-6 py-4.5">
                          <div className="text-slate-800 dark:text-slate-200 font-semibold">{batch.buyer}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{batch.buyer_reference}</div>
                        </td>

                        {/* Color */}
                        <td className="px-6 py-4.5">
                          <span className="font-mono text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {batch.color || "SOLID WHITE"}
                          </span>
                        </td>

                        {/* Fabric Type & Qty */}
                        <td className="px-6 py-4.5">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border inline-block ${getFabricBadgeClass(batch.badge_color || "secondary")}`}>
                            {batch.fabric_type_name}
                          </span>
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                            {batch.fabric_quantity ? `${batch.fabric_quantity.toFixed(2)} KG` : "N/A"}
                          </div>
                          {batch.body_delivered ? (
                            <div className="text-[10px] text-teal-600 dark:text-teal-400 font-bold font-mono mt-0.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                              Body Delivered ({formatDate(batch.body_delivery_date)})
                            </div>
                          ) : batch.delivery_date ? (
                            <div className="text-[10px] text-emerald-500 font-mono mt-0.5">
                              Delivered: {formatDate(batch.delivery_date)}
                            </div>
                          ) : null}
                        </td>

                        {/* Trims Type & Qty */}
                        <td className="px-6 py-4.5">
                          {batch.trims && batch.trims.trim() !== "" && batch.trims.trim().toLowerCase() !== "n/a" && batch.trims.trim().toLowerCase() !== "none" ? (
                            <>
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block max-w-[140px] truncate" title={batch.trims}>
                                {batch.trims}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono block">
                                Qty: {batch.trims_quantity || "N/A"}
                              </span>
                              {batch.trims_delivered && (
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold font-mono mt-0.5 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Trims Delivered ({formatDate(batch.trims_delivery_date)})
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400 text-xs italic">No trims</span>
                          )}
                        </td>

                        {/* Stages Dots Timeline */}
                        <td className="px-6 py-4.5">
                          {renderProgressDots(batch)}
                          <div className="text-[10px] text-slate-400 font-mono mt-1 flex gap-2 items-center">
                            <span>
                              Done: {batch.stages_list?.filter((s) => s.status === "completed").length}/7
                            </span>
                            {batch.rework_count > 0 && (
                              <span className="text-rose-400 font-semibold uppercase">
                                REWORK {batch.rework_count}X
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions Trigger Button */}
                        <td className="px-6 py-4.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end items-center gap-2">
                            {/* Unified Deliver Button */}
                            {(() => {
                              const hasTrims = !!(batch.trims && batch.trims.trim() !== "" && batch.trims.trim().toLowerCase() !== "n/a" && batch.trims.trim().toLowerCase() !== "none");
                              const canDeliver = batch.stages?.delivered !== "completed" && (!hasTrims || !batch.body_delivered);
                              const isDelivering = quickDeliveringId === batch.id || bodyDeliveringId === batch.id;
                              
                              if (!canDeliver) return null;

                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeliver(batch);
                                  }}
                                  disabled={isDelivering}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition shadow-sm text-white ${
                                    deliverConfirmId === batch.id 
                                      ? "bg-amber-500 hover:bg-amber-600 animate-pulse" 
                                      : "bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400"
                                  }`}
                                  title={deliverConfirmId === batch.id ? "Click again to confirm delivery" : (hasTrims ? "Deliver Body (Trims Pending)" : "Deliver Batch")}
                                >
                                  {isDelivering ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Truck className="w-3.5 h-3.5" />
                                  )}
                                  <span>{deliverConfirmId === batch.id ? "Confirm?" : "Deliver"}</span>
                                </button>
                              );
                            })()}

                            <button
                              onClick={() => setSelectedBatchForActions(batch)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition shadow-sm bg-white dark:bg-slate-900 group"
                              title="Manage Batch"
                            >
                              <Settings2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors group-hover:rotate-45 duration-300" />
                              <span>Manage</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (Replaces horizontal scroll table on small screens, removes extra padding) */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
              {batches.map((batch) => {
                const isDelivered = batch.stages?.delivered === "completed";
                const doneStages = batch.stages_list?.filter((s) => s.status === "completed").length || 0;
                return (
                  <div 
                    key={batch.id}
                    onClick={() => setSelectedBatchForActions(batch)}
                    className="p-4 space-y-3.5 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 cursor-pointer active:bg-slate-100/50 dark:active:bg-slate-800/30 transition-all duration-150"
                  >
                    {/* Top Row: Batch No, Buyer, and Fabric Type */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-display font-black text-slate-900 dark:text-white text-base tracking-tight hover:text-indigo-500 transition-colors">
                          {batch.batch_number}
                        </span>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{batch.buyer}</span>
                          <span className="inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                          <span className="font-mono text-indigo-500 dark:text-indigo-400 font-semibold">{batch.buyer_reference}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg border leading-none ${getFabricBadgeClass(batch.badge_color || "secondary")}`}>
                          {batch.fabric_type_name}
                        </span>
                        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border border-slate-200/50 dark:border-slate-700/50 leading-none">
                          {batch.color || "SOLID WHITE"}
                        </span>
                      </div>
                    </div>

                    {/* Remarks Tag indicator */}
                    {batch.remarks && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-mono uppercase shrink-0">Remarks:</span>
                        {renderRemarksBadges(batch.remarks)}
                      </div>
                    )}

                    {/* Middle Row: Grid stats */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs font-mono">
                      <div>
                        <div className="text-[9px] text-slate-400 uppercase tracking-wider">Fabric Weight</div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                          <span>{batch.fabric_quantity ? `${batch.fabric_quantity.toFixed(2)} KG` : "N/A"}</span>
                          {batch.body_delivered && (
                            <span className="inline-flex w-2 h-2 rounded-full bg-teal-500" title="Body Delivered" />
                          )}
                        </div>
                        {batch.body_delivered ? (
                          <div className="text-[9px] text-teal-600 dark:text-teal-400 font-bold mt-1">
                            Body Delivered ({formatDate(batch.body_delivery_date)})
                          </div>
                        ) : batch.delivery_date ? (
                          <div className="text-[9px] text-emerald-500 mt-1">
                            Delivered: {formatDate(batch.delivery_date)}
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <div className="text-[9px] text-slate-400 uppercase tracking-wider">Trims Specs</div>
                        {batch.trims && batch.trims.trim() !== "" && batch.trims.trim().toLowerCase() !== "n/a" && batch.trims.trim().toLowerCase() !== "none" ? (
                          <div className="mt-0.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[120px]" title={batch.trims}>
                              {batch.trims}
                            </span>
                            <span className="text-[9px] text-slate-400 block">Qty: {batch.trims_quantity || "N/A"}</span>
                            {batch.trims_delivered && (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                Trims Delivered ({formatDate(batch.trims_delivery_date)})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px] block mt-0.5">No trims specs</span>
                        )}
                      </div>
                    </div>

                    {/* Progress dots row */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="flex items-center gap-2">
                        {renderProgressDots(batch)}
                        <span className="text-[10px] text-slate-400 font-mono font-bold">
                          {doneStages}/7 Stages
                        </span>
                      </div>

                      {batch.rework_count > 0 && (
                        <span className="text-rose-500 text-[9px] font-black font-mono bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-100 dark:border-rose-900/40 uppercase tracking-wider">
                          REWORK {batch.rework_count}X
                        </span>
                      )}
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="flex gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const hasTrims = !!(batch.trims && batch.trims.trim() !== "" && batch.trims.trim().toLowerCase() !== "n/a" && batch.trims.trim().toLowerCase() !== "none");
                        const canDeliver = batch.stages?.delivered !== "completed" && (!hasTrims || !batch.body_delivered);
                        const isDelivering = quickDeliveringId === batch.id || bodyDeliveringId === batch.id;
                        
                        if (!canDeliver) return null;

                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeliver(batch);
                            }}
                            disabled={isDelivering}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition duration-150 text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                              deliverConfirmId === batch.id 
                                ? "bg-amber-500 hover:bg-amber-600 animate-pulse" 
                                : "bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400"
                            }`}
                          >
                            {isDelivering ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Truck className="w-3.5 h-3.5" />
                            )}
                            <span>{deliverConfirmId === batch.id ? "Confirm?" : "Deliver"}</span>
                          </button>
                        );
                      })()}

                      <button
                        onClick={() => setSelectedBatchForActions(batch)}
                        className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition bg-white dark:bg-slate-900 flex items-center justify-center gap-1.5 font-bold text-xs cursor-pointer shadow-sm"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Manage Batch</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-12 text-center text-slate-400">
            <Info className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold">No batches matched your current search filters.</p>
            <p className="text-xs text-slate-500 mt-1">Try to clear the filters or search query.</p>
            <button
              onClick={clearAllFilters}
              className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>

      {/* Eye-catching Batch Actions Popup Modal */}
      {selectedBatchForActions && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300 animate-in fade-in"
          onClick={() => {
            setSelectedBatchForActions(null);
            setShowDeleteConfirm(false);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <button 
                onClick={() => {
                  setSelectedBatchForActions(null);
                  setShowDeleteConfirm(false);
                }}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <Settings2 className="w-6 h-6 animate-spin-slow" />
                </div>
                <div>
                  <span className="text-xs uppercase font-mono tracking-wider text-indigo-500 font-bold block mb-0.5">Production Command Center</span>
                  <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                    Batch: <span className="text-indigo-600 dark:text-indigo-400">{selectedBatchForActions.batch_number}</span>
                  </h3>
                </div>
              </div>
            </div>

            {/* Custom Interactive Contents: Option List or Delete Confirmation */}
            {showDeleteConfirm ? (
              <div className="p-6 space-y-4 animate-in fade-in duration-200">
                <div className="p-4 bg-rose-50 dark:bg-rose-950/25 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex gap-3">
                  <div className="p-2.5 h-fit rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/20">
                    <Trash2 className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-rose-400 text-sm">Delete Batch Permanent Warning</h4>
                    <p className="text-xs text-slate-500 dark:text-rose-300/80 mt-1 leading-relaxed">
                      Are you absolutely sure you want to delete Batch <strong className="font-mono text-rose-600 dark:text-rose-400 font-bold">{selectedBatchForActions.batch_number}</strong>? This action cannot be undone and will permanently erase all associated timeline records, rework logs, and production states.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const success = await executeDelete(selectedBatchForActions.id);
                      if (success) {
                        setSelectedBatchForActions(null);
                        setShowDeleteConfirm(false);
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-600/20"
                  >
                    Yes, Delete Permanent
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-3">
                {/* Quick 1-Click Deliver Option for batches with no trims */}
                {(() => {
                  const hasTrims = !!(selectedBatchForActions.trims && selectedBatchForActions.trims.trim() !== "" && selectedBatchForActions.trims.trim().toLowerCase() !== "n/a" && selectedBatchForActions.trims.trim().toLowerCase() !== "none");
                  const canDeliver = selectedBatchForActions.stages?.delivered !== "completed" && (!hasTrims || !selectedBatchForActions.body_delivered);
                  
                  if (!canDeliver) return null;

                  return (
                    <button
                      onClick={async () => {
                        const batchToDeliver = selectedBatchForActions;
                        setSelectedBatchForActions(null);
                        if (hasTrims) {
                          await executeBodyDeliverDirectly(batchToDeliver);
                        } else {
                          await executeQuickDeliverDirectly(batchToDeliver);
                        }
                      }}
                      className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/10 border border-teal-100 dark:border-teal-900/50 hover:bg-teal-100 dark:hover:bg-teal-950/20 text-left transition duration-200 group focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                    >
                      <div className="p-2.5 rounded-xl bg-teal-500 text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                        <Truck className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-800 dark:text-teal-300 text-sm group-hover:text-teal-950 dark:group-hover:text-teal-100 transition-colors flex items-center gap-1.5">
                          <span>Deliver Batch</span>
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {hasTrims 
                            ? "Mark body fabric delivered (Trims will go to Trims Pending)." 
                            : "Deliver batch instantly (No trims specified)."}
                        </div>
                      </div>
                    </button>
                  );
                })()}



                {/* Option 1: View/Update Production */}
                {onViewProduction && (
                  <button
                    onClick={() => {
                      onViewProduction(selectedBatchForActions.id);
                      setSelectedBatchForActions(null);
                    }}
                    className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/20 text-left transition duration-200 group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-800 dark:text-emerald-300 text-sm group-hover:text-emerald-950 dark:group-hover:text-emerald-100 transition-colors flex items-center gap-1.5">
                        <span>Production Updates</span>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      </div>
                    </div>
                  </button>
                )}

                {/* Option 2: Edit Batch Profile */}
                <button
                  onClick={() => {
                    onEditBatch(selectedBatchForActions.id);
                    setSelectedBatchForActions(null);
                  }}
                  className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-950/20 text-left transition duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  <div className="p-2.5 rounded-xl bg-indigo-500 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-800 dark:text-indigo-300 text-sm group-hover:text-indigo-950 dark:group-hover:text-indigo-100 transition-colors">
                      Edit Batch Profile
                    </div>
                  </div>
                </button>

                {/* Option 3: Delete Batch Profile */}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-950/20 text-left transition duration-200 group focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  <div className="p-2.5 rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-rose-600 dark:text-rose-400 text-sm group-hover:text-rose-700 dark:group-hover:text-rose-300 transition-colors">
                      Delete Batch
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Footer with Close Button */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setSelectedBatchForActions(null);
                  setShowDeleteConfirm(false);
                }}
                className="px-5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                Close Actions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Go to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-50 p-3.5 rounded-full bg-teal-600 dark:bg-teal-500 text-white shadow-xl hover:bg-teal-500 dark:hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all duration-300 transform ${
          showScrollTop ? "scale-100 translate-y-0 opacity-100" : "scale-75 translate-y-16 opacity-0 pointer-events-none"
        }`}
        aria-label="Scroll to top"
        title="Go to Top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
}
