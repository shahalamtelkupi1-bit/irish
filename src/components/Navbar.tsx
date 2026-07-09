/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Menu, X, LayoutDashboard, Database, RefreshCcw, CheckSquare, 
  Truck, HelpCircle, FileText, PlusCircle, Upload, LogOut, Layers, MessageSquare, ShieldCheck,
  Wifi, WifiOff, CloudLightning
} from "lucide-react";
import { useOfflineSync } from "../hooks/useOfflineSync";
import { triggerSync } from "../offline";

export type AdminPanel = 
  | "dashboard"
  | "batches"
  | "production"
  | "shade"
  | "quality"
  | "delivery"
  | "reprocess"
  | "trims"
  | "reports"
  | "add"
  | "import"
  | "edit";

interface NavbarProps {
  currentPanel: AdminPanel;
  onPanelChange: (panel: AdminPanel) => void;
  onLogout: () => void;
  adminName: string;
  children: React.ReactNode;
}

export default function Navbar({ currentPanel, onPanelChange, onLogout, adminName, children }: NavbarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { onLine, isSyncing, pendingCount } = useOfflineSync();

  const navItems = [
    { id: "dashboard" as AdminPanel, label: "Dashboard", icon: LayoutDashboard },
    { id: "batches" as AdminPanel, label: "All Batches", icon: Database },
    { id: "production" as AdminPanel, label: "Production Updates", icon: RefreshCcw },
    { id: "shade" as AdminPanel, label: "Shade Updates", icon: CheckSquare },
    { id: "quality" as AdminPanel, label: "Quality Updates", icon: CheckSquare },
    { id: "delivery" as AdminPanel, label: "Delivery Updates", icon: Truck },
    { id: "reprocess" as AdminPanel, label: "Rework History", icon: RefreshCcw },
    { id: "trims" as AdminPanel, label: "Trims Pending", icon: HelpCircle },
    { id: "reports" as AdminPanel, label: "Reports", icon: FileText },
    { id: "add" as AdminPanel, label: "Add Batch", icon: PlusCircle },
    { id: "import" as AdminPanel, label: "Import Excel/CSV", icon: Upload },
  ];

  const handleNavItemClick = (panel: AdminPanel) => {
    onPanelChange(panel);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen glass-bg font-sans flex flex-col md:flex-row text-slate-100 transition-colors duration-300">
      
      {/* Mobile Offcanvas Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-40 md:hidden transition-all"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed md:sticky top-0 left-0 bottom-0 w-64 glass-sidebar text-slate-300 flex flex-col z-50 transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-display font-bold text-sm tracking-tight uppercase">Iris Fabrics</h2>
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">ADMIN CONTROL</p>
            </div>
          </div>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentPanel === item.id || (item.id === "batches" && currentPanel === "edit");
            return (
              <button
                key={item.id}
                onClick={() => handleNavItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition duration-150 cursor-pointer ${
                  active 
                    ? "bg-white/10 border border-white/20 text-blue-400 font-semibold shadow-lg shadow-blue-500/5" 
                    : "hover:bg-white/5 hover:text-white text-slate-400"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-blue-400" : "text-slate-500"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Session Footer inside Sidebar */}
        <div className="p-4 border-t border-white/10 bg-white/2">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 font-mono">Logged in as</div>
              <div className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{adminName}</span>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/5 transition cursor-pointer"
              title="Logout session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar Header (Visible mostly on mobile, but contains toggle and breadcrumbs) */}
        <header className="no-print glass-navbar px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[10px] text-blue-400 font-mono uppercase tracking-wider font-semibold">
                Iris Control Panel
              </span>
              <h3 className="text-lg md:text-xl font-display font-bold text-white capitalize">
                {currentPanel === "edit" ? "Edit Batch" : currentPanel.replace("_", " ")}
              </h3>
            </div>
          </div>

          {/* Quick Info Indicator */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Offline/Online/Sync Status Indicator */}
            {!onLine ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline Mode</span>
              </span>
            ) : isSyncing ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing ({pendingCount})...</span>
              </span>
            ) : pendingCount > 0 ? (
              <button 
                onClick={() => triggerSync()}
                title="Click to manually push pending local changes to cloud"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 transition cursor-pointer"
              >
                <CloudLightning className="w-3.5 h-3.5 animate-pulse" />
                <span>Sync ({pendingCount} pending)</span>
              </button>
            ) : null}


            <button 
              onClick={onLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Content Container (Page scroll container) */}
        <main className="flex-1 p-3.5 md:p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
