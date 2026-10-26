import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keys, isApiError, csrfFetch } from "@/lib/shared";
import { uuidv4 } from "@/lib/shared/uuid";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload, CheckCircle, XCircle, ArrowRight } from "lucide-react";

// Matches apps.trips.bulk.BulkRowResult.as_dict() exactly (apps/trips/bulk.py).
type BulkRowVerdict = {
  row: number;
  ok: boolean;
  errors: string[];
};

// Matches apps.trips.bulk.BulkPreviewResult.as_dict().
type BulkPreviewResult = {
  rows: BulkRowVerdict[];
  upload_token: string;
  valid_count: number;
  invalid_count: number;
};

// Matches apps.trips.api.bulk_views.BulkCommitView's {"results": [...]} body — each entry is
// either a success ({row, ok: true, trip_reference, trip_id}) or a failure ({row, ok: false, error}).
type BulkCommitRow =
  | { row: number; ok: true; trip_reference: string; trip_id: string }
  | { row: number; ok: false; error: string };

type Phase = "upload" | "verdict" | "done";

const REQUIRED_COLUMNS_HINT =
  "customer_ref, pickup_at, pickup_address, drop_address, vehicle_type, pax_count";
const OPTIONAL_COLUMNS_HINT =
  "pickup_lat, pickup_lng, drop_lat, drop_lng (leave blank to geocode the address automatically), " +
  "passenger_name, passenger_phone (one contact per row, not one per pax_count seat), " +
  "vendor_ref (vendor name — if left blank, the first vendor with an applicable rate card is used)";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // apps.trips.bulk._MAX_FILE_BYTES

export const BulkUploadCreation: React.FC<{ onDone?: () => void }> = ({ onDone }) => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>("upload");
  const [preview, setPreview] = useState<BulkPreviewResult | null>(null);
  const [commitResults, setCommitResults] = useState<BulkCommitRow[]>([]);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-choosing the same file after a failed attempt
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      addToast(
        `File is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 2 MB.`,
        "error",
      );
      return;
    }

    setValidating(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const resp = await csrfFetch("/api/v1/trips/bulk/preview/", {
        method: "POST",
        body: formData,
      });
      const body = (await resp.json()) as BulkPreviewResult & { error?: { message?: string } };
      if (!resp.ok) {
        throw new Error(body?.error?.message ?? `Preview failed (${resp.status})`);
      }
      setPreview(body);
      setPhase("verdict");
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Validation failed",
        "error",
      );
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    try {
      const resp = await csrfFetch("/api/v1/trips/bulk/commit/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Required by BulkCommitView (core.idempotency.IdempotencyMixin) — the upload_token
          // is single-use server-side regardless, but the header itself is mandatory.
          "Idempotency-Key": uuidv4(),
        },
        body: JSON.stringify({ upload_token: preview.upload_token }),
      });
      const body = (await resp.json()) as { results?: BulkCommitRow[]; error?: { message?: string } };
      if (!resp.ok) {
        throw new Error(body?.error?.message ?? `Commit failed (${resp.status})`);
      }
      const results = body.results ?? [];
      setCommitResults(results);
      const succeeded = results.filter((r) => r.ok).length;
      const failed = results.length - succeeded;
      addToast(
        failed > 0
          ? `${succeeded} trip(s) created, ${failed} failed — see details below.`
          : `${succeeded} trip(s) created.`,
        failed > 0 ? "info" : "success",
      );
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
      setPhase("done");
      onDone?.();
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Commit failed",
        "error",
      );
    } finally {
      setCommitting(false);
    }
  };

  const reset = () => {
    setPhase("upload");
    setPreview(null);
    setCommitResults([]);
  };

  if (phase === "done") {
    const succeeded = commitResults.filter((r) => r.ok).length;
    const failed = commitResults.filter((r) => !r.ok) as Extract<BulkCommitRow, { ok: false }>[];
    return (
      <Card padding="lg" className="space-y-3 py-8">
        <div className="text-center space-y-2">
          <p className="text-2xl">{failed.length === 0 ? "✅" : "⚠️"}</p>
          <p className="font-semibold text-text-primary">
            {succeeded} trip(s) created{failed.length > 0 ? `, ${failed.length} failed` : ""}
          </p>
        </div>
        {failed.length > 0 && (
          <div className="space-y-1 max-h-60 overflow-y-auto text-xs">
            {failed.map((r) => (
              <div key={r.row} className="p-2 rounded border border-danger/30 bg-danger/5">
                Row {r.row}: {r.error}
              </div>
            ))}
          </div>
        )}
        <div className="text-center">
          <Button onClick={reset}>Upload another</Button>
        </div>
      </Card>
    );
  }

  if (phase === "verdict" && preview) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Validation Results</h3>
          <div className="flex gap-2 text-xs text-text-secondary">
            <span className="text-green-400">{preview.valid_count} valid</span>
            <span>·</span>
            <span className="text-danger">{preview.invalid_count} invalid</span>
          </div>
        </div>

        {preview.invalid_count > 0 && (
          <p className="text-xs text-text-secondary">
            Invalid rows are skipped automatically — only the {preview.valid_count} valid row(s)
            below will be booked.
          </p>
        )}

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {preview.rows.map((verdict) => (
            <div
              key={verdict.row}
              className={`p-3 rounded border text-xs ${verdict.ok ? "border-green-700/40 bg-green-900/10" : "border-danger/30 bg-danger/5"}`}
            >
              <div className="flex items-center gap-2">
                {verdict.ok ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-danger" />
                )}
                <span className="font-medium">Row {verdict.row}</span>
              </div>
              {verdict.errors.length > 0 && (
                <ul className="mt-1 pl-6 space-y-0.5 text-danger">
                  {verdict.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={reset} variant="secondary">
            Back
          </Button>
          <Button
            onClick={() => {
              void handleCommit();
            }}
            variant="primary"
            disabled={preview.valid_count === 0 || committing}
            className="flex-1"
          >
            {committing ? "Creating…" : `Commit ${preview.valid_count} trip(s)`}{" "}
            <ArrowRight className="w-4 h-4 ml-1" />
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
          Upload a CSV or XLSX file (max 500 rows, 2 MB) with columns:
          <br />
          <code className="text-xs">{REQUIRED_COLUMNS_HINT}</code>
          <br />
          <span className="text-xs">Optional: {OPTIONAL_COLUMNS_HINT}</span>
        </p>
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              void handleFile(e);
            }}
            disabled={validating}
          />
          <span
            className={`inline-flex items-center px-4 py-2 rounded text-sm font-medium border border-border bg-white text-text-primary cursor-pointer ${validating ? "opacity-50 pointer-events-none" : "hover:bg-ops-card2"}`}
          >
            {validating ? "Validating…" : "Choose File"}
          </span>
        </label>
      </Card>
    </div>
  );
};

BulkUploadCreation.displayName = "BulkUploadCreation";
