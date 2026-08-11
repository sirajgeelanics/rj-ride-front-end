"use client";

import React, { useState } from "react";
import { TripRequest, TripStatus } from "@/lib/types";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Receipt, Download, CheckCircle } from "lucide-react";

interface BillingSectionProps {
  trip: TripRequest;
  onMarkBilled?: () => void;
}

export const BillingSection: React.FC<BillingSectionProps> = ({ trip, onMarkBilled }) => {
  const addToast = useToastStore((s) => s.addToast);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  const totalPrice = trip.vehicles.reduce((sum, v) => sum + (v.lockedPrice || 0), 0);
  const canBill = trip.status === "COMPLETED" && totalPrice > 0;

  const handleGenerateInvoice = async () => {
    setIsGeneratingInvoice(true);
    try {
      // Simulate invoice generation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
      addToast(`Invoice ${invoiceNumber} generated`, "success");

      // In production, this would trigger the billing API
      // and update trip status to BILLED
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleMarkBilled = async () => {
    setIsGeneratingInvoice(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      onMarkBilled?.();
      addToast("Trip marked as BILLED", "success");
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  return (
    <Card padding="lg" header={<h3 className="font-semibold flex items-center gap-2">💰 Billing</h3>}>
      <div className="space-y-4">
        {/* Trip Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-secondary">Trip Status</p>
            <Badge variant={trip.status === "COMPLETED" ? "green" : "blue"}>{trip.status}</Badge>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Billing Status</p>
            <Badge variant={trip.status === "BILLED" ? "green" : "amber"}>{trip.status === "BILLED" ? "BILLED" : "PENDING"}</Badge>
          </div>
        </div>

        {/* Price Summary */}
        <div className="bg-ops-bg rounded p-3 space-y-2">
          <p className="text-xs font-medium text-text-primary">Price Breakdown:</p>
          <div className="space-y-1">
            {trip.vehicles.map((vehicle, idx) => (
              <div key={vehicle.id} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Vehicle {idx + 1}</span>
                <span className="text-text-primary">${vehicle.lockedPrice || "—"}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex items-center justify-between font-medium">
              <span className="text-text-primary">Total</span>
              <span className="text-green-400">${totalPrice}</span>
            </div>
          </div>
        </div>

        {/* Billing Info */}
        {trip.costCenter && (
          <div className="text-xs">
            <span className="text-text-secondary">Cost Center: </span>
            <span className="text-text-primary">{trip.costCenter}</span>
          </div>
        )}

        {/* Actions */}
        {trip.status === "COMPLETED" && (
          <div className="flex gap-2 pt-2">
            <Button onClick={handleGenerateInvoice} variant="secondary" loading={isGeneratingInvoice} disabled={!canBill}>
              <Receipt className="w-3 h-3 mr-1" /> Generate Invoice
            </Button>
            <Button onClick={handleMarkBilled} variant="primary" loading={isGeneratingInvoice} disabled={!canBill}>
              <CheckCircle className="w-3 h-3 mr-1" /> Mark as Billed
            </Button>
          </div>
        )}

        {trip.status === "BILLED" && (
          <div className="bg-green-900/20 border border-green-700/40 rounded p-3 text-xs text-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Trip has been billed and closed
          </div>
        )}

        {!canBill && trip.status !== "BILLED" && (
          <div className="text-xs text-text-tertiary italic">Complete the trip before billing</div>
        )}
      </div>
    </Card>
  );
};

BillingSection.displayName = "BillingSection";
