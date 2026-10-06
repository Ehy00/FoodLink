"use client";

// Step 2 of the resident journey: see what the AI understood, fix it if it is
// wrong, and pick a place.

import { ChevronLeft, Phone, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { telUrl } from "@/lib/format";
import { useI18n } from "./I18nProvider";
import { ListingCard } from "./listing-bits";
import { EMPTY_TAGS, useSearch } from "./SearchProvider";
import { TagBar } from "./TagBar";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-44 animate-pulse bg-line/60" aria-hidden />,
});

export function ResultsScreen({ foodLinePhone }: { foodLinePhone: string }) {
  const { t } = useI18n();
  const s = useSearch();
  const [draft, setDraft] = useState(s.query ?? "");
  const [view, setView] = useState<"list" | "map">("list");
  const [showUnconfirmed, setShowUnconfirmed] = useState(false);

  // Opening this screen directly (or after a refresh, which clears everything)
  // shows all listings rather than an empty page.
  const { status, hasSearched, search } = s;
  useEffect(() => {
    if (status === "idle" && !hasSearched) void search(EMPTY_TAGS);
  }, [status, hasSearched, search]);

  // Keep the search box in step when a new request arrives from the Home screen.
  const [shownQuery, setShownQuery] = useState(s.query);
  if (shownQuery !== s.query) {
    setShownQuery(s.query);
    setDraft(s.query ?? "");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (text) void s.ask(text);
  }

  const busy = s.status === "parsing" || s.status === "searching" || s.status === "idle";
  // The map shows the confirmed matches. Unconfirmed places join it only once the resident expands them.
  const onMap = s.matches.length === 0 || showUnconfirmed ? [...s.matches, ...s.unconfirmed] : s.matches;

  return (
    <div className="flex flex-col gap-4 px-5 pb-8 pt-4">
      <form onSubmit={submit} className="flex items-center gap-2">
        <Link href="/" aria-label={t("results.back")} className="grid h-11 w-9 shrink-0 place-items-center text-ink">
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </Link>
        <div className="ring-within flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-paper px-4 shadow-card">
          <Sparkles className="h-4 w-4 shrink-0 text-ai" aria-hidden />
          <label htmlFor="ask-again" className="sr-only">
            {t("ask.again")}
          </label>
          <input
            id="ask-again"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={280}
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t("ask.again")}
            className="min-h-11 w-full bg-transparent text-base text-ink placeholder:text-muted"
          />
        </div>
      </form>

      {s.status === "parsing" ? (
        <div className="rounded-2xl border border-ai-line bg-ai-soft p-3.5 text-sm font-medium text-ai-dark" role="status">
          <Sparkles className="mr-1.5 inline h-4 w-4 animate-pulse" aria-hidden />
          {t("ai.thinking")}
        </div>
      ) : (
        <TagBar tags={s.tags} fromAi={s.query !== null} engine={s.engine} onChange={(tags) => void s.search(tags, true)} />
      )}

      {s.zipOutsidePilot && s.status === "ready" && (
        <p className="rounded-xl bg-amber-soft px-3.5 py-2.5 text-sm text-amber">{t("home.zip.outside")}</p>
      )}

      {(s.status === "error" || s.status === "rate") && (
        <div role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
          <p>{t(s.status === "rate" ? "results.rate" : "results.error")}</p>
          <button
            type="button"
            onClick={() => void s.search(s.tags, true)}
            className="mt-2 min-h-10 rounded-full border-2 border-danger px-4 font-bold"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {s.status === "ready" && onMap.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-line">
          <MapView listings={onMap} origin={s.origin} className={view === "map" ? "h-[55dvh]" : "h-44"} zoomButtons={view === "map"} />
          <div role="group" className="absolute right-2.5 top-2.5 z-[500] flex rounded-full bg-paper p-0.5 text-xs font-bold shadow-card">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`min-h-8 rounded-full px-3 ${view === v ? "bg-forest text-white" : "text-muted"}`}
              >
                {t(v === "list" ? "results.list" : "results.map")}
              </button>
            ))}
          </div>
        </div>
      )}

      <div aria-live="polite" aria-busy={busy}>
        {busy && (
          <div role="status" className="space-y-3">
            <span className="sr-only">{t("results.loading")}</span>
            {[0, 1].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-line/60" aria-hidden />
            ))}
          </div>
        )}

        {s.status === "ready" && (
          <>
            {s.matches.length > 0 && (
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="font-display text-[15px] font-semibold text-ink">
                  {/* "Verified" is only claimed when every match was checked recently. */}
                  {t(
                    `results.${s.matches.every((m) => m.freshness.level === "fresh" && !m.underReview) ? "matches" : "places"}.${
                      s.matches.length === 1 ? "one" : "many"
                    }`,
                    { n: s.matches.length },
                  )}
                </h2>
                <span className="text-xs text-muted">{s.origin ? t("results.closest") : t("results.noOrigin")}</span>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {s.matches.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>

            {s.matches.length === 0 && (
              <div className="rounded-2xl border border-line bg-paper p-5 text-center shadow-card">
                <h2 className="font-display text-base font-semibold text-ink">{t("results.none.title")}</h2>
                <p className="mt-1 text-sm text-muted">{t("results.none.body")}</p>
                <a
                  href={telUrl(foodLinePhone)}
                  className="mt-3.5 inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white"
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  {foodLinePhone}
                </a>
              </div>
            )}

            {s.unconfirmed.length > 0 && (
              <section className="mt-6">
                <h2 className="font-display text-[15px] font-semibold text-ink">{t("results.unconfirmed.title")}</h2>
                <p className="mb-2.5 mt-0.5 text-xs text-muted">{t("results.unconfirmed.body")}</p>
                <div className="flex flex-col gap-3">
                  {(showUnconfirmed ? s.unconfirmed : s.unconfirmed.slice(0, 2)).map((l) => (
                    <ListingCard key={l.id} listing={l} />
                  ))}
                </div>
                {!showUnconfirmed && s.unconfirmed.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setShowUnconfirmed(true)}
                    className="mt-3 min-h-11 w-full rounded-full border-2 border-line bg-paper text-sm font-bold text-forest"
                  >
                    {t("results.unconfirmed.more", { n: s.unconfirmed.length - 2 })}
                  </button>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
