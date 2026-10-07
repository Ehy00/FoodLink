"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker as LeafletMarker, Polyline as LeafletPolyline } from "leaflet";
import { Crosshair, Expand, LocateFixed, Maximize2, Minimize2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
  focusedListingId?: string | null;
  onListingHover?: (id: string | null) => void;
  onListingSelect?: (id: string | null) => void;
  locked?: boolean;
  singleZoom?: number;
  zoomButtons?: boolean;
  enhancedControls?: boolean;
  /** Useful for tabbed/mobile maps: refresh sizing and center the user's area when opened. */
  focusOriginOnReady?: boolean;
  refreshKey?: string | number;
}

export default function MapView({
  listings,
  origin,
  className = "h-64",
  height,
  listingKinds,
  rankById,
  activeListingId = null,
  focusedListingId = null,
  onListingHover,
  onListingSelect,
  locked = false,
  singleZoom = 15,
  zoomButtons = true,
  enhancedControls = true,
  focusOriginOnReady = false,
  refreshKey,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const routeLineRef = useRef<LeafletPolyline | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const fitVisible = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const points: Array<[number, number]> = listings.map((l) => [l.lat, l.lng]);
    if (origin) points.push([origin.lat, origin.lng]);
    if (points.length === 0) {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 11);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], singleZoom);
      return;
    }
    void import("leaflet").then(({ default: L }) => {
      map.flyToBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 14, duration: 0.7 });
    });
  }, [listings, origin, singleZoom]);

  const recenterOrigin = useCallback(() => {
    const map = mapRef.current;
    if (!map || !origin) return;
    map.flyTo([origin.lat, origin.lng], Math.max(map.getZoom(), 13), { duration: 0.65 });
  }, [origin]);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (!document.fullscreenElement) await shell.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      setFullscreen((value) => !value);
      requestAnimationFrame(() => mapRef.current?.invalidateSize({ pan: false }));
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      setFullscreen(!!document.fullscreenElement);
      requestAnimationFrame(() => mapRef.current?.invalidateSize({ pan: false }));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const refresh = () => {
      map.invalidateSize({ pan: false });
      if (focusOriginOnReady && origin) {
        map.setView([origin.lat, origin.lng], 13, { animate: false });
      }
    };

    requestAnimationFrame(refresh);
    const timer = window.setTimeout(refresh, 140);
    return () => window.clearTimeout(timer);
  }, [refreshKey, focusOriginOnReady, origin?.lat, origin?.lng]);

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
          ? new ResizeObserver(() => map?.invalidateSize({ pan: false }))
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
        const selected = listing.id === focusedListingId || listing.id === activeListingId;
        const icon = L.divIcon({
          className: "fl-pin",
          html: pinSvg(PIN_COLORS[kind], rank && rank <= 99 ? String(rank) : undefined, selected),
          iconSize: [34, 43],
          iconAnchor: [17, 42],
          popupAnchor: [0, -38],
        });

        const marker = L.marker([listing.lat, listing.lng], {
          icon,
          title: listing.name,
          alt: listing.name,
          riseOnHover: true,
          keyboard: true,
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

          const actions = document.createElement("div");
          actions.className = "fl-map-popup-actions";

          const focusButton = document.createElement("button");
          focusButton.type = "button";
          focusButton.textContent = "Focus on map";
          focusButton.className = "fl-map-popup-button";
          focusButton.addEventListener("click", () => onListingSelect?.(listing.id));

          const link = document.createElement("a");
          link.href = `/listing/${listing.id}`;
          link.textContent = `${t("card.viewDetails")} →`;
          link.className = "fl-map-popup-link";
          link.addEventListener("click", (e) => {
            e.preventDefault();
            router.push(`/listing/${listing.id}`);
          });

          actions.append(focusButton, link);
          popup.append(name, status);
          if (listing.distanceMiles !== null) popup.append(distance);
          if (facts.length > 0) popup.append(chips);
          popup.append(actions);
          marker.bindPopup(popup);

          marker.on("mouseover", () => onListingHover?.(listing.id));
          marker.on("mouseout", () => onListingHover?.(null));
          marker.on("click", () => onListingSelect?.(listing.id));
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

      const refreshMap = () => {
        if (!map) return;
        map.invalidateSize({ pan: false });
        if (focusOriginOnReady && origin) {
          map.setView([origin.lat, origin.lng], 13, { animate: false });
        }
      };

      requestAnimationFrame(refreshMap);
      const shortRefresh = window.setTimeout(refreshMap, 80);
      const settledRefresh = window.setTimeout(refreshMap, 260);

      if (shellRef.current) resizeObserver?.observe(shellRef.current);

      // Keep the timeouts tied to this map instance.
      map.once("unload", () => {
        window.clearTimeout(shortRefresh);
        window.clearTimeout(settledRefresh);
      });
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      routeLineRef.current?.remove();
      routeLineRef.current = null;
      map?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
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
      const map = mapRef.current;
      if (!map) return;

      for (const listing of listings) {
        const marker = markersRef.current.get(listing.id);
        if (!marker) continue;
        const kind: MapListingKind =
          listingKinds?.[listing.id] ??
          (listing.underReview ? "review" : listing.freshness.level === "fresh" ? "match" : "check");
        const rank = rankById?.[listing.id];
        const selected = listing.id === focusedListingId || listing.id === activeListingId;
        marker.setIcon(
          L.divIcon({
            className: "fl-pin",
            html: pinSvg(PIN_COLORS[kind], rank && rank <= 99 ? String(rank) : undefined, selected),
            iconSize: [34, 43],
            iconAnchor: [17, 42],
            popupAnchor: [0, -38],
          }),
        );
        marker.setZIndexOffset(selected ? 1000 : 0);
      }

      routeLineRef.current?.remove();
      routeLineRef.current = null;

      const focused = focusedListingId ? listings.find((listing) => listing.id === focusedListingId) : null;
      if (focused) {
        const marker = markersRef.current.get(focused.id);
        marker?.openPopup();
        map.flyTo([focused.lat, focused.lng], Math.max(map.getZoom(), 14), { duration: 0.65 });

        if (origin) {
          routeLineRef.current = L.polyline(
            [
              [origin.lat, origin.lng],
              [focused.lat, focused.lng],
            ],
            {
              color: "#5145d6",
              weight: 3,
              opacity: 0.8,
              dashArray: "8 8",
              interactive: false,
            },
          ).addTo(map);
        }
      }
    });
  }, [activeListingId, focusedListingId, listings, listingKinds, rankById, locked, origin]);

  return (
    <div
      ref={shellRef}
      className={`relative w-full overflow-hidden bg-paper ${fullscreen ? "h-screen" : className}`}
      style={!fullscreen && height !== undefined ? { height: typeof height === "number" ? `${height}px` : height } : undefined}
    >
      <div
        ref={container}
        className="h-full w-full"
        role="application"
        aria-label={t("map.title")}
      />

      {!locked && enhancedControls && (
        <div className="absolute end-3 top-3 z-[500] flex flex-col gap-2" aria-label="Map controls">
          <button
            type="button"
            onClick={fitVisible}
            className="fl-map-control"
            aria-label="Fit all visible results"
            title="Fit all visible results"
          >
            <Expand className="h-4 w-4" aria-hidden />
          </button>

          {origin && (
            <button
              type="button"
              onClick={recenterOrigin}
              className="fl-map-control"
              aria-label="Recenter on your area"
              title="Recenter on your area"
            >
              <LocateFixed className="h-4 w-4" aria-hidden />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onListingSelect?.(null);
              fitVisible();
            }}
            className="fl-map-control"
            aria-label="Reset map"
            title="Reset map"
          >
            <Crosshair className="h-4 w-4" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="fl-map-control"
            aria-label={fullscreen ? "Exit fullscreen map" : "Open fullscreen map"}
            title={fullscreen ? "Exit fullscreen map" : "Open fullscreen map"}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      )}

      {focusedListingId && origin && (
        <div className="absolute bottom-3 start-1/2 z-[500] -translate-x-1/2 rounded-full border border-ai-line bg-paper/95 px-3 py-1.5 text-[11px] font-semibold text-ai-dark shadow-card backdrop-blur">
          Straight-line guide only — use Directions for street routing
        </div>
      )}
    </div>
  );
}
