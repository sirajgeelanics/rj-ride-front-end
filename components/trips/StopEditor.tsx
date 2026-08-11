"use client";

import React from "react";
import { Stop, LocationType } from "@/lib/types";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { getLocationRequiredFields, getLocationTypeLabel, calculateReverseScheduleTime } from "@/lib/tripHelpers";
import { Trash2, Clock } from "lucide-react";

interface StopEditorProps {
  stop: Stop;
  index: number;
  onUpdate: (index: number, updates: Partial<Stop>) => void;
  onRemove: (index: number) => void;
}

export const StopEditor: React.FC<StopEditorProps> = ({ stop, index, onUpdate, onRemove }) => {
  const locationTypes: LocationType[] = ["AIRPORT", "RAIL", "HOTEL", "CITY", "ADDRESS"];
  const requiredFields = getLocationRequiredFields(stop.locationType);

  return (
    <div className="p-4 bg-ops-bg rounded border border-border space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Badge variant={stop.type === "PICKUP" ? "green" : stop.type === "DROP" ? "blue" : "purple"}>{stop.type}</Badge>
        <Button size="sm" variant="ghost" onClick={() => onRemove(index)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Location Type */}
      <FormField label="Location Type" required>
        <Select
          value={stop.locationType}
          onChange={(e) => onUpdate(index, { locationType: e.target.value as LocationType })}
          options={locationTypes.map((lt) => ({
            value: lt,
            label: getLocationTypeLabel(lt),
          }))}
        />
      </FormField>

      {/* Address */}
      <FormField label="Address" required>
        <Input value={stop.address} onChange={(e) => onUpdate(index, { address: e.target.value })} placeholder="e.g., Bangalore Airport, Terminal 1" />
      </FormField>

      {/* Coordinates */}
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Latitude" required>
          <Input type="number" step="0.0001" value={stop.lat} onChange={(e) => onUpdate(index, { lat: parseFloat(e.target.value) })} />
        </FormField>
        <FormField label="Longitude" required>
          <Input type="number" step="0.0001" value={stop.lng} onChange={(e) => onUpdate(index, { lng: parseFloat(e.target.value) })} />
        </FormField>
      </div>

      {/* Scheduled Time (optional) */}
      <FormField label="Planned Time (optional)">
        <DateTimePicker mode="datetime" disablePast value={stop.plannedTime || ""} onChange={(val) => onUpdate(index, { plannedTime: val || undefined })} />
      </FormField>

      {/* Reverse Schedule Suggestion */}
      {stop.plannedTime && stop.type === "DROP" && (
        <div className="flex items-center gap-2 p-2 bg-brand-blue/5 border border-brand-blue/20 rounded text-xs">
          <Clock className="w-3.5 h-3.5 text-brand-blue shrink-0" />
          <span className="text-text-secondary">
            If arrival by <strong>{new Date(stop.plannedTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>,
            dispatch by <strong>{new Date(calculateReverseScheduleTime(stop.plannedTime, 20, 60)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
            (20 min travel + 60 min buffer)
          </span>
        </div>
      )}

      {/* Conditional Fields */}
      {requiredFields.flightNumberRequired && (
        <FormField label="Flight Number" required>
          <Input value={stop.flightNumber || ""} onChange={(e) => onUpdate(index, { flightNumber: e.target.value || undefined })} placeholder="e.g., AA123" />
        </FormField>
      )}

      {requiredFields.trainNumberRequired && (
        <FormField label="Train Number" required>
          <Input value={stop.trainNumber || ""} onChange={(e) => onUpdate(index, { trainNumber: e.target.value || undefined })} placeholder="e.g., 12345" />
        </FormField>
      )}

      {requiredFields.terminalRequired && (
        <FormField label="Terminal (optional)">
          <Input value={stop.terminal || ""} onChange={(e) => onUpdate(index, { terminal: e.target.value || undefined })} placeholder="e.g., T1, T2" />
        </FormField>
      )}
    </div>
  );
};

StopEditor.displayName = "StopEditor";
