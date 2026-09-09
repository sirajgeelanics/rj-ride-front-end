"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/shared";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";

// Not yet in the generated OpenAPI schema (a new backend endpoint) — hand-typed to match
// apps.fleet.api.serializers.VendorLoginSerializer.
interface VendorLogin {
  id: string;
  email: string;
  name: string;
  role: string;
  vendor_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

async function parseResult<T>(resp: Response): Promise<T> {
  const body = (await resp.json().catch(() => null)) as
    | { result?: T; error?: { message?: string } }
    | null;
  if (!resp.ok) {
    throw new Error(body?.error?.message ?? `Request failed (${resp.status})`);
  }
  return body?.result as T;
}

interface VendorLoginPanelProps {
  vendorId: string;
  vendorEmail: string;
}

export const VendorLoginPanel: React.FC<VendorLoginPanelProps> = ({ vendorId, vendorEmail }) => {
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  // Required on both create and reset — the backend never generates a password, so this is
  // always the final value.
  const [chosenPassword, setChosenPassword] = useState("");

  const loginUrl = `/api/v1/config/vendors/${vendorId}/login/`;
  const queryKey = ["vendor-login", vendorId];

  const { data: login, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<VendorLogin | null> => {
      const resp = await csrfFetch(loginUrl, { method: "GET" });
      if (resp.status === 404) return null;
      return parseResult<VendorLogin>(resp);
    },
  });

  const onMutationError = (action: string) => (err: unknown) =>
    addToast(err instanceof Error ? err.message : `Failed to ${action}`, "error");

  const create = useMutation({
    mutationFn: async () => {
      const resp = await csrfFetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: chosenPassword.trim() }),
      });
      return parseResult<VendorLogin>(resp);
    },
    onSuccess: () => {
      setChosenPassword("");
      void queryClient.invalidateQueries({ queryKey });
      addToast("Login created", "success");
    },
    onError: onMutationError("create login"),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const resp = await csrfFetch(loginUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: chosenPassword.trim() }),
      });
      return parseResult<VendorLogin>(resp);
    },
    onSuccess: () => {
      setChosenPassword("");
      void queryClient.invalidateQueries({ queryKey });
      addToast("Password reset", "success");
    },
    onError: onMutationError("reset password"),
  });

  const deactivate = useMutation({
    mutationFn: async () => {
      const resp = await csrfFetch(loginUrl, { method: "DELETE" });
      return parseResult<VendorLogin>(resp);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      addToast("Login deactivated", "success");
    },
    onError: onMutationError("deactivate login"),
  });

  const reactivate = useMutation({
    mutationFn: async () => {
      const resp = await csrfFetch(`${loginUrl}reactivate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return parseResult<VendorLogin>(resp);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      addToast("Login reactivated", "success");
    },
    onError: onMutationError("reactivate login"),
  });

  const busy =
    create.isPending || reset.isPending || deactivate.isPending || reactivate.isPending;

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <p className="text-sm font-medium text-text-primary">Login credentials</p>

      {isLoading ? (
        <p className="text-xs text-text-secondary">Checking…</p>
      ) : !login ? (
        <div className="space-y-2">
          <p className="text-xs text-text-secondary">
            This vendor has no portal login yet.
            {!vendorEmail && " Set a contact email above first — the login needs one."}
          </p>
          <Input
            type="password"
            value={chosenPassword}
            onChange={(e) => setChosenPassword(e.target.value)}
            placeholder="Min 12 characters — this is the final password"
            autoComplete="new-password"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => create.mutate()}
            disabled={busy || !vendorEmail || chosenPassword.trim().length < 12}
          >
            Create login
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="font-mono text-text-primary">{login.email}</span>
            <span
              className={`px-1.5 py-0.5 rounded font-medium ${
                login.is_active ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
              }`}
            >
              {login.is_active ? "Active" : "Deactivated"}
            </span>
          </div>
          <Input
            type="password"
            value={chosenPassword}
            onChange={(e) => setChosenPassword(e.target.value)}
            placeholder="Min 12 characters — this is the final password"
            autoComplete="new-password"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => reset.mutate()}
              disabled={busy || chosenPassword.trim().length < 12}
            >
              Reset password
            </Button>
            {login.is_active ? (
              <Button
                size="sm"
                variant="ghost"
                className="hover:bg-danger/10! hover:text-danger!"
                onClick={() => deactivate.mutate()}
                disabled={busy}
              >
                Deactivate
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => reactivate.mutate()} disabled={busy}>
                Reactivate
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

VendorLoginPanel.displayName = "VendorLoginPanel";
