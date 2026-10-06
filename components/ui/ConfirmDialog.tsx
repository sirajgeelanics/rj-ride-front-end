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
        {destructive && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft">
            <AlertTriangle className="w-4.5 h-4.5 text-danger" />
          </span>
        )}
        <p className="text-sm leading-relaxed text-text-secondary pt-1.5">{message}</p>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          size="md"
          onClick={onConfirm}
          loading={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
);
