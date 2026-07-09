/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Save, Loader2, ArrowLeft, RefreshCw, Layers, CheckCircle2, Sliders
} from "lucide-react";
import { Batch, FabricType } from "../types";

interface BatchFormProps {
  token: string;
  batchId?: number | null; // if provided, we are in Edit mode
  onBack: () => void;
}

export default function BatchForm({ token, batchId, onBack }: BatchFormProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fabricTypes, setFabricTypes] = useState<FabricType[]>([]);

  // Form Fields State
  const [batchNumber, setBatchNumber] = useState("");
  const [fabricTypeName, setFabricTypeName] = useState("");
  const [buyer, setBuyer] = useState("");
  const [buyerReference, setBuyerReference] = useState("");
  const [color, setColor] = useState("");
  const [fabricQuantity, setFabricQuantity] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [machineNumber, setMachineNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [trims, setTrims] = useState("");
  const [trimsQuantity, setTrimsQuantity] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    fetchFabricTypes();
    if (batchId) {
      fetchBatchDetails(batchId);
    }
  }, [batchId]);

  const fetchFabricTypes = async () => {
    try {
      const res = await fetch("/api/batches/filters");
      if (res.ok) {
        const data = await res.json();
        setFabricTypes(data.fabrics || []);
      }
    } catch (err) {
      console.error("Error loading fabrics:", err);
    }
  };

  const fetchBatchDetails = async (id: number) => {
    setFetching(true);
    try {
      const res = await fetch(`/api/batches/${id}`);
      if (res.ok) {
        const data: Batch = await res.json();
        setBatchNumber(data.batch_number);
        setFabricTypeName(data.fabric_type_name || "");
        setBuyer(data.buyer);
        setBuyerReference(data.buyer_reference);
        setColor(data.color || "");
        setFabricQuantity(data.fabric_quantity ? data.fabric_quantity.toString() : "");
        setOrderNumber(data.order_number || "");
        setMachineNumber(data.machine_number || "");
        setLotNumber(data.lot_number || "");
        setTrims(data.trims || "");
        setTrimsQuantity(data.trims_quantity || "");
        setRemarks(data.remarks || "");
      }
    } catch (err) {
      console.error("Error loading batch details:", err);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchNumber || !buyer || !buyerReference) {
      alert("Please fill in all mandatory fields: Batch, Buyer and Buyer Reference.");
      return;
    }

    setLoading(true);
    const body = {
      batch_number: batchNumber,
      fabric_type_name: fabricTypeName,
      buyer,
      buyer_reference: buyerReference,
      color,
      fabric_quantity: fabricQuantity ? parseFloat(fabricQuantity) : null,
      order_number: orderNumber,
      machine_number: machineNumber,
      lot_number: lotNumber,
      trims: trims,
      trims_quantity: trimsQuantity,
      remarks,
    };

    try {
      const url = batchId ? `/api/batches/${batchId}` : "/api/batches";
      const method = batchId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        alert(batchId ? "Batch profile updated successfully." : "New batch registered successfully.");
        onBack();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save batch record.");
      }
    } catch (err) {
      console.error("Form submit error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-slate-500 text-sm font-mono">Fetching profile info...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top action bar */}
      <div className="flex items-center gap-3 no-print">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-500">Back to List</span>
      </div>

      {/* Main Grid Wrapper */}
      <div className="max-w-4xl mx-auto w-full">
        
        {/* main form inputs */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm p-6 space-y-6">
          <h4 className="text-sm font-mono uppercase text-slate-400 tracking-wider font-semibold border-b border-slate-100 dark:border-slate-800 pb-3">
            {batchId ? "Edit Production Profile" : "Register New Batch"}
          </h4>

          {/* Form grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Batch Number */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Batch Number *</label>
              <input
                type="text"
                required
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="e.g. B-998"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 uppercase font-bold"
              />
            </div>

            {/* Fabric Type Autocomplete Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Fabric Type (e.g. S/J, Rib)</label>
              <input
                type="text"
                list="fabric-types-list"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Type fabric code..."
                value={fabricTypeName}
                onChange={(e) => setFabricTypeName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
              />
              <datalist id="fabric-types-list">
                {fabricTypes.map((type) => (
                  <option key={type.id} value={type.name} />
                ))}
              </datalist>
            </div>

            {/* Buyer */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Buyer Name *</label>
              <input
                type="text"
                required
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="e.g. H&M"
                value={buyer}
                onChange={(e) => setBuyer(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Buyer Reference */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Buyer Reference / Code *</label>
              <input
                type="text"
                required
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="e.g. REF-2092"
                value={buyerReference}
                onChange={(e) => setBuyerReference(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Color */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Target Shade / Color</label>
              <input
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="e.g. NAVY BLUE"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 uppercase font-mono"
              />
            </div>

            {/* Fabric Quantity */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Fabric Quantity (KG)</label>
              <input
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="e.g. 104.5"
                value={fabricQuantity}
                onChange={(e) => setFabricQuantity(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Trims Required */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Trims</label>
              <input
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="e.g. 1x1 Collar Cuff"
                value={trims}
                onChange={(e) => setTrims(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Trims Quantity */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Trims Qty</label>
              <input
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="e.g. 50kg"
                value={trimsQuantity}
                onChange={(e) => setTrimsQuantity(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* General Remarks */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-500">Remarks & Special Process instructions</label>
              <input
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="e.g. Solid shade, AOP, Peach requirement..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/15"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{batchId ? "Save Profile Changes" : "Register Batch"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
