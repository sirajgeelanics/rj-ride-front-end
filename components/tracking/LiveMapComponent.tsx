"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LivePosition = {
  trip_vehicle_id: string;
  status?: string;
  marker_color?: string;
  lat?: number | null;
  lng?: number | null;
  speed?: number | null;
};

interface LiveMapComponentProps {
  positions: LivePosition[];
  selectedTripVehicleId: string | null;
  onSelectVehicle: (id: string | null) => void;
  positionsTick: number;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function makeVehicleIcon(color: string, selected: boolean): L.DivIcon {
  const size = selected ? 36 : 28;
  const border = selected ? "3px solid #fff" : "2px solid rgba(255,255,255,0.6)";
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:#${color};border-radius:50%;border:${border};box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
      <svg width="${size * 0.55}" height="${size * 0.55}" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const LiveMapComponent: React.FC<LiveMapComponentProps> = ({
  positions,
  selectedTripVehicleId,
  onSelectVehicle,
  positionsTick,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultLat = positions[0]?.lat ?? 12.9716;
    const defaultLng = positions[0]?.lng ?? 77.595;

    mapInstanceRef.current = L.map(mapRef.current).setView([defaultLat, defaultLng], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentIds = new Set(positions.map((p) => p.trip_vehicle_id).filter(Boolean) as string[]);

    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    for (const pos of positions) {
      const id = pos.trip_vehicle_id;
      if (!id || pos.lat == null || pos.lng == null) continue;

      const color = pos.marker_color ?? "808080";
      const isSelected = selectedTripVehicleId === id;
      const icon = makeVehicleIcon(color, isSelected);

      const existing = markersRef.current.get(id);
      if (existing) {
        existing.setLatLng([pos.lat, pos.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([pos.lat, pos.lng], { icon })
          .bindPopup(
            `<div style="font-size:11px"><strong>${pos.status ?? "?"}</strong><br/>${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}${pos.speed != null ? `<br/>${pos.speed} km/h` : ""}</div>`
          )
          .addTo(map);
        marker.on("click", () => {
          onSelectVehicle(id === selectedTripVehicleId ? null : id);
        });
        markersRef.current.set(id, marker);
      }
    }

    if (selectedTripVehicleId) {
      const selectedPos = positions.find((p) => p.trip_vehicle_id === selectedTripVehicleId);
      if (selectedPos?.lat != null && selectedPos.lng != null) {
        map.panTo([selectedPos.lat, selectedPos.lng], { animate: true });
      }
    } else if (positions.length > 0 && markersRef.current.size > 0) {
      const group = new L.FeatureGroup(Array.from(markersRef.current.values()));
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 14 });
    }
  }, [positions, selectedTripVehicleId, onSelectVehicle, positionsTick]);

  return <div ref={mapRef} className="h-80 w-full rounded border border-border" />;
};

export default LiveMapComponent;
