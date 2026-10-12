import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/lib/api";

const COLOUR: Record<string, string> = {
  active: "#1F8A4C",
  on_trip: "#2F6FC0",
  breakdown: "#C8432B",
  not_available: "#8A8F98",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Last known vehicle positions, coloured by state; stale fixes are drawn hollow. */
export default function FleetMap({ points }: { points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true }).setView([20.6, 78.9], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    for (const p of points) {
      const colour = COLOUR[p.status] ?? COLOUR.not_available;
      L.circleMarker([p.lat, p.lng], {
        radius: 7,
        color: colour,
        weight: 2,
        fillColor: colour,
        fillOpacity: p.stale ? 0.1 : 0.85,
      })
        .bindPopup(
          `<strong>${escapeHtml(p.plate)}</strong><br/>${escapeHtml(p.vehicle_type)} · ${escapeHtml(p.vendor)}` +
            `<br/>${escapeHtml(p.tenant.name)}` +
            (p.trip_reference ? `<br/>Trip ${escapeHtml(p.trip_reference)}` : "") +
            `<br/><small>${escapeHtml(new Date(p.last_updated).toLocaleString())}${p.stale ? " (stale)" : ""}</small>`,
        )
        .addTo(layer.current);
    }
    if (!fitted.current && points.length > 0) {
      map.current.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [40, 40],
        maxZoom: 12,
      });
      fitted.current = true;
    }
  }, [points]);

  return <div ref={el} className="h-[560px] w-full rounded-2xl border border-border overflow-hidden" />;
}
