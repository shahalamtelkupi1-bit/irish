/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Database, RefreshCw, Layers, Truck, Calendar, ClipboardCheck, 
  AlertTriangle, RotateCcw, Compass, PlusCircle, Upload, FileText, Edit, Loader2
} from "lucide-react";
import { AdminPanel } from "./Navbar";
import { useOfflineSync } from "../hooks/useOfflineSync";

interface DashboardProps {
  onNavigate: (panel: AdminPanel, filter?: string) => void;
}

interface StatsData {
  totalBatch: number;
  wetRunning: number;
  finishedToday: number;
  deliveredToday: number;
  rfdToday: number;
  shadePending: number;
  shadeNotOk: number;
  qualityPending: number;
  qualityNotOk: number;
  reprocess: number;
  trimsPending: number;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useOfflineSync(() => {
    fetchStats();
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-slate-500 text-sm font-mono">Loading statistics...</span>
      </div>
    );
  }

  // Define the stat cards array
  const statCards = [
    {
      title: "Total Batch",
      value: stats.totalBatch,
      label: "Total Registered Batches",
      icon: Database,
      color: "from-blue-500 to-indigo-600 shadow-blue-500/10",
      textColor: "text-blue-500 dark:text-blue-400",
      target: "batches" as AdminPanel,
    },
    {
      title: "Wet (Running)",
      value: stats.wetRunning,
      label: "Currently in Dyeing",
      icon: RefreshCw,
      color: "from-amber-400 to-amber-600 shadow-amber-500/10",
      textColor: "text-amber-500 dark:text-amber-400",
      target: "production" as AdminPanel,
    },
    {
      title: "Finished Today",
      value: stats.finishedToday,
      label: "Completed RFD/Delivered",
      icon: Layers,
      color: "from-emerald-400 to-emerald-600 shadow-emerald-500/10",
      textColor: "text-emerald-500 dark:text-emerald-400",
      target: "reports" as AdminPanel,
      filter: "finished",
    },
    {
      title: "Delivered Today",
      value: stats.deliveredToday,
      label: "Batches Dispatched",
      icon: Truck,
      color: "from-sky-500 to-cyan-600 shadow-cyan-500/10",
      textColor: "text-sky-500 dark:text-sky-400",
      target: "reports" as AdminPanel,
      filter: "delivery",
    },
    {
      title: "RFD Today",
      value: stats.rfdToday,
      label: "Ready for Delivery",
      icon: Calendar,
      color: "from-purple-500 to-purple-600 shadow-purple-500/10",
      textColor: "text-purple-500 dark:text-purple-400",
      target: "reports" as AdminPanel,
      filter: "finished",
    },
    {
      title: "Shade Pending",
      value: stats.shadePending,
      label: "Awaiting Shade Assessment",
      icon: ClipboardCheck,
      color: "from-violet-400 to-indigo-500 shadow-indigo-500/10",
      textColor: "text-indigo-500 dark:text-indigo-400",
      target: "shade" as AdminPanel,
      filter: "pending",
    },
    {
      title: "Shade NOT OK",
      value: stats.shadeNotOk,
      label: "Failed Shade Trials",
      icon: AlertTriangle,
      color: "from-rose-500 to-rose-600 shadow-rose-500/10",
      textColor: "text-rose-500 dark:text-rose-400",
      target: "shade" as AdminPanel,
      filter: "not_ok",
    },
    {
      title: "Quality Pending",
      value: stats.qualityPending,
      label: "Awaiting Defects Check",
      icon: ClipboardCheck,
      color: "from-fuchsia-400 to-pink-500 shadow-fuchsia-500/10",
      textColor: "text-fuchsia-500 dark:text-fuchsia-400",
      target: "quality" as AdminPanel,
      filter: "pending",
    },
    {
      title: "Quality NOT OK",
      value: stats.qualityNotOk,
      label: "Active Surface Defects",
      icon: AlertTriangle,
      color: "from-red-500 to-red-600 shadow-red-500/10",
      textColor: "text-red-500 dark:text-red-400",
      target: "quality" as AdminPanel,
      filter: "not_ok",
    },
    {
      title: "Reprocess",
      value: stats.reprocess,
      label: "Dyeing/Finishing Reworks",
      icon: RotateCcw,
      color: "from-orange-400 to-orange-600 shadow-orange-500/10",
      textColor: "text-orange-500 dark:text-orange-400",
      target: "reprocess" as AdminPanel,
    },
    {
      title: "Trims Pending",
      value: stats.trimsPending,
      label: "Required for Delivery",
      icon: Compass,
      color: "from-teal-400 to-teal-600 shadow-teal-500/10",
      textColor: "text-teal-500 dark:text-teal-400",
      target: "trims" as AdminPanel,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Quick Actions Panel */}
      <section className="glass-card p-6">
        <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider mb-4">Quick Operations</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => onNavigate("add")}
            className="flex flex-col items-center justify-center p-4 rounded-xl glass-button-secondary hover:border-blue-400/40 hover:bg-white/5 transition group text-center cursor-pointer"
          >
            <PlusCircle className="w-6 h-6 text-indigo-400 mb-2 group-hover:scale-105 transition" />
            <span className="text-sm font-semibold text-white">Add New Batch</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Register single batch</span>
          </button>

          <button
            onClick={() => onNavigate("import")}
            className="flex flex-col items-center justify-center p-4 rounded-xl glass-button-secondary hover:border-emerald-400/40 hover:bg-white/5 transition group text-center cursor-pointer"
          >
            <Upload className="w-6 h-6 text-emerald-400 mb-2 group-hover:scale-105 transition" />
            <span className="text-sm font-semibold text-white">Import Excel/CSV</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Bulk batch upload</span>
          </button>

          <button
            onClick={() => onNavigate("batches")}
            className="flex flex-col items-center justify-center p-4 rounded-xl glass-button-secondary hover:border-amber-400/40 hover:bg-white/5 transition group text-center cursor-pointer"
          >
            <Edit className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-105 transition" />
            <span className="text-sm font-semibold text-white">Edit Batches</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Update profiles & remove</span>
          </button>

          <button
            onClick={() => onNavigate("reports")}
            className="flex flex-col items-center justify-center p-4 rounded-xl glass-button-secondary hover:border-purple-400/40 hover:bg-white/5 transition group text-center cursor-pointer"
          >
            <FileText className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-105 transition" />
            <span className="text-sm font-semibold text-white">View Reports</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Production analytics</span>
          </button>
        </div>
      </section>

      {/* 11-Stats Grid Card */}
      <section className="space-y-4">
        <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider">Production Status</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {statCards.map((card, index) => {
            const IconComponent = card.icon;
            return (
              <button
                key={index}
                onClick={() => onNavigate(card.target, card.filter)}
                className="w-full text-left glass-card glass-card-hover p-5 rounded-2xl group flex items-start justify-between relative overflow-hidden cursor-pointer"
              >
                {/* Decorative glowing gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none" />

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    {card.title}
                  </span>
                  <div className="text-3xl font-display font-extrabold text-white">
                    {card.value}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {card.label}
                  </span>
                </div>

                {/* Styled icon badge (banking app layout) */}
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${card.color} flex items-center justify-center text-white shadow-md`}>
                  <IconComponent className="w-5 h-5 text-white group-hover:scale-110 transition duration-200" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
