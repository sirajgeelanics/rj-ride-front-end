"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

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
  <Modal open={open} onClose={onCancel} title={title} size="sm" confirmModal={busy}>
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        {destructive && (
          <span className="w-9 h-9 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-[18px] h-[18px] text-danger" />
          </span>
        )}
        <p className="text-sm text-text-secondary leading-relaxed pt-1.5">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
);
