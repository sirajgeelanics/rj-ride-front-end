"use client";

import React, { useState } from "react";
import { TripVehicle, Pax } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { PII } from "@/components/ui/PII";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface PaxAssignmentProps {
  vehicles: TripVehicle[];
  onUpdateVehiclePax: (vehicleIndex: number, pax: Pax[]) => void;
}

export const PaxAssignment: React.FC<PaxAssignmentProps> = ({ vehicles, onUpdateVehiclePax }) => {
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);
  const [newPaxForm, setNewPaxForm] = useState<Record<string, Partial<Pax>>>({});

  const addPaxToVehicle = (vehicleIndex: number, vehicleId: string) => {
    const form = newPaxForm[vehicleId] || {};
    if (!form.name && !form.phone && !form.email) {
      return; // Empty form
    }

    const newPax: Pax = {
      id: `pax_${Math.random().toString(36).substring(2, 9)}`,
      name: form.name,
      phone: form.phone,
      email: form.email,
      employeeId: form.employeeId,
      pnr: form.pnr,
    };

    const updatedPax = [...vehicles[vehicleIndex]!.pax, newPax];
    onUpdateVehiclePax(vehicleIndex, updatedPax);

    setNewPaxForm((prev) => {
      const newForm = { ...prev };
      delete newForm[vehicleId];
      return newForm;
    });
  };

  const removePaxFromVehicle = (vehicleIndex: number, paxIndex: number) => {
    const updatedPax = vehicles[vehicleIndex]!.pax.filter((_, i) => i !== paxIndex);
    onUpdateVehiclePax(vehicleIndex, updatedPax);
  };

  return (
    <Card padding="lg" header={<h3 className="font-semibold">Passenger Assignment</h3>}>
      <div className="space-y-3">
        {vehicles.map((vehicle, vehicleIndex) => {
          const isExpanded = expandedVehicleId === vehicle.id;

          return (
            <div key={vehicle.id} className="border border-border rounded">
              {/* Vehicle Header */}
              <button
                onClick={() => setExpandedVehicleId(isExpanded ? null : vehicle.id)}
                className="w-full p-3 bg-ops-bg hover:bg-ops-card2 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-text-primary">Vehicle {vehicleIndex + 1}</span>
                  <Badge variant="blue">{vehicle.pax.length} pax</Badge>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* Vehicle Details */}
              {isExpanded && (
                <div className="p-3 bg-ops-bg border-t border-border space-y-3">
                  {/* Existing Pax */}
                  {vehicle.pax.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-text-primary">Passengers:</p>
                      {vehicle.pax.map((pax, paxIndex) => (
                        <div key={pax.id} className="flex items-center justify-between bg-ops-bg p-2 rounded text-xs">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-text-primary">{paxIndex + 1}.</span>
                            <div className="flex gap-2">
                              {pax.name && <PII value={pax.name} type="name" />}
                              {pax.phone && <PII value={pax.phone} type="phone" />}
                              {pax.pnr && <PII value={pax.pnr} type="pnr" />}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removePaxFromVehicle(vehicleIndex, paxIndex)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Pax Form */}
                  <div className="border-t border-border pt-2 mt-2">
                    <p className="text-xs font-medium text-text-primary mb-2">Add Passenger:</p>
                    <div className="space-y-2">
                      <Input
                        placeholder="Name"
                        value={newPaxForm[vehicle.id]?.name || ""}
                        onChange={(e) =>
                          setNewPaxForm((prev) => ({
                            ...prev,
                            [vehicle.id]: { ...prev[vehicle.id], name: e.target.value },
                          }))
                        }
                      />
                      <Input
                        placeholder="Phone (optional)"
                        value={newPaxForm[vehicle.id]?.phone || ""}
                        onChange={(e) =>
                          setNewPaxForm((prev) => ({
                            ...prev,
                            [vehicle.id]: { ...prev[vehicle.id], phone: e.target.value },
                          }))
                        }
                      />
                      <Input
                        placeholder="Email (optional)"
                        value={newPaxForm[vehicle.id]?.email || ""}
                        onChange={(e) =>
                          setNewPaxForm((prev) => ({
                            ...prev,
                            [vehicle.id]: { ...prev[vehicle.id], email: e.target.value },
                          }))
                        }
                      />
                      <Input
                        placeholder="PNR (optional)"
                        value={newPaxForm[vehicle.id]?.pnr || ""}
                        onChange={(e) =>
                          setNewPaxForm((prev) => ({
                            ...prev,
                            [vehicle.id]: { ...prev[vehicle.id], pnr: e.target.value },
                          }))
                        }
                      />
                      <Button onClick={() => addPaxToVehicle(vehicleIndex, vehicle.id)} size="sm" variant="secondary" className="w-full">
                        <Plus className="w-3 h-3 mr-1" /> Add Passenger
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

PaxAssignment.displayName = "PaxAssignment";
