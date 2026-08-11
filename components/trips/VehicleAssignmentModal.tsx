"use client";

import React, { useState, useMemo } from "react";
import { Vehicle, Driver } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PII } from "@/components/ui/PII";

interface VehicleAssignmentModalProps {
  vehicleIndex: number;
  assignedVehicleId?: string;
  assignedDriverId?: string;
  vehicles: Vehicle[];
  drivers: Driver[];
  onAssign: (vehicleId: string, driverId: string) => void;
  onClose: () => void;
}

export const VehicleAssignmentModal: React.FC<VehicleAssignmentModalProps> = ({
  vehicleIndex,
  assignedVehicleId,
  assignedDriverId,
  vehicles,
  drivers,
  onAssign,
  onClose,
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState(assignedVehicleId || "");
  const [selectedDriverId, setSelectedDriverId] = useState(assignedDriverId || "");

  const selectedVehicle = useMemo(() => vehicles.find((v) => v.id === selectedVehicleId), [selectedVehicleId, vehicles]);
  const selectedDriver = useMemo(() => drivers.find((d) => d.id === selectedDriverId), [selectedDriverId, drivers]);

  // Filter available drivers (those marked as available and not currently assigned to another vehicle)
  const availableDrivers = useMemo(
    () => drivers.filter((d) => d.available && d.active),
    [drivers]
  );

  const handleAssign = () => {
    if (!selectedVehicleId || !selectedDriverId) {
      return;
    }
    onAssign(selectedVehicleId, selectedDriverId);
  };

  return (
    <Modal open={true} onClose={onClose} title={`Assign Vehicle & Driver — Trip Vehicle ${vehicleIndex + 1}`} size="lg">
      <div className="space-y-4">
        {/* Vehicle Selection */}
        <FormField label="Select Vehicle" required>
          <Select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            options={vehicles
              .filter((v) => v.active)
              .map((v) => ({
                value: v.id,
                label: `${v.make} ${v.model} (${v.registrationNo})`,
              }))}
          />
        </FormField>

        {/* Vehicle Details */}
        {selectedVehicle && (
          <Card padding="md" className="bg-ops-bg">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-text-secondary">Registration</p>
                <p className="text-text-primary font-medium">{selectedVehicle.registrationNo}</p>
              </div>
              <div>
                <p className="text-text-secondary">Seating</p>
                <p className="text-text-primary">{selectedVehicle.seatingCapacity} pax</p>
              </div>
              <div>
                <p className="text-text-secondary">Fuel Type</p>
                <p className="text-text-primary">{selectedVehicle.fuelType}</p>
              </div>
              <div>
                <p className="text-text-secondary">AC</p>
                <p className="text-text-primary">{selectedVehicle.ac ? "Yes" : "No"}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Driver Selection */}
        <FormField label="Select Driver" required>
          <Select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            options={availableDrivers.map((d) => ({
              value: d.id,
              label: `${d.name} (${d.phone})`,
            }))}
          />
        </FormField>

        {/* Driver Details */}
        {selectedDriver && (
          <Card padding="md" className="bg-ops-bg">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-text-secondary">Name</p>
                <p className="text-text-primary font-medium">
                  <PII value={selectedDriver.name} type="name" />
                </p>
              </div>
              <div>
                <p className="text-text-secondary">Phone</p>
                <p className="text-text-primary">
                  <PII value={selectedDriver.phone} type="phone" />
                </p>
              </div>
              <div>
                <p className="text-text-secondary">Licence</p>
                <p className="text-text-primary font-mono text-xs">{selectedDriver.licenceNo}</p>
              </div>
              <div>
                <p className="text-text-secondary">Shift</p>
                <p className="text-text-primary">{selectedDriver.shift || "FLEX"}</p>
              </div>
              {selectedDriver.rating && (
                <div>
                  <p className="text-text-secondary">Rating</p>
                  <p className="text-yellow-400">★ {selectedDriver.rating}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Summary */}
        {selectedVehicle && selectedDriver && (
          <Card padding="md" className="bg-green-900/20 border-green-700/40">
            <p className="text-xs text-green-200">
              ✓ Ready to assign{" "}
              <span className="font-medium">
                {selectedVehicle.make} {selectedVehicle.model}
              </span>{" "}
              with driver{" "}
              <span className="font-medium">
                <PII value={selectedDriver.name} type="name" />
              </span>
            </p>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleAssign} variant="primary" disabled={!selectedVehicleId || !selectedDriverId}>
            Assign
          </Button>
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};

VehicleAssignmentModal.displayName = "VehicleAssignmentModal";
