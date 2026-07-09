/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Lock, ArrowLeft, Loader2, ShieldAlert, Key, User, Layers
} from "lucide-react";

// Import custom views
import PublicSearch from "./components/PublicSearch";
import Navbar, { AdminPanel } from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import BatchList from "./components/BatchList";
import ProductionManagement from "./components/ProductionManagement";
import ShadeManagement from "./components/ShadeManagement";
import QualityManagement from "./components/QualityManagement";
import DeliveryManagement from "./components/DeliveryManagement";
import ReworkHistory from "./components/ReworkHistory";
import TrimsPending from "./components/TrimsPending";
import Reports from "./components/Reports";
import BatchForm from "./components/BatchForm";
import ImportBatches from "./components/ImportBatches";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("admin_token"));
  const [adminName, setAdminName] = useState<string>(() => localStorage.getItem("admin_name") || "Administrator");
  const [activePanel, setActivePanel] = useState<AdminPanel | "public" | "login">("public");
  
  // Dashboard navigation pre-filters
  const [panelPreFilter, setPanelPreFilter] = useState<string | undefined>(undefined);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // Login form entries
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Validate session on boot
  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token]);

  const verifyToken = async (authToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminName(data.username);
        localStorage.setItem("admin_name", data.username);
        // If they were on public search or login, move to admin panel on validation
        if (activePanel === "public" || activePanel === "login") {
          setActivePanel("dashboard");
        }
      } else {
        // stale session
        handleLogout();
      }
    } catch (err) {
      console.error("Session verification failed:", err);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      setLoginError("Please enter both username and security key.");
      return;
    }

    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setAdminName(data.username);
        localStorage.setItem("admin_token", data.token);
        localStorage.setItem("admin_name", data.username);
        setActivePanel("dashboard");
      } else {
        const err = await res.json();
        setLoginError(err.error || "Access denied. Verify security credentials.");
      }
    } catch (err) {
      console.error("Login failure:", err);
      setLoginError("Failed to authenticate. Server is not responding.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setAdminName("Administrator");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_name");
    setActivePanel("public");
  };

  // Dashboard navigation trigger
  const handleDashboardNavigate = (panel: AdminPanel, filter?: string) => {
    setPanelPreFilter(filter);
    setActivePanel(panel);
  };

  const handleRowClickEdit = (batchId: number) => {
    setSelectedBatchId(batchId);
    setActivePanel("edit");
  };

  const handleRowClickProduction = (batchId: number) => {
    setSelectedBatchId(batchId);
    setActivePanel("production");
  };

  // Switch routing helper
  const renderActiveAdminPanel = () => {
    switch (activePanel) {
      case "dashboard":
        return <Dashboard onNavigate={handleDashboardNavigate} />;
      case "batches":
        return (
          <BatchList 
            token={token!} 
            onEditBatch={handleRowClickEdit} 
            onViewProduction={handleRowClickProduction}
            onNavigate={setActivePanel} 
          />
        );
      case "production":
        return (
          <ProductionManagement 
            token={token!} 
            preSelectedBatchId={selectedBatchId}
            onBack={() => {
              setSelectedBatchId(null);
              setActivePanel("batches");
            }} 
          />
        );
      case "shade":
        return <ShadeManagement token={token!} preFilter={panelPreFilter} onBack={() => setActivePanel("dashboard")} />;
      case "quality":
        return <QualityManagement token={token!} preFilter={panelPreFilter} onBack={() => setActivePanel("dashboard")} />;
      case "delivery":
        return (
          <DeliveryManagement 
            token={token!} 
            preSelectedBatchId={selectedBatchId} 
            onBack={() => {
              setSelectedBatchId(null);
              setActivePanel("dashboard");
            }} 
          />
        );
      case "reprocess":
        return <ReworkHistory />;
      case "trims":
        return (
          <TrimsPending 
            token={token!} 
            onNavigate={(panel, batchId) => {
              if (batchId) {
                setSelectedBatchId(batchId);
              } else {
                setSelectedBatchId(null);
              }
              setActivePanel(panel);
            }} 
          />
        );
      case "reports":
        return <Reports />;
      case "add":
        return <BatchForm token={token!} onBack={() => setActivePanel("batches")} />;
      case "edit":
        return <BatchForm token={token!} batchId={selectedBatchId} onBack={() => setActivePanel("batches")} />;
      case "import":
        return <ImportBatches token={token!} onSuccess={() => setActivePanel("batches")} />;
      default:
        return <Dashboard onNavigate={handleDashboardNavigate} />;
    }
  };

  // 1. PUBLIC LANDING SCREEN
  if (activePanel === "public") {
    return <PublicSearch onAdminClick={() => setActivePanel(token ? "dashboard" : "login")} />;
  }

  // 2. ADMIN PORTAL LOGIN SCREEN (Banking App UI layout)
  if (activePanel === "login") {
    return (
      <div className="min-h-screen glass-bg text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
        {/* Glowing visual assets */}
        <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-rose-500/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="w-full max-w-md glass-card p-8 relative z-10 slide-in">
          {/* Back to search */}
          <button
            onClick={() => setActivePanel("public")}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-6 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Public Tracking</span>
          </button>

          {/* Form Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mx-auto mb-3">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-display font-extrabold text-white tracking-tight">IRIS FABRICS LTD</h2>
            <p className="text-xs text-slate-500 font-mono mt-1">SECURE ADMIN INTERFACE</p>
          </div>

          {/* Form Errors */}
          {loginError && (
            <div className="mb-4 bg-rose-950/20 border border-rose-900/30 text-rose-400 p-3.5 rounded-xl text-xs flex gap-2 items-center">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Login Form Fields */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>Username</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter admin username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-4 py-3 text-xs glass-input rounded-xl focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Security Access Key</span>
              </label>
              <input
                type="password"
                required
                placeholder="Enter password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 text-xs glass-input rounded-xl focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-6 py-3 glass-button-primary disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>Authorize Login</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. SECURE WORKSPACE FOR LOGGED-IN ADMINISTRATORS
  return (
    <Navbar 
      currentPanel={activePanel as AdminPanel} 
      onPanelChange={(panel) => {
        setSelectedBatchId(null);
        setActivePanel(panel);
      }} 
      onLogout={handleLogout}
      adminName={adminName}
    >
      {renderActiveAdminPanel()}
    </Navbar>
  );
}
