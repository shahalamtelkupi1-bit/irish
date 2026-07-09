/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StageStatus } from "./types";

/**
 * Escape strings for safety
 */
export function sanitize(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Format string as uppercase
 */
export function uppercase(str: string): string {
  return str.trim().toUpperCase();
}

/**
 * Map stage status to Tailwind CSS classes for the progress dots
 */
export function getStatusDotClass(status: StageStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20";
    case "running":
      return "bg-amber-500 text-white animate-pulse shadow-lg shadow-amber-500/20";
    case "hold":
      return "bg-rose-500 text-white shadow-lg shadow-rose-500/20";
    case "pending":
    default:
      return "bg-gray-200 dark:bg-slate-700 text-gray-400";
  }
}

/**
 * Map stage status to friendly text labels
 */
export function getStatusLabel(status: StageStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "running":
      return "In Progress";
    case "hold":
      return "On Hold";
    case "pending":
    default:
      return "Pending";
  }
}

/**
 * Map fabric badge colors to Tailwind CSS classes
 */
export function getFabricBadgeClass(color: string): string {
  switch (color) {
    case "primary":
      return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/30";
    case "success":
      return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/30";
    case "info":
      return "bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800/30";
    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/30";
    case "secondary":
    default:
      return "bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50";
  }
}

/**
 * Get display text for the main batch badge.
 * Show only the fabric type name.
 */
export function getBatchBadgeText(batch: { trims?: string | null; fabric_type_name?: string | null }): string {
  return batch.fabric_type_name || "N/A";
}

/**
 * Relative time ago formatter
 */
export function timeAgo(dateString: string): string {
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

/**
 * Pretty date formatter
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Parse floats out of a string (e.g. "105.5 KG" -> 105.5)
 */
export function extractNumbers(str: string | null): number | null {
  if (!str) return null;
  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : null;
}

/**
 * Process Loss Calculation percentage based on Trims Quantity
 * Formula: ((Input Trims Qty - Delivered Qty) / Input Trims Qty) * 100
 */
export function calcLossParts(
  trimsQtyVal: string | number | null,
  deliveredQtyStr: string | null,
  trimsNamesStr?: string | null
): { lossPct: number | null; text: string } {
  if (!trimsQtyVal || !deliveredQtyStr || deliveredQtyStr === "N/A" || trimsQtyVal === "N/A") {
    return { lossPct: null, text: "N/A" };
  }

  // Parse strings to lists of numbers
  const trimsQtyStr = typeof trimsQtyVal === "number" ? String(trimsQtyVal) : trimsQtyVal;
  const trimsParts = parseQuantityParts(trimsQtyStr);
  const delParts = parseQuantityParts(deliveredQtyStr);

  const nameParts = trimsNamesStr ? trimsNamesStr.split("+").map(s => s.trim()) : [];

  // If we have matching multi-part item lists
  if (trimsParts.length > 1 && trimsParts.length === delParts.length) {
    let totalInput = 0;
    let totalDelivered = 0;
    const itemTexts: string[] = [];

    for (let i = 0; i < trimsParts.length; i++) {
      const inputVal = trimsParts[i];
      const delVal = delParts[i];
      totalInput += inputVal;
      totalDelivered += delVal;

      if (inputVal <= 0) {
        itemTexts.push("0%");
        continue;
      }

      const diff = inputVal - delVal;
      const lossPct = Math.max(0, (diff / inputVal) * 100);
      const name = nameParts[i] ? `${nameParts[i]}: ` : "";
      
      itemTexts.push(`${name}${inputVal}-${delVal}=${lossPct.toFixed(0)}%`);
    }

    const overallLossPct = totalInput > 0 ? Math.max(0, ((totalInput - totalDelivered) / totalInput) * 100) : 0;

    return {
      lossPct: overallLossPct,
      text: `${overallLossPct.toFixed(1)}% (${itemTexts.join(", ")})`
    };
  }

  // Single/aggregate value fallback
  const trimsQty = typeof trimsQtyVal === "number" ? trimsQtyVal : extractNumbers(trimsQtyVal);
  if (!trimsQty || trimsQty <= 0) {
    return { lossPct: null, text: "N/A" };
  }

  const delQty = extractNumbers(deliveredQtyStr);
  if (delQty === null || delQty < 0) {
    return { lossPct: null, text: "N/A" };
  }

  if (delQty > trimsQty) {
    return { lossPct: 0, text: "0.00% (0.00 loss)" };
  }

  const loss = ((trimsQty - delQty) / trimsQty) * 100;
  return {
    lossPct: loss,
    text: `${loss.toFixed(2)}% (${(trimsQty - delQty).toFixed(2)} loss)`
  };
}

export function parseQuantityParts(str: string | null): number[] {
  if (!str) return [];
  const parts = str.split("+");
  const numbers: number[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) {
      const num = extractNumbers(trimmed);
      if (num !== null) {
        numbers.push(num);
      }
    }
  }
  return numbers;
}

