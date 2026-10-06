"use client";

// Map of listings using Leaflet and OpenStreetMap tiles.
//
// Privacy notes:
//   - Map tiles are the only thing FoodLink loads from another site. The tile
//     server sees which map squares were requested, not who asked or why.
//   - Popups are built with textContent, never innerHTML, so a listing name
//     can never inject markup into the page.

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { DEFAULT_CENTER, type Point } from "@/lib/geo";
import { openLabel } from "@/lib/format";
import type { ListingView } from "@/lib/types";
import { useI18n } from "./I18nProvider";

const PIN_COLORS = { fresh: "#1f6b45", check: "#b7791f", stale: "#7b857f" } as const;

function pinSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38" aria-hidden="true"><path d="M15 1C7.3 1 1 7.1 1 14.7 1 24.6 15 37 15 37s14-12.4 14-22.3C29 7.1 22.7 1 15 1z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14.5" r="5" fill="#fff"/></svg>`;
}

interface Props {
  listings: ListingView[];
  origin: Point | null;
  className?: string;
  /** Keep the map still (used for the small preview on a listing page). */
  locked?: boolean;
  /** Zoom used when there is a single listing. */
  singleZoom?: number;
  /** Show the + / - buttons. Off for small previews, where they cover the pins. */
  zoomButtons?: boolean;
}

export default function MapView({ listings, origin, className = "h-64", locked = false, singleZoom = 15, zoomButtons = true }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current) return;

      map = L.map(container.current, {
        zoomControl: !locked && zoomButtons,
        dragging: !locked,
        scrollWheelZoom: false,
        doubleClickZoom: !locked,
        touchZoom: !locked,
        keyboard: !locked,
        attributionControl: true,
      }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 11);
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer">OpenStreetMap</a>',
        referrerPolicy: "no-referrer",
      }).addTo(map);

      const points: Array<[number, number]> = [];

      for (const listing of listings) {
        const level = listing.underReview ? "stale" : listing.freshness.level;
        const icon = L.divIcon({
          className: "fl-pin",
          html: pinSvg(PIN_COLORS[level]),
          iconSize: [30, 38],
          iconAnchor: [15, 37],
          popupAnchor: [0, -34],
        });
        const marker = L.marker([listing.lat, listing.lng], { icon, title: listing.name, alt: listing.name }).addTo(map);
        points.push([listing.lat, listing.lng]);

        if (!locked) {
          const popup = document.createElement("div");
          const name = document.createElement("strong");
          name.textContent = listing.name;
          name.style.display = "block";
          name.style.color = "#14372a";
          const status = document.createElement("span");
          status.textContent = openLabel(t, listing.open);
          status.style.display = "block";
          status.style.margin = "2px 0 6px";
          status.style.color = "#5e6b63";
          const link = document.createElement("a");
          link.href = `/listing/${listing.id}`;
          link.textContent = `${t("card.directions")} · ${t("card.call")} →`;
          link.style.color = "#1f6b45";
          link.style.fontWeight = "700";
          link.addEventListener("click", (e) => {
            e.preventDefault();
            router.push(`/listing/${listing.id}`);
          });
          popup.append(name, status, link);
          marker.bindPopup(popup);
        }
      }

      if (origin) {
        L.marker([origin.lat, origin.lng], {
          icon: L.divIcon({ className: "", html: '<div class="fl-you"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
          title: t("map.you"),
          alt: t("map.you"),
          interactive: false,
          keyboard: false,
        }).addTo(map);
      }

      if (points.length === 1 && !origin) {
        map.setView(points[0], singleZoom);
      } else if (points.length > 0) {
        // Frame the closest handful of places plus the resident's area, not the whole county.
        const framed = points.slice(0, 8);
        if (origin) framed.push([origin.lat, origin.lng]);
        map.fitBounds(L.latLngBounds(framed), { padding: [28, 28], maxZoom: 14 });
      } else if (origin) {
        map.setView([origin.lat, origin.lng], 12);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // Rebuild when the set of listings or the origin changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings.map((l) => l.id).join(","), origin?.lat, origin?.lng, locked, singleZoom, zoomButtons]);

  return <div ref={container} className={`w-full overflow-hidden ${className}`} role="application" aria-label={t("map.title")} />;
}
