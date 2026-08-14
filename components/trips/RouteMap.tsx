"use client";

import React, { useEffect, useRef } from "react";

interface StopPoint {
  address: string;
  lat: number;
  lng: number;
  type: string;
}

interface RouteMapProps {
  stops: StopPoint[];
  height?: string;
}

export const RouteMap: React.FC<RouteMapProps> = ({ stops, height = "h-56" }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || stops.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let L: any;

    const initMap = async () => {
      L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      if (!mapInstanceRef.current && mapRef.current) {
        mapInstanceRef.current = L.map(mapRef.current).setView(
          [stops[0].lat, stops[0].lng],
          12
        );

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      // Clear existing overlays
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
          map.removeLayer(layer);
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markers: any[] = [];

      // Stop markers with SVGs for pickup (green) and drop (red)
      stops.forEach((stop, idx) => {
        const isPickup = idx === 0;
        const isDrop = idx === stops.length - 1;
        const color = isPickup ? "22c55e" : isDrop ? "ef4444" : "f59e0b";

        const icon = L.icon({
          iconUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23${color}'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E`,
          iconSize: [28, 38],
          iconAnchor: [14, 38],
          popupAnchor: [0, -38],
        });

        const label = isPickup ? "Pickup" : isDrop ? "Drop" : `Stop ${idx + 1}`;
        const marker = L.marker([stop.lat, stop.lng], { icon })
          .bindPopup(
            `<div class="text-xs"><strong>${label}</strong><br/>${stop.address}</div>`
          )
          .addTo(map);

        markers.push(marker);
      });

      // Draw route polyline
      if (stops.length > 1) {
        const latlngs = stops.map((s) => [s.lat, s.lng] as [number, number]);
        L.polyline(latlngs, {
          color: "#072D62",
          weight: 3,
          opacity: 0.6,
          dashArray: "6, 4",
        }).addTo(map);
      }

      // Fit bounds
      if (markers.length > 0) {
        const group = new L.FeatureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [40, 40] });
      }
    };

    initMap();

    return () => {
      // Don't destroy map on cleanup — drawer reuses it
    };
  }, [stops]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (stops.length === 0) {
    return (
      <div className={`${height} bg-ops-bg rounded-lg flex items-center justify-center`}>
        <p className="text-xs text-text-muted">No route data</p>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className={`${height} w-full rounded-lg border border-border bg-ops-sidebar`}
    />
  );
};

export default RouteMap;
