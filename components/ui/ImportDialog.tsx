"use client";

import React, { useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Download, FileSpreadsheet, FileUp, X } from "lucide-react";
import { csrfFetch } from "@/lib/shared";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type ImportRowError = {
  row: number;
  field: string | null;
  message: string;
  /** The row as uploaded (never the password), so failed rows can be downloaded and fixed. */
  values?: Record<string, string>;
};

type ImportSection = {
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: ImportRowError[];
  ignored_columns: string[];
};

type ImportResponse =
  | (ImportSection & { dry_run: boolean })
  | {
      dry_run: boolean;
      vehicles: ImportSection | null;
      drivers: ImportSection | null;
      skipped_sheets: string[];
    };

type ImportReport = {
  dryRun: boolean;
  sections: { label: string; noun: string; data: ImportSection }[];
  skipped: string[];
};

function toReport(result: ImportResponse, noun: string): ImportReport {
  if ("vehicles" in result) {
    const sections: ImportReport["sections"] = [];
    if (result.vehicles) sections.push({ label: "Vehicles", noun: "vehicle", data: result.vehicles });
    if (result.drivers) sections.push({ label: "Drivers", noun: "driver", data: result.drivers });
    return { dryRun: result.dry_run, sections, skipped: result.skipped_sheets };
  }
  return { dryRun: result.dry_run, sections: [{ label: "", noun, data: result }], skipped: [] };
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The failed rows as a CSV (UTF-8 with BOM so Excel opens it correctly) plus a Problem column. */
function failedRowsCsv(errors: ImportRowError[]): string {
  const columns = [...new Set(errors.flatMap((err) => Object.keys(err.values ?? {})))];
  const lines = [[...columns, "problem"].map(csvCell).join(",")];
  for (const err of errors) {
    const problem = err.field ? `${err.field}: ${err.message}` : err.message;
    lines.push([...columns.map((col) => err.values?.[col] ?? ""), problem].map(csvCell).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function downloadFailedRows(errors: ImportRowError[], name: string) {
  const url = URL.createObjectURL(new Blob([failedRowsCsv(errors)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Collection URL, e.g. "/api/v1/fleet/vehicles". `/import/` and `/import-template/` hang off it. */
  endpoint: string;
  templateFilename: string;
  /** Plain-language description of the expected columns. */
  columnsHint: React.ReactNode;
  noun: string;
  vendors: { value: string; label: string }[];
  onImported: () => void;
}

async function errorMessage(resp: Response): Promise<string> {
  const body = (await resp.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? `Request failed (${resp.status})`;
}

export function ImportDialog({
  open,
  onClose,
  title,
  endpoint,
  templateFilename,
  columnsHint,
  noun,
  vendors,
  onImported,
}: ImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [vendorId, setVendorId] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [busy, setBusy] = useState<"validate" | "import" | null>(null);
  const [result, setResult] = useState<ImportReport | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setFile(null);
    setUpdateExisting(false);
    setVendorId("");
    setResult(null);
    setFailure(null);
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const ACCEPTED = /\.(xlsx|xls|csv)$/i;

  const pickFile = (picked: File | null) => {
    if (picked && !ACCEPTED.test(picked.name)) {
      setFile(null);
      setResult(null);
      setFailure("Please choose an Excel (.xlsx, .xls) or CSV file.");
      return;
    }
    setFile(picked);
    setResult(null);
    setFailure(null);
  };

  const downloadTemplate = async () => {
    setFailure(null);
    try {
      const resp = await csrfFetch(`${endpoint}/import-template/`);
      if (!resp.ok) throw new Error(await errorMessage(resp));
      const url = URL.createObjectURL(await resp.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = templateFilename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not download the template");
    }
  };

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(dryRun ? "validate" : "import");
    setFailure(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("dry_run", dryRun ? "true" : "false");
      if (updateExisting) form.append("update_existing", "true");
      if (vendorId) form.append("vendor", vendorId);
      const resp = await csrfFetch(`${endpoint}/import/`, { method: "POST", body: form });
      if (!resp.ok) throw new Error(await errorMessage(resp));
      const body = (await resp.json()) as { result: ImportResponse };
      const report = toReport(body.result, noun);
      setResult(report);
      if (!dryRun && report.sections.some((section) => section.data.created + section.data.updated > 0)) onImported();
    } catch (err) {
      setResult(null);
      setFailure(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  };

  const imported = result !== null && !result.dryRun;
  const canImport = file !== null && busy === null && !imported;
  const plural = (word: string, n: number) => `${word}${n === 1 ? "" : "s"}`;
  const formatSize = (bytes: number) =>
    bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  // Step 1 Choose file -> 2 Check (dry run) -> 3 Import. `current` is the active step (4 = all done).
  const current = imported ? 4 : result ? 3 : file ? 2 : 1;
  const steps = ["Choose file", "Check", "Import"];

  return (
    <Modal open={open} onClose={close} title={title} size="lg">
      <div className="space-y-5">
        <ol className="flex items-center" aria-label="Import progress">
          {steps.map((label, idx) => {
            const n = idx + 1;
            const done = current > n;
            const active = current === n;
            return (
              <li key={label} className="flex items-center flex-1 last:flex-none" aria-current={active ? "step" : undefined}>
                <span className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      done
                        ? "bg-success text-white"
                        : active
                          ? "bg-brand-blue text-white shadow-soft ring-4 ring-brand-blue/10"
                          : "bg-ops-card2 text-text-tertiary"
                    }`}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : n}
                  </span>
                  <span className={`text-xs font-semibold ${active || done ? "text-text-primary" : "text-text-tertiary"}`}>
                    {label}
                  </span>
                </span>
                {idx < steps.length - 1 && (
                  <span className={`mx-3 h-px flex-1 transition-colors ${done ? "bg-success/50" : "bg-border"}`} />
                )}
              </li>
            );
          })}
        </ol>

        <div className="rounded-xl border border-ops-line bg-ops-bg px-4 py-3 text-sm text-text-secondary space-y-1.5">
          <p className="leading-relaxed">{columnsHint}</p>
          <button
            type="button"
            onClick={() => void downloadTemplate()}
            className="inline-flex items-center gap-1.5 text-brand-blue hover:underline font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download template
          </button>
          <p className="text-xs text-text-tertiary">
            Excel (.xlsx, .xls) or CSV, any encoding. Up to 2,000 rows per sheet. Rows that pass are
            saved even if others fail.
          </p>
        </div>

        <label className="block">
          <span className="block text-xs font-semibold text-text-primary mb-1.5">Vendor for every row (optional)</span>
          <select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              setResult(null);
            }}
            className="w-full h-10 bg-white border border-border rounded-lg px-3 text-sm text-text-primary hover:border-[#C2C7CF] transition-[border-color,box-shadow] focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
          >
            <option value="">Use the vendor column in the file</option>
            {vendors.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-start gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-soft">
          <button
            type="button"
            role="switch"
            aria-checked={updateExisting}
            aria-labelledby="import-update-label"
            aria-describedby="import-update-hint"
            onClick={() => {
              setUpdateExisting((v) => !v);
              setResult(null);
            }}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2 ${
              updateExisting ? "bg-brand-blue" : "bg-[#C9CDD4]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-transform duration-200 ease-[var(--ease-spring)] ${
                updateExisting ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <div className="min-w-0">
            <p id="import-update-label" className="text-sm font-semibold text-text-primary">
              Update existing records
            </p>
            <p id="import-update-hint" className="text-xs leading-relaxed text-text-secondary mt-0.5">
              A vehicle (matched by plate) or driver (matched by licence number) that already exists
              is updated with the values in the file instead of being rejected. Blank cells never
              erase existing data.
            </p>
          </div>
        </div>

        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-success shadow-soft">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary truncate">{file.name}</p>
              <p className="text-xs text-text-secondary tabular-nums">{formatSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                pickFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              disabled={busy !== null}
              aria-label="Remove file"
              className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-all focus-within:ring-2 focus-within:ring-brand-blue/30 ${
              dragging
                ? "border-brand-blue bg-navy-soft scale-[1.01]"
                : "border-border bg-ops-bg hover:border-brand-blue/60 hover:bg-white"
            }`}
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${dragging ? "bg-brand-blue text-white" : "bg-white text-brand-blue shadow-soft"}`}>
              <FileUp className="w-5 h-5" />
            </span>
            <span className="text-sm font-semibold text-text-primary">
              {dragging ? "Drop to upload" : "Drag a file here, or click to browse"}
            </span>
            <span className="text-xs text-text-tertiary">.xlsx, .xls or .csv</span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        {failure && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{failure}</span>
          </div>
        )}

        {result && (
          <div className="space-y-5">
            {result.sections.map(({ label, noun: sectionNoun, data }) => (
              <div key={label || sectionNoun} className="space-y-3 animate-rise-in">
                {label && <h3 className="font-serif text-xl font-medium text-text-primary">{label}</h3>}

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { name: "New", value: data.created, tone: "border-success/25 bg-success-soft text-success" },
                    { name: "Updated", value: data.updated, tone: "border-brand-blue/20 bg-navy-soft text-brand-blue" },
                    { name: "Failed", value: data.failed, tone: data.failed > 0 ? "border-danger/25 bg-danger-soft text-danger" : "border-border bg-ops-card2 text-text-tertiary" },
                  ].map((stat) => (
                    <div key={stat.name} className={`rounded-xl border px-4 py-3 ${stat.tone}`}>
                      <p className="text-2xl font-semibold tabular-nums leading-none">{stat.value}</p>
                      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-80">{stat.name}</p>
                    </div>
                  ))}
                </div>

                <div
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                    data.failed === 0
                      ? "border-success/30 bg-success-soft text-success"
                      : "border-alert-amber/40 bg-amber-soft text-text-primary"
                  }`}
                >
                  {data.failed === 0 ? (
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-alert-amber" />
                  )}
                  <span>
                    {result.dryRun
                      ? `Check complete — ${data.created + data.updated} of ${data.total} ${plural(
                          sectionNoun,
                          data.total,
                        )} ready (${data.created} new, ${data.updated} to update), ${data.failed} with problems. Nothing has been saved yet.`
                      : `Saved ${data.created + data.updated} of ${data.total} ${plural(
                          sectionNoun,
                          data.total,
                        )} (${data.created} new, ${data.updated} updated)${
                          data.failed ? `; ${data.failed} could not be imported.` : "."
                        }`}
                  </span>
                </div>

                {data.ignored_columns.length > 0 && (
                  <p className="text-xs text-text-secondary">
                    Ignored columns: {data.ignored_columns.join(", ")}
                  </p>
                )}

                {data.errors.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-border custom-scrollbar">
                    <table className="w-full text-xs">
                      <thead className="bg-ops-card2 text-text-secondary sticky top-0 z-10">
                        <tr>
                          <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-3 py-2 w-16">Row</th>
                          <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-3 py-2 w-32">Column</th>
                          <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-3 py-2">Problem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.errors.map((err, i) => (
                          <tr key={`${err.row}-${i}`} className="border-t border-ops-line hover:bg-ops-bg">
                            <td className="px-3 py-2 tabular-nums">{err.row}</td>
                            <td className="px-3 py-2 font-mono text-text-secondary">{err.field ?? "—"}</td>
                            <td className="px-3 py-2 text-text-primary">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {data.errors.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadFailedRows(data.errors, `failed-${sectionNoun}s.csv`)
                    }
                    className="inline-flex items-center gap-1.5 text-xs text-brand-blue hover:underline font-medium cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download failed rows (fix and re-upload)
                  </button>
                )}
              </div>
            ))}

            {result.skipped.length > 0 && (
              <p className="text-xs text-text-secondary">
                Skipped sheets (not vehicles or drivers): {result.skipped.join(", ")}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-ops-line">
          <Button variant="secondary" onClick={close} disabled={busy !== null}>
            {imported ? "Done" : "Cancel"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void run(true)}
            disabled={!canImport}
            loading={busy === "validate"}
          >
            Check file
          </Button>
          <Button onClick={() => void run(false)} disabled={!canImport} loading={busy === "import"}>
            Import
          </Button>
        </div>
      </div>
    </Modal>
  );
}
