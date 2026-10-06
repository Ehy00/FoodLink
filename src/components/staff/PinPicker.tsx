"use client";

// Lets an organizer drop a pin on the map instead of typing coordinates.
// Screening later checks that the pin is in Madison County and near the ZIP.

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";
import { useEffect, useRef } from "react";
import type { Point } from "@/lib/geo";

export default function PinPicker({ value, onChange }: { value: Point; onChange: (p: Point) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current) return;
      const map = L.map(container.current, { scrollWheelZoom: false }).setView([value.lat, value.lng], 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer">OpenStreetMap</a>',
        referrerPolicy: "no-referrer",
      }).addTo(map);
      const icon = L.divIcon({
        className: "fl-pin",
        html: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38"><path d="M15 1C7.3 1 1 7.1 1 14.7 1 24.6 15 37 15 37s14-12.4 14-22.3C29 7.1 22.7 1 15 1z" fill="#1f6b45" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14.5" r="5" fill="#fff"/></svg>',
        iconSize: [30, 38],
        iconAnchor: [15, 37],
      });
      const marker = L.marker([value.lat, value.lng], { icon, draggable: true, alt: "Listing location" }).addTo(map);
      const report = (lat: number, lng: number) =>
        onChangeRef.current({ lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 });
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        report(p.lat, p.lng);
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        report(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = map;
      markerRef.current = marker;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; later value changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin in step when the value changes from outside (typed coordinates, ZIP shortcut).
  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    const current = marker.getLatLng();
    if (Math.abs(current.lat - value.lat) > 1e-6 || Math.abs(current.lng - value.lng) > 1e-6) {
      marker.setLatLng([value.lat, value.lng]);
      map.panTo([value.lat, value.lng]);
    }
  }, [value.lat, value.lng]);

  return <div ref={container} className="h-56 w-full overflow-hidden rounded-xl border border-line" role="application" aria-label="Map: click to place the pin" />;
}
