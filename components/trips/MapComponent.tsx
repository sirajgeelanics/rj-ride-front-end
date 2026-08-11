"use client";

import React, { useEffect, useRef } from "react";
import { Stop, VehicleStatus } from "@/lib/types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapComponentProps {
  stops: Stop[];
  vehicles?: Array<{
    id: string;
    vehicleId?: string;
    status: VehicleStatus;
    pax: any[];
    lat?: number;
    lng?: number;
    eta?: number;
  }>;
  showVehicles?: boolean;
}

// Fix Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function getVehicleMarkerColor(status: VehicleStatus): string {
  const colorMap: Partial<Record<VehicleStatus, string>> = {
    PENDING: "808080",
    ASSIGNED: "3b82f6",
    DRIVER_ACCEPTED: "06b6d4",
    DRIVER_REJECTED: "6b7280",
    EN_ROUTE_PICKUP: "f59e0b",
    AT_PICKUP: "eab308",
    PAX_PICKED: "8b5cf6",
    IN_TRANSIT: "ec4899",
    AT_DROP: "f97316",
    PAX_DROPPED: "14b8a6",
    COMPLETED: "22c55e",
    NO_SHOW: "dc2626",
    BREAKDOWN: "dc2626",
    ACCIDENT: "991b1b",
    VEHICLE_SWAP: "f59e0b",
    DELAYED: "f59e0b",
    SOS: "991b1b",
    CANCELLED: "6b7280",
  };
  return colorMap[status] || "808080";
}

export const MapComponent: React.FC<MapComponentProps> = ({ stops, vehicles = [], showVehicles = false }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([stops[0]?.lat || 12.9716, stops[0]?.lng || 77.595], 11);

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Clear existing markers and polyline
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const markers: L.Marker[] = [];

    // Add stop markers
    stops.forEach((stop, idx) => {
      const isPickup = idx === 0;
      const icon = L.icon({
        iconUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23${isPickup ? "22c55e" : "3b82f6"}'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z'/%3E%3C/svg%3E`,
        iconSize: [30, 40],
        iconAnchor: [15, 40],
        popupAnchor: [0, -40],
      });

      const marker = L.marker([stop.lat, stop.lng], { icon })
        .bindPopup(
          `<div class="text-xs"><strong>${stop.type}</strong><br/>${stop.address}<br/>${stop.locationType}${stop.flightNumber ? "<br/>✈️ " + stop.flightNumber : ""}${stop.trainNumber ? "<br/>🚂 " + stop.trainNumber : ""}</div>`
        )
        .addTo(map);

      markers.push(marker);
    });

    // Add vehicle markers if showing vehicles
    if (showVehicles && vehicles.length > 0) {
      vehicles.forEach((vehicle) => {
        const lat = vehicle.lat ?? stops[0]?.lat;
        const lng = vehicle.lng ?? stops[0]?.lng;
        if (!lat || !lng) return;

        const color = getVehicleMarkerColor(vehicle.status);
        const icon = L.icon({
          iconUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23${color}'%3E%3Cpath d='M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z'/%3E%3C/svg%3E`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });

        const marker = L.marker([lat, lng], { icon })
          .bindPopup(
            `<div class="text-xs"><strong>Vehicle ${vehicle.vehicleId?.substring(0, 8)}</strong><br/>Status: ${vehicle.status}<br/>Pax: ${vehicle.pax.length}${vehicle.eta ? `<br/>ETA: ${vehicle.eta}m` : ""}</div>`
          )
          .addTo(map);

        markers.push(marker);
      });
    }

    // Draw polyline connecting stops
    if (stops.length > 1) {
      const latlngs = stops.map((stop) => [stop.lat, stop.lng] as [number, number]);
      L.polyline(latlngs, {
        color: "#818cf8",
        weight: 2,
        opacity: 0.7,
        dashArray: "5, 5",
      }).addTo(map);
    }

    // Fit bounds to all markers
    if (markers.length > 0) {
      const group = new L.FeatureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
  }, [stops, vehicles, showVehicles]);

  return <div ref={mapRef} className="h-64 w-full rounded border border-border bg-ops-sidebar" />;
};

export default MapComponent;
