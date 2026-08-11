"use client";

import React from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2 } from "lucide-react";

interface TripMetadataProps {
  coordinator?: { name?: string; phone?: string };
  viewers?: string[];
  costCenter?: string;
  pos?: string;
  onUpdate: (updates: {
    coordinator?: { name?: string; phone?: string };
    viewers?: string[];
    costCenter?: string;
    pos?: string;
  }) => void;
}

export const TripMetadata: React.FC<TripMetadataProps> = ({ coordinator = {}, viewers = [], costCenter = "", pos = "", onUpdate }) => {
  const [newViewerEmail, setNewViewerEmail] = React.useState("");

  const addViewer = () => {
    if (!newViewerEmail || viewers.includes(newViewerEmail)) return;
    onUpdate({ viewers: [...viewers, newViewerEmail] });
    setNewViewerEmail("");
  };

  const removeViewer = (email: string) => {
    onUpdate({ viewers: viewers.filter((v) => v !== email) });
  };

  return (
    <Card padding="lg" header={<h3 className="font-semibold">Trip Metadata & Access</h3>}>
      <div className="space-y-4">
        {/* Coordinator */}
        <div className="border-b border-border pb-4">
          <p className="text-xs font-medium text-text-primary mb-3">Coordinator (who booked this)</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name (optional)">
              <Input
                value={coordinator.name || ""}
                onChange={(e) => onUpdate({ coordinator: { ...coordinator, name: e.target.value } })}
                placeholder="John Smith"
              />
            </FormField>
            <FormField label="Phone (optional)">
              <Input
                value={coordinator.phone || ""}
                onChange={(e) => onUpdate({ coordinator: { ...coordinator, phone: e.target.value } })}
                placeholder="+91-9876543210"
              />
            </FormField>
          </div>
        </div>

        {/* Cost Center */}
        <FormField label="Cost Center (optional)">
          <Input value={costCenter} onChange={(e) => onUpdate({ costCenter: e.target.value })} placeholder="e.g., DEPT-001, PROJECT-X" />
        </FormField>

        {/* POS / Booking System */}
        <FormField label="Point of Sale (optional)">
          <Input value={pos} onChange={(e) => onUpdate({ pos: e.target.value })} placeholder="e.g., WEBSITE, MOBILE_APP, CRM" />
        </FormField>

        {/* Viewers / Access Control */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-medium text-text-primary mb-3">Viewers (who can see this trip)</p>
          <div className="space-y-2 mb-3">
            {viewers.length === 0 ? (
              <p className="text-xs text-text-secondary italic">No additional viewers — only creator and system can view</p>
            ) : (
              viewers.map((email) => (
                <div key={email} className="flex items-center justify-between bg-ops-bg p-2 rounded text-xs">
                  <span className="text-text-primary">{email}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeViewer(email)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="email@company.com"
              value={newViewerEmail}
              onChange={(e) => setNewViewerEmail(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addViewer()}
            />
            <Button onClick={addViewer} size="sm" variant="secondary">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

TripMetadata.displayName = "TripMetadata";
