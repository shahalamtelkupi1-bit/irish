/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, ArrowRight, Play, Info, Sparkles, AlignLeft, RefreshCw
} from "lucide-react";
import * as XLSX from "xlsx";

interface ImportBatchesProps {
  token: string;
  onSuccess: () => void;
}

export default function ImportBatches({ token, onSuccess }: ImportBatchesProps) {
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [importStats, setImportStats] = useState<{
    totalRawRows: number;
    validRows: number;
    groupedBatches: number;
  } | null>(null);

  // Text copy-paste states
  const [importMethod, setImportMethod] = useState<"file" | "text">("file");
  const [rawText, setRawText] = useState("");

  // Column mapping states
  const [mapping, setMapping] = useState<Record<string, string>>({
    batch_number: "",
    fabric_type_name: "",
    buyer: "",
    buyer_reference: "",
    color: "",
    fabric_quantity: "",
    order_number: "",
    trims: "",
    trims_quantity: "",
    machine_number: "",
    lot_number: "",
    remarks: "",
    item_type: "",
  });

  const handleMappingChange = (key: string, val: string) => {
    const nextMapping = { ...mapping, [key]: val };
    setMapping(nextMapping);
    autoGeneratePreview(parsedRows, nextMapping);
  };

  const autoGeneratePreview = (rows: any[], currentMapping: Record<string, string>) => {
    const missing = [];
    if (!currentMapping.batch_number) missing.push("Batch Number");
    if (!currentMapping.buyer) missing.push("Buyer Name");
    if (!currentMapping.buyer_reference) missing.push("Buyer Reference");
    if (!currentMapping.fabric_type_name) missing.push("Fabric Type");

    if (missing.length > 0) {
      setMappingErrors(missing);
      setImportPreview([]);
      setImportStats(null);
      return;
    }
    setMappingErrors([]);

    let lastBatchNumber = "";
    let lastBuyer = "";
    let lastBuyerRef = "";
    let lastOrderNum = "";
    let lastColor = "";
    let lastMachine = "";
    let lastLot = "";

    const rawItems = rows.map((row) => {
      const origBNum = row[currentMapping.batch_number]?.toString().trim() || "";
      const origBuy = row[currentMapping.buyer]?.toString().trim() || "";
      const origFabric = row[currentMapping.fabric_type_name]?.toString().trim() || "";
      const origQty = currentMapping.fabric_quantity ? row[currentMapping.fabric_quantity]?.toString().trim() : "";

      // If the row has absolutely no batch, buyer, fabric, or qty information originally, it's a junk row
      if (!origBNum && !origBuy && !origFabric && !origQty) {
        return null;
      }

      let bNum = origBNum;
      let buy = origBuy;
      let buyRef = row[currentMapping.buyer_reference]?.toString().trim() || "";
      let ordNum = currentMapping.order_number ? row[currentMapping.order_number]?.toString().trim() : "";
      let col = currentMapping.color ? row[currentMapping.color]?.toString().trim() : "";
      let mcNum = currentMapping.machine_number ? row[currentMapping.machine_number]?.toString().trim() : "";
      let lotNum = currentMapping.lot_number ? row[currentMapping.lot_number]?.toString().trim() : "";

      // Forward fill if current is empty but previous exists
      if (!bNum && lastBatchNumber) bNum = lastBatchNumber;
      if (!buy && lastBuyer) buy = lastBuyer;
      if (!buyRef && lastBuyerRef) buyRef = lastBuyerRef;
      if (!ordNum && lastOrderNum) ordNum = lastOrderNum;
      if (!col && lastColor) col = lastColor;
      if (!mcNum && lastMachine) mcNum = lastMachine;
      if (!lotNum && lastLot) lotNum = lastLot;

      // Update last seen non-empty values
      if (bNum) lastBatchNumber = bNum;
      if (buy) lastBuyer = buy;
      if (buyRef) lastBuyerRef = buyRef;
      if (ordNum) lastOrderNum = ordNum;
      if (col) lastColor = col;
      if (mcNum) lastMachine = mcNum;
      if (lotNum) lastLot = lotNum;

      return {
        batch_number: bNum,
        fabric_type_name: row[currentMapping.fabric_type_name]?.toString().trim() || "",
        buyer: buy,
        buyer_reference: buyRef,
        color: col,
        fabric_quantity: currentMapping.fabric_quantity ? parseFloat(row[currentMapping.fabric_quantity]) || null : null,
        order_number: ordNum,
        trims: currentMapping.trims ? row[currentMapping.trims]?.toString().trim() : "",
        trims_quantity: currentMapping.trims_quantity ? row[currentMapping.trims_quantity]?.toString().trim() : "",
        machine_number: mcNum,
        lot_number: lotNum,
        remarks: currentMapping.remarks ? row[currentMapping.remarks]?.toString().trim() : "",
        item_type: currentMapping.item_type ? row[currentMapping.item_type]?.toString().trim().toLowerCase() : "",
      };
    }).filter(Boolean) as any[];

    // Filter blanks only after forward-filling has completed!
    const filteredRawItems = rawItems.filter((r) => r.batch_number && r.buyer);

    // Grouping by batch number is ALWAYS performed to prevent duplicate keys in the DB
    // and combine trims/accessories under the same production pipeline
    const groupedMap = new Map<string, typeof filteredRawItems>();
    filteredRawItems.forEach((item) => {
      const key = item.batch_number.toLowerCase();
      if (!groupedMap.has(key)) {
        groupedMap.set(key, []);
      }
      groupedMap.get(key)!.push(item);
    });

    const preview = Array.from(groupedMap.values()).map((group) => {
      // Find the main "body" row in this group.
      // It's a body row if item_type includes "body". Otherwise default to the first row.
      const bodyRow = group.find((item) => item.item_type.includes("body")) || group[0];
      
      // Find all trims/accessories rows (all rows other than the bodyRow)
      const trimsRows = group.filter((item) => item !== bodyRow);

      let finalTrims = bodyRow.trims || "";
      let finalTrimsQty = bodyRow.trims_quantity || "";

      // If there are separate trims rows, dynamically compile them!
      if (trimsRows.length > 0) {
        // Combine their fabric_type_names (e.g. 1*1 RIB, s/j)
        const trimsNames = trimsRows
          .map((item) => item.fabric_type_name)
          .filter((name) => name && name.toUpperCase() !== "N/A" && name.toUpperCase() !== "NONE");

        // Combine their quantities (e.g. 100, 50)
        const trimsQtys = trimsRows
          .map((item) => item.fabric_quantity !== null ? item.fabric_quantity.toString() : "")
          .filter((qty) => qty !== "");

        if (trimsNames.length > 0) {
          finalTrims = trimsNames.join(" + ");
        }
        if (trimsQtys.length > 0) {
          finalTrimsQty = trimsQtys.join("+");
        }
      }

      return {
        batch_number: bodyRow.batch_number,
        fabric_type_name: bodyRow.fabric_type_name,
        buyer: bodyRow.buyer,
        buyer_reference: bodyRow.buyer_reference,
        color: bodyRow.color || "",
        fabric_quantity: bodyRow.fabric_quantity,
        order_number: bodyRow.order_number || "",
        trims: finalTrims,
        trims_quantity: finalTrimsQty,
        machine_number: bodyRow.machine_number || "",
        lot_number: bodyRow.lot_number || "",
        remarks: bodyRow.remarks || Array.from(new Set(group.map((item) => item.remarks).filter(Boolean))).join(" | "),
      };
    });

    setImportStats({
      totalRawRows: rows.length,
      validRows: filteredRawItems.length,
      groupedBatches: preview.length,
    });

    setImportPreview(preview);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Raw json rows
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (data.length === 0) {
          alert("Excel sheet is empty.");
          return;
        }

        const fileHeaders = (data[0] as string[]).map((h) => h?.trim() || "");
        setHeaders(fileHeaders);

        // Convert rows to key-value objects
        const rows: any[] = [];
        for (let i = 1; i < data.length; i++) {
          const rowData = data[i] as any[];
          if (!rowData || rowData.length === 0) continue;

          const rowObj: Record<string, any> = {};
          let hasRealContent = false;
          fileHeaders.forEach((header, index) => {
            if (header) {
              const val = rowData[index] !== undefined && rowData[index] !== null ? rowData[index] : "";
              rowObj[header] = val;
              if (val.toString().trim() !== "") {
                hasRealContent = true;
              }
            }
          });
          if (hasRealContent) {
            rows.push(rowObj);
          }
        }

        setParsedRows(rows);

        // Smart Automapper: match headers with similar names
        const updatedMapping = {
          batch_number: "",
          fabric_type_name: "",
          buyer: "",
          buyer_reference: "",
          color: "",
          fabric_quantity: "",
          order_number: "",
          trims: "",
          trims_quantity: "",
          machine_number: "",
          lot_number: "",
          remarks: "",
          item_type: "",
        };

        fileHeaders.forEach((header) => {
          const lh = header.toLowerCase();
          if (lh.includes("order") || lh.includes("po") || lh.includes("job")) {
            updatedMapping.order_number = header;
          } else if (lh.includes("machine") || lh.includes("mc") || lh.includes("dia") || lh.includes("mc dia")) {
            updatedMapping.machine_number = header;
          } else if (lh.includes("lot") || lh.includes("yarn lot") || lh.includes("lot no")) {
            updatedMapping.lot_number = header;
          } else if (lh.includes("trims qty") || lh.includes("trims quantity")) {
            updatedMapping.trims_quantity = header;
          } else if (lh.includes("trims") || lh.includes("accessories") || lh.includes("collar") || lh.includes("rib")) {
            updatedMapping.trims = header;
          } else if (lh.includes("fabric qty") || lh.includes("fabric quantity") || lh.includes("fabric weight") || lh.includes("weight") || lh.includes("qty") || lh.includes("quantity") || lh.includes("kg") || lh === "batch qty") {
            updatedMapping.fabric_quantity = header;
          } else if (lh === "item" || lh.includes("item") || lh.includes("part") || lh.includes("category")) {
            updatedMapping.item_type = header;
          } else if (lh.includes("batch") || lh === "code" || lh === "number" || (lh.includes("number") && !lh.includes("qty") && !lh.includes("quantity") && !lh.includes("weight"))) {
            updatedMapping.batch_number = header;
          } else if (lh.includes("fabric") || lh.includes("type") || lh === "f/type") {
            updatedMapping.fabric_type_name = header;
          } else if (lh.includes("buyer") || lh.includes("brand") || lh.includes("client")) {
            updatedMapping.buyer = header;
          } else if (lh.includes("ref") || lh.includes("style") || lh.includes("reference") || lh === "reff") {
            updatedMapping.buyer_reference = header;
          } else if (lh.includes("color") || lh.includes("shade") || lh.includes("hue")) {
            updatedMapping.color = header;
          } else if (lh.includes("remark") || lh.includes("note") || lh.includes("instruction") || lh.includes("comment")) {
            updatedMapping.remarks = header;
          }
        });

        // Set mapping and run preview
        setMapping(updatedMapping);
        autoGeneratePreview(rows, updatedMapping);

      } catch (err) {
        console.error("Excel parse error:", err);
        alert("Failed to parse Excel file. Ensure standard format.");
      } finally {
        setParsing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Intelligent local copy-paste parser (parses Excel TSV text instantly with headers/columns)
  const handleLocalTextParse = () => {
    if (!rawText.trim()) {
      alert("Please paste some text first.");
      return;
    }

    // Helper to identify and filter out UI artifacts copied from the web app
    const isUIArtifact = (text: string): boolean => {
      const t = text.trim().toLowerCase();
      if (!t) return true;
      const exactUI = [
        "deliver",
        "manage",
        "cancel",
        "close actions",
        "go to top font",
        "yes, delete permanent"
      ];
      if (exactUI.includes(t)) return true;
      const distinctPhrases = [
        "done:",
        "production command center",
        "bulk batch importer",
        "confirm bulk import",
        "map detected columns",
        "import preview",
        "ready to import",
        "missing required columns",
        "excel rows",
        "valid rows"
      ];
      return distinctPhrases.some(phrase => t.includes(phrase));
    };

    const lines = rawText.split("\n")
      .map(l => l.trim())
      .filter(l => l && !isUIArtifact(l));

    if (lines.length === 0) {
      alert("No valid data rows found after filtering out UI artifacts.");
      return;
    }

    // Helper to split a line based on tab, comma, semicolon, or multi-space delimiters
    const splitLine = (line: string): string[] => {
      if (line.includes("\t")) {
        return line.split("\t").map(cell => cell.trim().replace(/^['"]|['"]$/g, ''));
      }
      if (line.includes(",")) {
        return line.split(",").map(cell => cell.trim().replace(/^['"]|['"]$/g, ''));
      }
      if (line.includes(";")) {
        return line.split(";").map(cell => cell.trim().replace(/^['"]|['"]$/g, ''));
      }
      // Fallback: split by multiple spaces (2 or more)
      const parts = line.split(/  +/).map(cell => cell.trim().replace(/^['"]|['"]$/g, ''));
      if (parts.length > 1) {
        return parts;
      }
      // Keep entire line intact rather than corrupting via single space split
      return [line.trim().replace(/^['"]|['"]$/g, '')];
    };

    // Parse the first line to check if it's a header row
    const firstLineCells = splitLine(lines[0]);
    
    // Check if first line cells contain typical header names rather than just raw data
    const hasHeaders = firstLineCells.some(cell => {
      const cl = cell.toLowerCase().trim();
      return ["batch", "buyer", "ref", "color", "qty", "quantity", "type", "remarks", "item", "yarn", "gsm", "dia", "mc"].some(kw => cl.includes(kw));
    });

    const splitLines = lines.map(line => splitLine(line));
    const maxCols = Math.max(...splitLines.map(cols => cols.length));

    let finalHeaders: string[] = [];
    let dataStartIdx = 0;

    if (hasHeaders) {
      // Use detected headers, clean up empty ones, make them unique
      finalHeaders = firstLineCells.map((h, idx) => {
        const cleaned = h.trim();
        return cleaned || `Col ${idx + 1}`;
      });
      dataStartIdx = 1;
    } else {
      // Auto generate column headers
      finalHeaders = Array.from({ length: maxCols }, (_, i) => `Col ${i + 1}`);
      dataStartIdx = 0;
    }

    setHeaders(finalHeaders);

    // Convert rows into key-value objects matching headers
    const rows: any[] = [];
    for (let i = dataStartIdx; i < splitLines.length; i++) {
      const cols = splitLines[i];
      if (cols.length === 0 || (cols.length === 1 && cols[0] === "")) continue;

      const rowObj: Record<string, any> = {};
      let hasRealContent = false;
      finalHeaders.forEach((header, index) => {
        const val = cols[index] !== undefined ? cols[index] : "";
        rowObj[header] = val;
        if (val.trim() !== "") {
          hasRealContent = true;
        }
      });
      if (hasRealContent) {
        rows.push(rowObj);
      }
    }

    setParsedRows(rows);

    // Run identical smart auto-mapping as Excel file upload
    const updatedMapping = {
      batch_number: "",
      fabric_type_name: "",
      buyer: "",
      buyer_reference: "",
      color: "",
      fabric_quantity: "",
      order_number: "",
      trims: "",
      trims_quantity: "",
      machine_number: "",
      lot_number: "",
      remarks: "",
      item_type: "",
    };

    finalHeaders.forEach((header) => {
      const lh = header.toLowerCase().trim();
      if (lh.includes("order") || lh.includes("po") || lh.includes("job")) {
        updatedMapping.order_number = header;
      } else if (lh.includes("machine") || lh.includes("mc") || lh.includes("dia") || lh.includes("mc dia")) {
        updatedMapping.machine_number = header;
      } else if (lh.includes("lot") || lh.includes("yarn lot") || lh.includes("lot no")) {
        updatedMapping.lot_number = header;
      } else if (lh.includes("trims qty") || lh.includes("trims quantity")) {
        updatedMapping.trims_quantity = header;
      } else if (lh.includes("trims") || lh.includes("accessories") || lh.includes("collar") || lh.includes("rib")) {
        updatedMapping.trims = header;
      } else if (lh.includes("fabric qty") || lh.includes("fabric quantity") || lh.includes("fabric weight") || lh.includes("weight") || lh.includes("qty") || lh.includes("quantity") || lh.includes("kg") || lh === "batch qty" || lh === "qty") {
        updatedMapping.fabric_quantity = header;
      } else if (lh === "item" || lh.includes("item") || lh.includes("part") || lh.includes("category")) {
        updatedMapping.item_type = header;
      } else if (lh === "batch" || lh === "code" || lh === "number" || lh.includes("batch") || (lh.includes("number") && !lh.includes("qty") && !lh.includes("quantity") && !lh.includes("weight"))) {
        updatedMapping.batch_number = header;
      } else if (lh.includes("fabric") || lh.includes("type") || lh === "f/type") {
        updatedMapping.fabric_type_name = header;
      } else if (lh.includes("buyer") || lh.includes("brand") || lh.includes("client")) {
        updatedMapping.buyer = header;
      } else if (lh.includes("ref") || lh.includes("style") || lh.includes("reference") || lh === "reff") {
        updatedMapping.buyer_reference = header;
      } else if (lh.includes("color") || lh.includes("shade") || lh.includes("hue")) {
        updatedMapping.color = header;
      } else if (lh.includes("remark") || lh.includes("note") || lh.includes("instruction") || lh.includes("comment") || lh === "remarks") {
        updatedMapping.remarks = header;
      }
    });

    // Only do sequential fallback mapping if there are no headers (so it was auto-generated Col 1, Col 2 etc. in sequence)
    if (!hasHeaders) {
      const requiredKeys: (keyof typeof updatedMapping)[] = ["batch_number", "buyer", "buyer_reference", "fabric_type_name"];
      const optionalKeys: (keyof typeof updatedMapping)[] = ["fabric_quantity", "remarks", "color", "order_number"];

      // Keep track of which headers are already mapped
      const mappedHeaders = new Set<string>();
      Object.values(updatedMapping).forEach(val => {
        if (val) mappedHeaders.add(val);
      });

      // Map remaining required fields to unused headers
      requiredKeys.forEach(key => {
        if (!updatedMapping[key]) {
          const unusedHeader = finalHeaders.find(h => h && !mappedHeaders.has(h));
          if (unusedHeader) {
            updatedMapping[key] = unusedHeader;
            mappedHeaders.add(unusedHeader);
          }
        }
      });

      // Map remaining optional fields to remaining unused headers
      optionalKeys.forEach(key => {
        if (!updatedMapping[key]) {
          const unusedHeader = finalHeaders.find(h => h && !mappedHeaders.has(h));
          if (unusedHeader) {
            updatedMapping[key] = unusedHeader;
            mappedHeaders.add(unusedHeader);
          }
        }
      });
    }

    setMapping(updatedMapping);
    autoGeneratePreview(rows, updatedMapping);
    alert("Pasted text parsed and mapped successfully! Review the Column Matching map and preview below.");
  };

  const handleExecuteImport = async () => {
    if (importPreview.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/batches/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          batches: importPreview,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const successCount = data.count ?? 0;
        const skipErrors = data.errors ?? [];

        if (skipErrors.length > 0) {
          alert(
            `Import completed!\n\n` +
            `• Successfully imported: ${successCount} new batches.\n` +
            `• Skipped / Already existed: ${skipErrors.length} rows.\n\n` +
            `Skipped Details (first 5):\n` +
            skipErrors.slice(0, 5).map((e: string) => ` - ${e}`).join("\n") +
            (skipErrors.length > 5 ? `\n ... and ${skipErrors.length - 5} more.` : "")
          );
        } else {
          alert(`Success! Successfully imported ${successCount} fabric batches and initialized their production timelines.`);
        }
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to import spreadsheet records.");
      }
    } catch (err) {
      console.error("Import execution error:", err);
      alert("An unexpected error occurred during import execution.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <section className="bg-gradient-to-r from-violet-900 to-slate-900 text-slate-100 p-6 rounded-2xl border border-violet-800/20 shadow-md">
        <h4 className="text-base font-display font-bold text-white uppercase tracking-wide">Bulk Batch Importer</h4>
      </section>

      {/* Main Import Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left segment: Upload */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <h5 className="text-sm font-mono uppercase text-slate-400 tracking-wider font-semibold">
              Batch Import Configuration
            </h5>
            
            {/* Tab switcher */}
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200/50 dark:border-slate-800/50 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setImportMethod("file")}
                className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                  importMethod === "file"
                    ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                File Upload
              </button>
              <button
                type="button"
                onClick={() => setImportMethod("text")}
                className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                  importMethod === "text"
                    ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                Copy-Paste Text
              </button>
            </div>
          </div>

          {importMethod === "file" ? (
            /* Upload Button */
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center hover:border-indigo-500 transition relative bg-slate-50/50 dark:bg-slate-950/20">
              {parsing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <span className="text-xs text-slate-400">Reading columns...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="w-9 h-9 text-indigo-500" />
                  <span className="text-xs text-slate-500 font-semibold">Upload Excel / CSV Production Sheet</span>
                  <p className="text-[10px] text-slate-400">xlsx, xls or csv formats supported</p>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Copy-Paste Text Area */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <AlignLeft className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Paste Excel / Sheet Columns</span>
                </label>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Batch\tbuyer\tref\tcolor\tf/type\tbatch qty\tyarn lot\tremarks\n1777\tLCW\t54 A\tblack\tS/J\t500\t125258\tBRASH\n1888\tLCW\t54 A\tblack\t1*1 RIB\t100\t5556w5`}
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                />
              </div>

              <button
                type="button"
                disabled={parsing}
                onClick={handleLocalTextParse}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-indigo-400 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer"
              >
                <AlignLeft className="w-4 h-4" />
                <span>Detect & Preview Batches</span>
              </button>

            </div>
          )}

          {headers.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <h6 className="text-xs font-mono font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Map Detected Columns</span>
                </h6>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono px-2 py-0.5 rounded-full">
                  {headers.length} Columns Found
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Required Fields */}
                <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wide">Required Fields</div>
                  
                  {/* Batch Number */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Batch Number *</span>
                      {!mapping.batch_number && <span className="text-[9px] text-rose-500">Unmapped</span>}
                    </label>
                    <select
                      value={mapping.batch_number}
                      onChange={(e) => handleMappingChange("batch_number", e.target.value)}
                      className={`w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border transition ${
                        !mapping.batch_number 
                          ? "border-rose-400/80 dark:border-rose-500/40 focus:border-rose-500 focus:ring-rose-500" 
                          : "border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-indigo-500"
                      } text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1`}
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Buyer Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Buyer Name *</span>
                      {!mapping.buyer && <span className="text-[9px] text-rose-500">Unmapped</span>}
                    </label>
                    <select
                      value={mapping.buyer}
                      onChange={(e) => handleMappingChange("buyer", e.target.value)}
                      className={`w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border transition ${
                        !mapping.buyer 
                          ? "border-rose-400/80 dark:border-rose-500/40 focus:border-rose-500 focus:ring-rose-500" 
                          : "border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-indigo-500"
                      } text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1`}
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Buyer Reference */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Buyer Reference *</span>
                      {!mapping.buyer_reference && <span className="text-[9px] text-rose-500">Unmapped</span>}
                    </label>
                    <select
                      value={mapping.buyer_reference}
                      onChange={(e) => handleMappingChange("buyer_reference", e.target.value)}
                      className={`w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border transition ${
                        !mapping.buyer_reference 
                          ? "border-rose-400/80 dark:border-rose-500/40 focus:border-rose-500 focus:ring-rose-500" 
                          : "border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-indigo-500"
                      } text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1`}
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Fabric Type */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Fabric Type *</span>
                      {!mapping.fabric_type_name && <span className="text-[9px] text-rose-500">Unmapped</span>}
                    </label>
                    <select
                      value={mapping.fabric_type_name}
                      onChange={(e) => handleMappingChange("fabric_type_name", e.target.value)}
                      className={`w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border transition ${
                        !mapping.fabric_type_name 
                          ? "border-rose-400/80 dark:border-rose-500/40 focus:border-rose-500 focus:ring-rose-500" 
                          : "border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-indigo-500"
                      } text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1`}
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Optional / Extra Fields */}
                <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800 max-h-[340px] overflow-y-auto">
                  <div className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide">Optional Fields</div>

                  {/* Fabric Qty */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Fabric Qty (KG)</label>
                    <select
                      value={mapping.fabric_quantity}
                      onChange={(e) => handleMappingChange("fabric_quantity", e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Skip Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Color */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Color / Shade</label>
                    <select
                      value={mapping.color}
                      onChange={(e) => handleMappingChange("color", e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Skip Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Order Number */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Order Number / PO</label>
                    <select
                      value={mapping.order_number}
                      onChange={(e) => handleMappingChange("order_number", e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Skip Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Yarn Lot */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Yarn Lot No</label>
                    <select
                      value={mapping.lot_number}
                      onChange={(e) => handleMappingChange("lot_number", e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Skip Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Machine No */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Machine No / Dia</label>
                    <select
                      value={mapping.machine_number}
                      onChange={(e) => handleMappingChange("machine_number", e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Skip Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Trims */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Trims/Collar/Rib</label>
                    <select
                      value={mapping.trims}
                      onChange={(e) => handleMappingChange("trims", e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Skip Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Trims Qty */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Trims Qty</label>
                    <select
                      value={mapping.trims_quantity}
                      onChange={(e) => handleMappingChange("trims_quantity", e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Skip Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Remarks / Notes</label>
                    <select
                      value={mapping.remarks}
                      onChange={(e) => handleMappingChange("remarks", e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Skip Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Item Type */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Item Type (Body/Trim)</label>
                    <select
                      value={mapping.item_type}
                      onChange={(e) => handleMappingChange("item_type", e.target.value)}
                      className="w-full p-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Skip Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right segment: Mapped Import Preview */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-6 rounded-2xl shadow-sm space-y-4">
          <h5 className="text-sm font-mono uppercase text-slate-400 tracking-wider font-semibold border-b pb-2">
            Import Preview
          </h5>

          {importStats && (
            <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl text-center border border-slate-100 dark:border-slate-800 text-[10px]">
              <div>
                <span className="block text-slate-400 uppercase font-semibold">Excel Rows</span>
                <strong className="text-sm text-slate-800 dark:text-slate-200">{importStats.totalRawRows}</strong>
              </div>
              <div>
                <span className="block text-slate-400 uppercase font-semibold">Valid Rows</span>
                <strong className="text-sm text-indigo-600 dark:text-indigo-400">{importStats.validRows}</strong>
              </div>
              <div>
                <span className="block text-slate-400 uppercase font-semibold">Batches</span>
                <strong className="text-sm text-emerald-600 dark:text-emerald-400">{importStats.groupedBatches}</strong>
              </div>
            </div>
          )}

          {importPreview.length > 0 ? (
            <div className="space-y-4 slide-in">
              <span className="text-xs text-slate-500 block">
                Ready to import <strong className="text-emerald-500">{importPreview.length} batches</strong>.
              </span>

              {/* Scroll list of preview */}
              <div className="max-h-96 overflow-y-auto space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800 pr-1">
                {importPreview.map((item, index) => (
                  <div key={index} className="pt-2.5 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 dark:text-white">{item.batch_number}</span>
                      {item.order_number && (
                        <span className="text-[10px] font-mono text-slate-400">PO: {item.order_number}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 space-y-0.5">
                      <div>Buyer: <strong className="text-slate-700 dark:text-slate-300">{item.buyer}</strong> ({item.buyer_reference})</div>
                      <div>Fabric: <strong className="text-slate-700 dark:text-slate-300">{item.fabric_type_name}</strong> {item.color ? `• ${item.color}` : ""}</div>
                      <div>Qty: <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{item.fabric_quantity || "0"} KG</strong></div>
                      {item.trims && (
                        <div className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 p-1 rounded font-mono mt-1">
                          Trims: {item.trims} {item.trims_quantity ? `(${item.trims_quantity})` : ""}
                        </div>
                      )}
                      {(item.machine_number || item.lot_number) && (
                        <div className="text-[9px] text-slate-400 font-mono flex gap-2 pt-0.5">
                          {item.machine_number && <span>M/C: {item.machine_number}</span>}
                          {item.lot_number && <span>Yarn Lot: {item.lot_number}</span>}
                        </div>
                      )}
                      {item.remarks && (
                        <div className="text-[10px] italic text-slate-400 border-l-2 border-slate-200 dark:border-slate-800 pl-1.5 mt-1">
                          "{item.remarks}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                disabled={loading}
                onClick={handleExecuteImport}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Confirm Bulk Import</span>
              </button>
            </div>
          ) : (
            mappingErrors.length > 0 ? (
              <div className="p-6 bg-rose-500/5 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl text-xs space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>Missing Required Columns</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 leading-normal">
                  Our system couldn't auto-detect the following required columns in your file:
                </p>
                <ul className="list-disc list-inside font-mono text-[11px] bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-500/10 text-rose-700 dark:text-rose-300 space-y-0.5">
                  {mappingErrors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <p className="text-slate-400 text-[10px] leading-normal pt-1">
                  Please make sure your sheet or pasted text contains headers matching these fields (e.g. 'batch', 'buyer', 'ref', 'color', 'qty' or 'fabric') so they can be parsed correctly.
                </p>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 border border-dashed border-slate-100 dark:border-slate-800 rounded-xl text-xs">
                Map and preview headers first.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
