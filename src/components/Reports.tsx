/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  FileText, Calendar, Printer, Loader2, Download, Search, Check, AlertTriangle, Layers
} from "lucide-react";
import { Batch, StageKey } from "../types";
import { formatDate, calcLossParts, getFabricBadgeClass, parseQuantityParts } from "../utils";

type ReportType = 
  | "daily_wet"
  | "daily_finish"
  | "shade"
  | "quality"
  | "delivery"
  | "rework"
  | "trims"
  | "summary";

export default function Reports() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<ReportType>("summary");
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // default 30 days ago
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedBuyer, setSelectedBuyer] = useState<string>("all");
  const [availableBuyers, setAvailableBuyers] = useState<string[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, selectedBuyer]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/batches");
      if (res.ok) {
        const data = await res.json();
        setBatches(data);

        // Extract available buyers for filtering
        const buyersSet = new Set<string>();
        data.forEach((b: Batch) => {
          if (b.buyer) buyersSet.add(b.buyer);
        });
        setAvailableBuyers(Array.from(buyersSet));
      }
    } catch (err) {
      console.error("Error fetching report data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter batches by date range and selected buyer
  const getFilteredBatches = () => {
    return batches.filter((b) => {
      // Date filter based on created_at or updated_at, formatted as YYYY-MM-DD
      const dateStr = (b.updated_at || b.created_at || "").split("T")[0];
      const inDateRange = dateStr >= startDate && dateStr <= endDate;
      const matchBuyer = selectedBuyer === "all" || b.buyer === selectedBuyer;

      return inDateRange && matchBuyer;
    });
  };

  const filtered = getFilteredBatches();

  // Print function
  const handlePrint = () => {
    window.print();
  };

  const renderReportContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      );
    }

    switch (reportType) {
      case "daily_wet":
        const wetRunning = filtered.filter((b) => b.stages?.wet === "running");
        const wetCompleted = filtered.filter((b) => b.stages?.wet === "completed");
        return (
          <div className="space-y-6">
            <h4 className="text-base font-bold text-slate-800 dark:text-white border-b pb-2 flex justify-between">
              <span>WET DYEING REPORT</span>
              <span className="text-xs font-mono">Count: {filtered.length}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                    <th className="py-3 px-2">Batch No</th>
                    <th className="py-3 px-2">Buyer/Ref</th>
                    <th className="py-3 px-2">Color</th>
                    <th className="py-3 px-2">Weight</th>
                    <th className="py-3 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{b.batch_number}</td>
                      <td className="py-3 px-2">{b.buyer} / {b.buyer_reference}</td>
                      <td className="py-3 px-2 font-mono">{b.color}</td>
                      <td className="py-3 px-2 font-mono">{b.fabric_quantity || "0"} KG</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                          b.stages?.wet === "completed" ? "text-emerald-500 bg-emerald-500/10" : b.stages?.wet === "running" ? "text-amber-500 bg-amber-500/10" : "text-slate-400 bg-slate-500/10"
                        }`}>
                          {b.stages?.wet}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "daily_finish":
        return (
          <div className="space-y-6">
            <h4 className="text-base font-bold text-slate-800 dark:text-white border-b pb-2 flex justify-between">
              <span>FINISHING REPORT</span>
              <span className="text-xs font-mono">Count: {filtered.length}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                    <th className="py-3 px-2">Batch No</th>
                    <th className="py-3 px-2">Buyer/Ref</th>
                    <th className="py-3 px-2">Color</th>
                    <th className="py-3 px-2">Weight</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{b.batch_number}</td>
                      <td className="py-3 px-2">{b.buyer} / {b.buyer_reference}</td>
                      <td className="py-3 px-2 font-mono">{b.color}</td>
                      <td className="py-3 px-2 font-mono">{b.fabric_quantity || "0"} KG</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                          b.stages?.finish === "completed" ? "text-emerald-500 bg-emerald-500/10" : b.stages?.finish === "running" ? "text-amber-500 bg-amber-500/10" : "text-slate-400 bg-slate-500/10"
                        }`}>
                          {b.stages?.finish}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-slate-500">{b.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "shade":
        return (
          <div className="space-y-6">
            <h4 className="text-base font-bold text-slate-800 dark:text-white border-b pb-2 flex justify-between">
              <span>SHADE TRIAL REPORT</span>
              <span className="text-xs font-mono">Count: {filtered.length}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                    <th className="py-3 px-2">Batch No</th>
                    <th className="py-3 px-2">Buyer/Ref</th>
                    <th className="py-3 px-2">Color</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Rejection Reason</th>
                    <th className="py-3 px-2">Reworks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{b.batch_number}</td>
                      <td className="py-3 px-2">{b.buyer} / {b.buyer_reference}</td>
                      <td className="py-3 px-2 font-mono">{b.color}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                          b.shade_status === "ok" ? "text-emerald-500 bg-emerald-500/10" : b.shade_status === "not_ok" ? "text-rose-500 bg-rose-500/10" : "text-amber-500 bg-amber-500/10"
                        }`}>
                          {b.shade_status || "Pending"}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-rose-500 font-medium">
                        {b.shade_status === "not_ok" ? `${b.shade_reason} ${b.shade_custom_reason ? `(${b.shade_custom_reason})` : ""}` : "—"}
                      </td>
                      <td className="py-3 px-2 font-mono font-bold text-center">{b.rework_count}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "quality":
        return (
          <div className="space-y-6">
            <h4 className="text-base font-bold text-slate-800 dark:text-white border-b pb-2 flex justify-between">
              <span>QUALITY CHECK REPORT</span>
              <span className="text-xs font-mono">Count: {filtered.length}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                    <th className="py-3 px-2">Batch No</th>
                    <th className="py-3 px-2">Buyer/Ref</th>
                    <th className="py-3 px-2">Color</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Defects</th>
                    <th className="py-3 px-2">Reworks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{b.batch_number}</td>
                      <td className="py-3 px-2">{b.buyer} / {b.buyer_reference}</td>
                      <td className="py-3 px-2 font-mono">{b.color}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                          b.quality_status === "ok" ? "text-emerald-500 bg-emerald-500/10" : b.quality_status === "not_ok" ? "text-rose-500 bg-rose-500/10" : "text-amber-500 bg-amber-500/10"
                        }`}>
                          {b.quality_status || "Pending"}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-rose-500 font-medium">
                        {b.quality_status === "not_ok" ? `${b.quality_reason} ${b.quality_custom_reason ? `(${b.quality_custom_reason})` : ""}` : "—"}
                      </td>
                      <td className="py-3 px-2 font-mono font-bold text-center">{b.rework_count}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "delivery":
        return (
          <div className="space-y-6">
            <h4 className="text-base font-bold text-slate-800 dark:text-white border-b pb-2 flex justify-between">
              <span>DELIVERY REPORT</span>
              <span className="text-xs font-mono">Count: {filtered.length}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                    <th className="py-3 px-2">Batch No</th>
                    <th className="py-3 px-2">Buyer/Ref</th>
                    <th className="py-3 px-2">Delivery Date</th>
                    <th className="py-3 px-2">Input Qty</th>
                    <th className="py-3 px-2">Delivered Qty</th>
                    <th className="py-3 px-2">Process Loss</th>
                    <th className="py-3 px-2">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{b.batch_number}</td>
                      <td className="py-3 px-2">{b.buyer} / {b.buyer_reference}</td>
                      <td className="py-3 px-2 font-mono">{formatDate(b.delivery_date)}</td>
                      <td className="py-3 px-2 font-mono">{b.fabric_quantity || "0"} KG</td>
                      <td className="py-3 px-2 font-mono">
                        {b.delivery_qty && b.delivery_qty !== "N/A" ? `${b.delivery_qty} KG` : "N/A"}
                      </td>
                      <td className="py-3 px-2 font-mono font-bold text-rose-500">
                        {calcLossParts(b.trims_quantity, b.delivery_qty, b.trims).text}
                      </td>
                      <td className="py-3 px-2 text-slate-500">{b.delivery_remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "rework":
        return (
          <div className="space-y-6">
            <h4 className="text-base font-bold text-slate-800 dark:text-white border-b pb-2 flex justify-between">
              <span>REWORK HISTORY REPORT</span>
              <span className="text-xs font-mono">Count: {filtered.length}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                    <th className="py-3 px-2">Batch No</th>
                    <th className="py-3 px-2">Buyer/Ref</th>
                    <th className="py-3 px-2">Type</th>
                    <th className="py-3 px-2">Remarks</th>
                    <th className="py-3 px-2">Reworks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.filter((b) => b.rework_count > 0).map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{b.batch_number}</td>
                      <td className="py-3 px-2">{b.buyer} / {b.buyer_reference}</td>
                      <td className="py-3 px-2 font-mono font-bold uppercase text-rose-500">{b.rework_type || "Dyeing Rework"}</td>
                      <td className="py-3 px-2 text-slate-500 italic">"{b.remarks || "Checkpoint Failure Reprocess"}"</td>
                      <td className="py-3 px-2 font-mono font-extrabold text-center text-rose-600">{b.rework_count}x reprocess</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "trims":
        return (
          <div className="space-y-6">
            <h4 className="text-base font-bold text-slate-800 dark:text-white border-b pb-2 flex justify-between">
              <span>ACCESSORY TRIMS REPORT</span>
              <span className="text-xs font-mono">Count: {filtered.length}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                    <th className="py-3 px-2">Batch No</th>
                    <th className="py-3 px-2">Buyer/Ref</th>
                    <th className="py-3 px-2">Trims</th>
                    <th className="py-3 px-2">Quantity</th>
                    <th className="py-3 px-2">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.filter((b) => b.trims && b.trims.trim() !== "").map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{b.batch_number}</td>
                      <td className="py-3 px-2">{b.buyer} / {b.buyer_reference}</td>
                      <td className="py-3 px-2 font-medium">{b.trims}</td>
                      <td className="py-3 px-2 font-mono text-indigo-600 font-semibold">{b.trims_quantity || "N/A"}</td>
                      <td className="py-3 px-2 font-mono">{b.fabric_quantity || "—"} KG</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "summary":
      default:
        // Summary metrics
        const total = filtered.length;
        
        // Sum of all trims quantities across filtered batches that have trims
        const totalTrimsRequired = filtered.reduce((acc, b) => {
          const hasTrims = !!(b.trims && b.trims.trim() !== "" && b.trims.trim().toLowerCase() !== "n/a" && b.trims.trim().toLowerCase() !== "none");
          if (!hasTrims) return acc;
          const parts = parseQuantityParts(b.trims_quantity);
          const sum = parts.reduce((s, n) => s + n, 0);
          return acc + sum;
        }, 0);

        // Sum of all required trims quantities across only DELIVERED batches that have trims
        const deliveredTrimsRequired = filtered.reduce((acc, b) => {
          const hasTrims = !!(b.trims && b.trims.trim() !== "" && b.trims.trim().toLowerCase() !== "n/a" && b.trims.trim().toLowerCase() !== "none");
          if (!hasTrims) return acc;
          const isDelivered = b.stages?.delivered === "completed" || !!b.delivery_date;
          if (!isDelivered) return acc;
          const parts = parseQuantityParts(b.trims_quantity);
          const sum = parts.reduce((s, n) => s + n, 0);
          return acc + sum;
        }, 0);

        // Sum of all delivered trims quantities across only DELIVERED batches that have trims
        const totalTrimsDelivered = filtered.reduce((acc, b) => {
          const hasTrims = !!(b.trims && b.trims.trim() !== "" && b.trims.trim().toLowerCase() !== "n/a" && b.trims.trim().toLowerCase() !== "none");
          if (!hasTrims) return acc;
          const isDelivered = b.stages?.delivered === "completed" || !!b.delivery_date;
          if (!isDelivered) return acc;
          const parts = parseQuantityParts(b.delivery_qty);
          const sum = parts.reduce((s, n) => s + n, 0);
          return acc + sum;
        }, 0);

        const deliveredCount = filtered.filter((b) => b.stages?.delivered === "completed").length;
        const holdCount = filtered.filter((b) => b.stages_list?.some((s) => s.status === "hold")).length;
        const reworksCount = filtered.filter((b) => b.rework_count > 0).length;

        // Calculate Trims Process Loss based strictly on delivered batches
        // Formula: ((deliveredTrimsRequired - totalTrimsDelivered) / deliveredTrimsRequired) * 100
        const trimsLossPct = deliveredTrimsRequired > 0 
          ? Math.max(0, ((deliveredTrimsRequired - totalTrimsDelivered) / deliveredTrimsRequired) * 100) 
          : 0;

        return (
          <div className="space-y-6">
            <h4 className="text-base font-bold text-slate-800 dark:text-white border-b pb-2">
              PRODUCTION SUMMARY
            </h4>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Total Batches</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{total}</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Total Trims Qty</span>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{totalTrimsRequired.toFixed(2)} KG</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Delivered Batches</span>
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{deliveredCount}</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Total Reworks</span>
                <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{reworksCount}</div>
              </div>
            </div>

            {/* Sub summary details */}
            <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
              <h5 className="font-bold text-sm text-slate-800 dark:text-white">Workflow Metrics</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Delivered Trims Qty: <strong className="text-slate-800 dark:text-slate-200">{totalTrimsDelivered.toFixed(2)} KG</strong></p>
                  <p className="text-slate-500 mt-1">Trims Process Loss: <strong className="text-rose-500">
                    {trimsLossPct.toFixed(2)}%
                  </strong></p>
                </div>
                <div>
                  <p className="text-slate-500">Batches on Hold: <strong className="text-rose-500">{holdCount}</strong></p>
                  <p className="text-slate-500 mt-1">Shade Pass Rate: <strong className="text-emerald-500">
                    {total > 0 ? ((filtered.filter((b) => b.shade_status === "ok").length / total) * 100).toFixed(1) : "0.0"}%
                  </strong></p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Date filter panel (no-print) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4 items-end no-print">
        {/* Report selection */}
        <div className="md:col-span-3 space-y-1">
          <label className="text-xs font-semibold text-slate-500">Select Report Type</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="summary">Production Summary</option>
            <option value="daily_wet">Daily Wet Dyeing</option>
            <option value="daily_finish">Daily Finishing</option>
            <option value="shade">Shade Trials</option>
            <option value="quality">Quality Inspection</option>
            <option value="delivery">Logistics & Dispatches</option>
            <option value="rework">Reprocess History</option>
            <option value="trims">Accessory Trims</option>
          </select>
        </div>

        {/* Start date */}
        <div className="md:col-span-3 space-y-1">
          <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>From Date</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none"
          />
        </div>

        {/* End date */}
        <div className="md:col-span-3 space-y-1">
          <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>To Date</span>
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none"
          />
        </div>

        {/* Buyer filter */}
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-semibold text-slate-500">Filter Buyer</label>
          <select
            value={selectedBuyer}
            onChange={(e) => setSelectedBuyer(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none font-medium"
          >
            <option value="all">All Buyers</option>
            {availableBuyers.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Print trigger */}
        <div className="md:col-span-1">
          <button
            onClick={handlePrint}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            title="Print Friendly View"
          >
            <Printer className="w-4 h-4" />
            <span className="md:hidden lg:inline">Print</span>
          </button>
        </div>
      </section>

      {/* Main Print Preview Container */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-8 rounded-2xl shadow-sm relative print-card">
        {/* Print Header Banner (Only visible on print) */}
        <div className="hidden print:block text-center border-b pb-6 mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-black">IRIS FABRICS LTD</h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Textile Dyeing Production tracking system</p>
          <p className="text-[10px] text-slate-400 mt-1">
            Report Range: {formatDate(startDate)} to {formatDate(endDate)} • Buyer: {selectedBuyer === "all" ? "All Buyers" : selectedBuyer}
          </p>
        </div>

        {renderReportContent()}
      </section>
    </div>
  );
}
