"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keys, isApiError, csrfFetch } from "@/lib/shared";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload, CheckCircle, XCircle, ArrowRight } from "lucide-react";

type BulkRow = {
  row_index: number;
  customer_id: string;
  pickup_address: string;
  drop_address: string;
  schedule_date: string;
  vehicle_types: string[];
  reference?: string;
};

type BulkRowVerdict = {
  row_index: number;
  valid: boolean;
  errors?: string[];
  offers?: Array<{ price_id: string; price_minor: number; currency: string }>;
};

type BulkPreviewResult = {
  preview_token?: string;
  rows?: BulkRowVerdict[];
  valid_count?: number;
  invalid_count?: number;
};

type Phase = "upload" | "verdict" | "done";

function parseCsv(text: string): BulkRow[] {
  const lines = text.trim().split("\n");
  return lines.slice(1).map((line, idx) => {
    const parts = line.split(",").map((p) => p.trim());
    return {
      row_index: idx + 1,
      customer_id: parts[0] ?? "",
      pickup_address: parts[1] ?? "",
      drop_address: parts[2] ?? "",
      schedule_date: parts[3] ?? "",
      vehicle_types: (parts[4] ?? "").split("|").filter(Boolean),
      reference: parts[5] ?? undefined,
    };
  });
}

export const BulkUploadCreation: React.FC<{ onDone?: () => void }> = ({ onDone }) => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>("upload");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [verdicts, setVerdicts] = useState<BulkRowVerdict[]>([]);
  const [previewResult, setPreviewResult] = useState<BulkPreviewResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    setRows(parsed);
    setValidating(true);
    try {
      const resp = await csrfFetch("/api/v1/trips/bulk/preview/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed }),
      });
      const envelope = await resp.json() as { result?: BulkPreviewResult; error?: { message?: string } };
      if (!resp.ok) {
        throw new Error(envelope?.error?.message ?? `Preview failed (${resp.status})`);
      }
      const result = envelope.result ?? (envelope as unknown as BulkPreviewResult);
      const rowVerdicts = result.rows ?? [];
      setVerdicts(rowVerdicts);
      setPreviewResult(result);
      const validSet = new Set(
        rowVerdicts.filter((v) => v.valid).map((v) => v.row_index)
      );
      setSelectedRows(validSet);
      setPhase("verdict");
    } catch (err) {
      addToast(isApiError(err) ? err.message : err instanceof Error ? err.message : "Validation failed", "error");
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const commitRows = verdicts
        .filter((v) => v.valid && selectedRows.has(v.row_index))
        .map((v) => ({
          row_index: v.row_index,
          price_ids: (v.offers ?? []).map((o) => o.price_id),
        }));

      const resp = await csrfFetch("/api/v1/trips/bulk/commit/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview_token: previewResult?.preview_token,
          rows: commitRows,
        }),
      });
      const envelope = await resp.json() as { result?: { created?: unknown[] }; error?: { message?: string } };
      if (!resp.ok) {
        throw new Error(envelope?.error?.message ?? `Commit failed (${resp.status})`);
      }
      const result = envelope.result ?? {};
      const created = (result as { created?: unknown[] }).created ?? [];
      addToast(`${created.length} trips created`, "success");
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
      setPhase("done");
      onDone?.();
    } catch (err) {
      addToast(isApiError(err) ? err.message : err instanceof Error ? err.message : "Commit failed", "error");
    } finally {
      setCommitting(false);
    }
  };

  const toggleRow = (idx: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (phase === "done") {
    return (
      <Card padding="lg" className="text-center py-8 space-y-3">
        <p className="text-2xl">✅</p>
        <p className="font-semibold text-text-primary">Bulk trips created!</p>
        <Button onClick={() => { setPhase("upload"); setRows([]); setVerdicts([]); setPreviewResult(null); }}>
          Upload another
        </Button>
      </Card>
    );
  }

  if (phase === "verdict") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Validation Results</h3>
          <div className="flex gap-2 text-xs text-text-secondary">
            <span className="text-green-400">{previewResult?.valid_count ?? 0} valid</span>
            <span>·</span>
            <span className="text-danger">{previewResult?.invalid_count ?? 0} invalid</span>
          </div>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {verdicts.map((verdict) => (
            <div key={verdict.row_index} className={`p-3 rounded border text-xs ${verdict.valid ? "border-green-700/40 bg-green-900/10" : "border-danger/30 bg-danger/5"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {verdict.valid ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-danger" />
                  )}
                  <span className="font-medium">Row {verdict.row_index}</span>
                </div>
                {verdict.valid && (
                  <input
                    type="checkbox"
                    checked={selectedRows.has(verdict.row_index)}
                    onChange={() => toggleRow(verdict.row_index)}
                    className="w-4 h-4"
                  />
                )}
              </div>
              {verdict.errors && verdict.errors.length > 0 && (
                <ul className="mt-1 pl-6 space-y-0.5 text-danger">
                  {verdict.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {verdict.valid && verdict.offers && verdict.offers.length > 0 && (
                <p className="mt-1 text-green-300 pl-6">{verdict.offers.length} offer(s) available</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={() => setPhase("upload")} variant="secondary">Back</Button>
          <Button
            onClick={() => { void handleCommit(); }}
            variant="primary"
            disabled={selectedRows.size === 0 || committing}
            className="flex-1"
          >
            {committing ? "Creating…" : `Commit ${selectedRows.size} trip(s)`} <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card padding="lg" className="border-dashed text-center space-y-3 py-8">
        <Upload className="w-8 h-8 mx-auto text-text-secondary" />
        <p className="text-sm text-text-secondary">
          Upload a CSV file with columns:<br />
          <code className="text-xs">customer_id, pickup_address, drop_address, schedule_date, vehicle_types(|sep), reference</code>
        </p>
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={(e) => { void handleFile(e); }}
            disabled={validating}
          />
          <span className={`inline-flex items-center px-4 py-2 rounded text-sm font-medium border border-border bg-white text-text-primary cursor-pointer ${validating ? "opacity-50 pointer-events-none" : "hover:bg-ops-card2"}`}>
            {validating ? "Validating…" : "Choose CSV File"}
          </span>
        </label>
      </Card>
    </div>
  );
};

BulkUploadCreation.displayName = "BulkUploadCreation";
