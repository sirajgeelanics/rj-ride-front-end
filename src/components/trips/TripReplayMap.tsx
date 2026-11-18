import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type ReplayPoint = { lat: number; lng: number; at: string };

interface TripReplayMapProps {
  path: ReplayPoint[];
  // Index into `path` the animation is currently at — the parent owns the play/pause/scrub
  // state (same split LiveMapComponent uses: positions in, selection/tick as separate props)
  // so this component stays a pure renderer with no timer of its own.
  currentIndex: number;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const VEHICLE_ICON = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;background:#2563eb;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
  </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const START_ICON = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#16a34a;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const END_ICON = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#dc2626;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const TripReplayMap: React.FC<TripReplayMapProps> = ({ path, currentIndex }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const traveledLineRef = useRef<L.Polyline | null>(null);

  // Full route (static) + start/end markers + initial fit — built once per `path` identity,
  // same split LiveMapComponent/MapComponent use between "the data" and "the current tick".
  useEffect(() => {
    if (!mapRef.current || path.length === 0) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }
    const map = mapInstanceRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer);
    });

    const latlngs = path.map((p) => [p.lat, p.lng] as [number, number]);
    const start = latlngs[0];
    if (!start) return;
    const end = latlngs[latlngs.length - 1];
    L.polyline(latlngs, { color: "#94a3b8", weight: 3, opacity: 0.6 }).addTo(map);
    L.marker(start, { icon: START_ICON }).bindPopup("Start").addTo(map);
    if (latlngs.length > 1 && end) {
      L.marker(end, { icon: END_ICON }).bindPopup("End").addTo(map);
    }

    traveledLineRef.current = L.polyline([start], { color: "#2563eb", weight: 4 }).addTo(map);
    vehicleMarkerRef.current = L.marker(start, { icon: VEHICLE_ICON }).addTo(map);

    map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30], maxZoom: 16 });
  }, [path]);

  // The moving marker + traveled-so-far highlight — updates every tick without re-fitting
  // the map or rebuilding the static route, so playback doesn't jump/flicker the view.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || path.length === 0) return;

    const idx = Math.max(0, Math.min(currentIndex, path.length - 1));
    const point = path[idx];
    if (!point) return;
    vehicleMarkerRef.current?.setLatLng([point.lat, point.lng]);
    traveledLineRef.current?.setLatLngs(
      path.slice(0, idx + 1).map((p) => [p.lat, p.lng] as [number, number]),
    );
  }, [path, currentIndex]);

  if (path.length === 0) {
    return (
      <div className="h-72 w-full rounded border border-border flex items-center justify-center text-sm text-text-secondary">
        No recorded path for this trip.
      </div>
    );
  }

  return <div ref={mapRef} className="h-72 w-full rounded border border-border" />;
};

export default TripReplayMap;
