"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in plain words. Shown above the buttons. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions (retiring records, cascading deletes). */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A yes/no dialog for actions that need an explicit decision rather than a toast.
 *
 * Used where the server refuses an action but offers a way through — e.g. retiring a vendor
 * that still has vehicles. A toast can only report the refusal; this can act on it.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) => (
  <Modal open={open} onClose={onCancel} title={title} size="sm">
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        {destructive && <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />}
        <p className="text-sm text-text-primary">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          size="sm"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
);
