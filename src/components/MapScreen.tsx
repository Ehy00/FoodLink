"use client";

// Full map of everything in the current search (or every listing if there is no search yet).

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useI18n } from "./I18nProvider";
import { EMPTY_TAGS, useSearch } from "./SearchProvider";
import { activeTags } from "./TagBar";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="flex-1 animate-pulse bg-line/60" aria-hidden />,
});

export function MapScreen() {
  const { t } = useI18n();
  const s = useSearch();
  const { status, hasSearched, search } = s;

  useEffect(() => {
    if (status === "idle" && !hasSearched) void search(EMPTY_TAGS);
  }, [status, hasSearched, search]);

  const all = [...s.matches, ...s.unconfirmed];
  const filters = activeTags(s.tags, t);

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-5 pb-3 pt-4">
        <h1 className="font-display text-[22px] font-semibold text-ink">{t("map.title")}</h1>
        <p className="mt-0.5 text-sm text-muted">
          {filters.length > 0 ? filters.map((f) => f.label).join(" · ") : t("ai.summary.all")}
        </p>
      </header>
      <div className="relative flex min-h-[60dvh] flex-1 flex-col">
        {status === "ready" ? (
          <MapView listings={all} origin={s.origin} className="min-h-[60dvh] flex-1" />
        ) : (
          <div className="flex-1 animate-pulse bg-line/60" role="status">
            <span className="sr-only">{t("map.loading")}</span>
          </div>
        )}
        <ul className="absolute bottom-3 left-3 z-[500] space-y-1 rounded-xl bg-paper/95 px-3 py-2 text-xs text-body shadow-card">
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-forest" aria-hidden /> {t("map.legend.fresh")}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#b7791f]" aria-hidden /> {t("map.legend.check")}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#7b857f]" aria-hidden /> {t("fresh.stale")}
          </li>
        </ul>
      </div>
    </div>
  );
}
