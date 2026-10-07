"use client";

// Map of listings using Leaflet and OpenStreetMap tiles.
//
// Privacy notes:
//   - Map tiles are the only thing FoodLink loads from another site. The tile
//     server sees which map squares were requested, not who asked or why.
//   - Popups are built with DOM text nodes, never listing-provided HTML.

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { DEFAULT_CENTER, type Point } from "@/lib/geo";
import { openLabel } from "@/lib/format";
import type { ListingView } from "@/lib/types";
import { useI18n } from "./I18nProvider";

export type MapListingKind = "best" | "match" | "check" | "review";

const PIN_COLORS: Record<MapListingKind, string> = {
  best: "#5145d6",
  match: "#1f6b45",
  check: "#a9690f",
  review: "#b3261e",
};

function pinSvg(color: string, label?: string, active = false): string {
  const scale = active ? 1.14 : 1;
  const text = label
    ? `<text x="15" y="18" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="10" font-family="Arial,sans-serif" font-weight="700">${label}</text>`
    : `<circle cx="15" cy="14.5" r="5" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="43" viewBox="0 0 30 38" aria-hidden="true" style="transform:scale(${scale});transform-origin:50% 100%;transition:transform .18s ease;filter:drop-shadow(0 3px 4px rgb(0 0 0 / ${active ? "0.35" : "0.22"}))"><path d="M15 1C7.3 1 1 7.1 1 14.7 1 24.6 15 37 15 37s14-12.4 14-22.3C29 7.1 22.7 1 15 1z" fill="${color}" stroke="#fff" stroke-width="${active ? 2.6 : 2}"/>${text}</svg>`;
}

interface Props {
  listings: ListingView[];
  origin: Point | null;
  className?: string;
  height?: number | string;
  listingKinds?: Record<string, MapListingKind>;
  rankById?: Record<string, number>;
  activeListingId?: string | null;
  onListingHover?: (id: string | null) => void;
  /** Keep the map still (used for the small preview on a listing page). */
  locked?: boolean;
  /** Zoom used when there is a single listing. */
  singleZoom?: number;
  /** Show the + / - buttons. Off for small previews, where they cover the pins. */
  zoomButtons?: boolean;
}

export default function MapView({
  listings,
  origin,
  className = "h-64",
  height,
  listingKinds,
  rankById,
  activeListingId = null,
  onListingHover,
  locked = false,
  singleZoom = 15,
  zoomButtons = true,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    let resizeObserver: ResizeObserver | null = null;

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
      markersRef.current.clear();

      resizeObserver =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => {
              map?.invalidateSize({ pan: false });
            })
          : null;
      resizeObserver?.observe(container.current);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(map);

      const points: Array<[number, number]> = [];

      for (const listing of listings) {
        const kind: MapListingKind =
          listingKinds?.[listing.id] ??
          (listing.underReview ? "review" : listing.freshness.level === "fresh" ? "match" : "check");
        const rank = rankById?.[listing.id];
        const icon = L.divIcon({
          className: "fl-pin",
          html: pinSvg(PIN_COLORS[kind], rank && rank <= 99 ? String(rank) : undefined, listing.id === activeListingId),
          iconSize: [34, 43],
          iconAnchor: [17, 42],
          popupAnchor: [0, -38],
        });
        const marker = L.marker([listing.lat, listing.lng], {
          icon,
          title: listing.name,
          alt: listing.name,
          riseOnHover: true,
        }).addTo(map);
        markersRef.current.set(listing.id, marker);
        points.push([listing.lat, listing.lng]);

        if (!locked) {
          const popup = document.createElement("div");
          popup.className = "fl-map-popup";

          const name = document.createElement("strong");
          name.textContent = listing.name;
          name.style.display = "block";

          const status = document.createElement("span");
          status.textContent = openLabel(t, listing.open);
          status.style.display = "block";
          status.style.margin = "3px 0";

          const distance = document.createElement("span");
          if (listing.distanceMiles !== null) {
            distance.textContent = `${listing.distanceMiles.toFixed(1)} mi away`;
            distance.style.display = "block";
            distance.style.marginBottom = "7px";
          }

          const chips = document.createElement("div");
          chips.className = "fl-map-popup-chips";
          const facts = [
            listing.offers[0] ? t(`tag.${listing.offers[0]}` as Parameters<typeof t>[0]) : null,
            listing.idRequired === "no" ? t("tag.no_id") : null,
            listing.wheelchair === "yes" ? t("tag.wheelchair") : null,
          ].filter((v): v is string => !!v);
          for (const fact of facts.slice(0, 3)) {
            const chip = document.createElement("span");
            chip.textContent = fact;
            chips.appendChild(chip);
          }

          const link = document.createElement("a");
          link.href = `/listing/${listing.id}`;
          link.textContent = `${t("card.viewDetails")} →`;
          link.className = "fl-map-popup-link";
          link.addEventListener("click", (e) => {
            e.preventDefault();
            router.push(`/listing/${listing.id}`);
          });

          popup.append(name, status);
          if (listing.distanceMiles !== null) popup.append(distance);
          if (facts.length > 0) popup.append(chips);
          popup.append(link);
          marker.bindPopup(popup);

          marker.on("mouseover", () => onListingHover?.(listing.id));
          marker.on("mouseout", () => onListingHover?.(null));
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
        const framed = [...points];
        if (origin) framed.push([origin.lat, origin.lng]);
        map.fitBounds(L.latLngBounds(framed), { padding: [34, 34], maxZoom: 14 });
      } else if (origin) {
        map.setView([origin.lat, origin.lng], 12);
      }

      requestAnimationFrame(() => map?.invalidateSize({ pan: false }));
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      map?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // Rebuild only when map data changes. Active styling is handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    listings.map((l) => `${l.id}:${listingKinds?.[l.id] ?? ""}:${rankById?.[l.id] ?? ""}`).join(","),
    origin?.lat,
    origin?.lng,
    locked,
    singleZoom,
    zoomButtons,
    t,
  ]);

  useEffect(() => {
    void import("leaflet").then(({ default: L }) => {
      for (const listing of listings) {
        const marker = markersRef.current.get(listing.id);
        if (!marker) continue;
        const kind: MapListingKind =
          listingKinds?.[listing.id] ??
          (listing.underReview ? "review" : listing.freshness.level === "fresh" ? "match" : "check");
        const rank = rankById?.[listing.id];
        const active = listing.id === activeListingId;
        marker.setIcon(
          L.divIcon({
            className: "fl-pin",
            html: pinSvg(PIN_COLORS[kind], rank && rank <= 99 ? String(rank) : undefined, active),
            iconSize: [34, 43],
            iconAnchor: [17, 42],
            popupAnchor: [0, -38],
          }),
        );
        marker.setZIndexOffset(active ? 1000 : 0);
        if (active && !locked) marker.openPopup();
        else if (!active && !locked) marker.closePopup();
      }
    });
  }, [activeListingId, listings, listingKinds, rankById, locked]);

  return (
    <div
      ref={container}
      className={`w-full overflow-hidden ${className}`}
      style={height !== undefined ? { height: typeof height === "number" ? `${height}px` : height } : undefined}
      role="application"
      aria-label={t("map.title")}
    />
  );
}
