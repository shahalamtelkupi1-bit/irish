/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  RotateCcw, History, Loader2, AlertTriangle, ArrowRight
} from "lucide-react";
import { Batch } from "../types";
import { getFabricBadgeClass, formatDate, getBatchBadgeText } from "../utils";

export default function ReworkHistory() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReworkBatches();
  }, []);

  const fetchReworkBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/batches");
      if (res.ok) {
        const data = await res.json();
        // Show batches that have experienced at least 1 rework cycle
        const reworks = data.filter((b: Batch) => b.rework_count > 0);
        setBatches(reworks);
      }
    } catch (err) {
      console.error("Error loading rework history:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      


      {/* Rework Batches List */}
      {loading ? (
        <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
        </div>
      ) : batches.length > 0 ? (
        <div className="space-y-4">
          {batches.map((batch) => {
            return (
              <div 
                key={batch.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-rose-500/50 transition shadow-sm"
              >
                <div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="font-display font-extrabold text-base text-slate-900 dark:text-white">
                      {batch.batch_number}
                    </span>
                    <span className={`px-2 py-0.2 text-[9px] font-bold rounded-md border ${getFabricBadgeClass(batch.badge_color || "secondary")}`}>
                      {getBatchBadgeText(batch)}
                    </span>
                    <span className="px-2 py-0.2 text-[9px] font-bold bg-rose-500 text-white rounded-full uppercase">
                      Recycled {batch.rework_count}x
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-1">
                    Buyer: <strong className="text-slate-600 dark:text-slate-300">{batch.buyer}</strong> &nbsp;•&nbsp; 
                    Ref: <strong className="text-indigo-500 font-medium">{batch.buyer_reference}</strong> &nbsp;•&nbsp; 
                    Color: <strong className="text-slate-600 dark:text-slate-300">{batch.color}</strong>
                  </p>

                  {/* Rework history logs (1 or multiple times) */}
                  <div className="mt-4 space-y-2">
                    <span className="text-[11px] uppercase font-mono font-bold tracking-wider text-slate-400 block">
                      Reprocess Logs & History
                    </span>
                    
                    {batch.rework_logs && batch.rework_logs.length > 0 ? (
                      <div className="space-y-3.5 border-l-2 border-rose-500/20 pl-4 ml-1.5 mt-2">
                        {batch.rework_logs.map((log, index) => (
                          <div key={log.id} className="relative space-y-1">
                            {/* Dot */}
                            <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-rose-500 ring-4 ring-white dark:ring-slate-900" />
                            
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                                Cycle #{index + 1}: &nbsp;
                                <span className="text-rose-500 font-extrabold uppercase">{log.rework_type} Rework</span>
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                {formatDate(log.created_at)}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              <strong className="text-slate-500">Problem/Reason:</strong> {log.reason}
                              {log.custom_reason && (
                                <span className="text-slate-500"> — {log.custom_reason}</span>
                              )}
                            </p>

                            {log.remarks && (
                              <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                                Remarks: "{log.remarks}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Fallback legacy single log */
                      <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 max-w-xl">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Reprocess Route: &nbsp;
                            <span className="text-rose-500 font-extrabold uppercase">{batch.rework_type}</span>
                          </div>
                          {batch.remarks && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                              Remarks: "{batch.remarks}"
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audit details removed */}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
          <History className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold">Perfect Production! No batches have failed checkpoints or undergone rework.</p>
        </div>
      )}
    </div>
  );
}
