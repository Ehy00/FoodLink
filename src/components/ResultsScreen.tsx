"use client";

// Search results are intentionally responsive:
// - desktop/laptop: list and live map side-by-side
// - mobile: compact List / Map switch

import { ChevronLeft, LockKeyhole, Phone, ShieldCheck, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { telUrl } from "@/lib/format";
import type { Key } from "@/lib/i18n/dictionary";
import type { Audience, ListingView, Offer, SearchTags } from "@/lib/types";
import { useI18n } from "./I18nProvider";
import { ListingCard } from "./listing-bits";
import { EMPTY_TAGS, useSearch } from "./SearchProvider";
import { TagBar } from "./TagBar";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="min-h-72 animate-pulse bg-line/60" aria-hidden />,
});

const NEED_LABELS: Record<Offer, Key> = {
  groceries: "tag.groceries",
  hot_meal: "tag.hot_meal",
  produce: "tag.produce",
  baby: "tag.baby",
  hygiene: "tag.hygiene",
};

const AUDIENCE_LABELS: Record<Audience, Key> = {
  anyone: "tag.anyone",
  families: "tag.families",
  kids: "tag.kids",
  seniors: "tag.seniors",
  students: "tag.students",
};

function selectedLabels(tags: SearchTags, t: ReturnType<typeof useI18n>["t"]): string[] {
  const labels: string[] = [];
  for (const need of tags.needs) labels.push(t(NEED_LABELS[need]));
  for (const audience of tags.audiences) labels.push(t(AUDIENCE_LABELS[audience]));
  if (tags.noId) labels.push(t("tag.no_id"));
  if (tags.wheelchair) labels.push(t("tag.wheelchair"));
  if (tags.when === "today") labels.push(t("tag.today"));
  if (tags.when === "now") labels.push(t("tag.now"));
  if (tags.zip) labels.push(tags.zip);
  return labels;
}

function matchReasons(listing: ListingView, tags: SearchTags, t: ReturnType<typeof useI18n>["t"]): string[] {
  const reasons: string[] = [];
  for (const need of tags.needs) {
    if (listing.offers.includes(need)) reasons.push(t(NEED_LABELS[need]));
  }
  for (const audience of tags.audiences) {
    if (listing.audiences.includes(audience)) reasons.push(t(AUDIENCE_LABELS[audience]));
  }
  if (tags.noId && listing.idRequired === "no") reasons.push(t("tag.no_id"));
  if (tags.wheelchair && listing.wheelchair === "yes") reasons.push(t("tag.wheelchair"));
  if (tags.when === "now" && listing.open.state === "open") reasons.push(t("open.now"));
  else if (tags.when === "today" && listing.open.openToday) reasons.push(t("tag.today"));
  if (reasons.length === 0 && listing.distanceMiles !== null) reasons.push(t("card.miles", { n: listing.distanceMiles.toFixed(1) }));
  return reasons.slice(0, 3);
}

export function ResultsScreen({ foodLinePhone }: { foodLinePhone: string }) {
  const { t } = useI18n();
  const s = useSearch();
  const [draft, setDraft] = useState(s.query ?? "");
  const [view, setView] = useState<"list" | "map">("list");
  const [showUnconfirmed, setShowUnconfirmed] = useState(false);

  const { status, hasSearched, search } = s;
  useEffect(() => {
    if (status === "idle" && !hasSearched) void search(EMPTY_TAGS);
  }, [status, hasSearched, search]);

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
  const onMap = s.matches.length === 0 || showUnconfirmed ? [...s.matches, ...s.unconfirmed] : s.matches;
  const aiLabels = selectedLabels(s.tags, t);

  const resultsContent = (
    <div aria-live="polite" aria-busy={busy}>
      {busy && (
        <div role="status" className="space-y-3">
          <span className="sr-only">{t("results.loading")}</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-line/60" aria-hidden />
          ))}
        </div>
      )}

      {s.status === "ready" && (
        <>
          {s.matches.length > 0 && (
            <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-[15px] font-semibold text-ink">
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
            {s.matches.map((l) => {
              const reasons = matchReasons(l, s.tags, t);
              return (
                <div key={l.id}>
                  <ListingCard listing={l} />
                  {reasons.length > 0 && (
                    <div className="-mt-2 mx-3 rounded-b-xl border-x border-b border-ai-line bg-ai-soft px-3 pb-2.5 pt-3 text-xs text-ai-dark">
                      <span className="font-bold">{t("ai.match.title")}:</span> {reasons.join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
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
  );

  return (
    <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
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

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl border border-ai-line bg-ai-soft p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-ai" aria-hidden />
            <div>
              <h2 className="font-display text-sm font-semibold text-ai-dark">{t("ai.understood")}</h2>
              <p className="mt-1 text-sm text-body">
                {aiLabels.length > 0 ? aiLabels.join(" · ") : t("ai.nothing")}
              </p>
              <p className="mt-2 text-xs font-medium text-ai-dark">{t("ai.tapToChange")}</p>
            </div>
          </div>
        </section>

        <Link href="/privacy" className="rounded-2xl border border-mint-line bg-mint p-4 transition hover:bg-mint-line/60">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
            <div>
              <h2 className="font-display text-sm font-semibold text-ink">{t("security.center.title")}</h2>
              <p className="mt-1 text-sm text-body">{t("security.center.body")}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-forest">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
                {t("ai.notSaved")}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {s.zipOutsidePilot && s.status === "ready" && (
        <p className="rounded-xl bg-amber-soft px-3.5 py-2.5 text-sm text-amber">{t("home.zip.outside")}</p>
      )}

      {(s.status === "error" || s.status === "rate") && (
        <div role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
          <p>{s.status === "rate" ? t("results.rate") : s.errorMessage ?? t("results.error")}</p>
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
        <div className="md:hidden">
          <div role="group" className="mb-3 grid grid-cols-2 rounded-xl border border-line bg-paper p-1 text-sm font-bold shadow-card">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`min-h-10 rounded-lg ${view === v ? "bg-forest text-white" : "text-muted"}`}
              >
                {t(v === "list" ? "results.list" : "results.map")}
              </button>
            ))}
          </div>
          {view === "map" && (
            <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
              <MapView listings={onMap} origin={s.origin} className="h-[62dvh] min-h-[430px]" />
            </div>
          )}
        </div>
      )}

      <div className="md:grid md:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)] md:items-start md:gap-5 lg:gap-6">
        <section className={view === "map" ? "hidden md:block" : "block"}>{resultsContent}</section>

        <aside className="sticky top-4 hidden md:block">
          <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
            <div className="border-b border-line px-4 py-3">
              <h2 className="font-display text-base font-semibold text-ink">{t("map.title")}</h2>
              <p className="mt-0.5 text-xs text-muted">
                {s.tags.zip ? t("ai.summary.near", { zip: s.tags.zip }) : t("ai.summary.all")}
              </p>
            </div>
            {s.status === "ready" && onMap.length > 0 ? (
              <MapView listings={onMap} origin={s.origin} className="h-[calc(100dvh-250px)] min-h-[520px] max-h-[760px]" />
            ) : (
              <div className="h-[560px] animate-pulse bg-line/60" aria-hidden />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
