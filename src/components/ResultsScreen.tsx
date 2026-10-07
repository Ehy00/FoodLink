"use client";

// Resident search workspace:
// - one continuous Ask FoodLink conversation
// - closest results shown in manageable batches
// - map always represents exactly the locations currently visible in the list

import { Bot, ChevronLeft, Compass, Phone, Search, Send, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { telUrl } from "@/lib/format";
import type { Key } from "@/lib/i18n/dictionary";
import type { Audience, ListingView, Offer, SearchTags } from "@/lib/types";
import { useI18n } from "./I18nProvider";
import { ListingCard } from "./listing-bits";
import { EMPTY_TAGS, useSearch } from "./SearchProvider";
import type { MapListingKind } from "./MapView";
import { VoiceInputButton } from "./VoiceInputButton";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-[620px] animate-pulse bg-line/60" aria-hidden />,
});

const PAGE_SIZE = 4;

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

interface ChatTurn {
  id: number;
  question: string;
  answer: string;
  labels: string[];
  showTransitNote: boolean;
}

interface RankedResult {
  listing: ListingView;
  unconfirmed: boolean;
  originalIndex: number;
}

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
  if (reasons.length === 0 && listing.distanceMiles !== null) {
    reasons.push(t("card.miles", { n: listing.distanceMiles.toFixed(1) }));
  }
  return reasons.slice(0, 3);
}

function roundedTravelMinutes(distanceMiles: number, mph: number): number {
  const raw = (distanceMiles / mph) * 60;
  return Math.max(5, Math.ceil(raw / 5) * 5);
}

function conversationalReply(
  matches: ListingView[],
  hasOrigin: boolean,
  t: ReturnType<typeof useI18n>["t"],
): { message: string; showTransitNote: boolean } {
  if (matches.length === 0) return { message: t("ai.reply.none"), showTransitNote: false };
  if (!hasOrigin) return { message: t("ai.reply.noLocation"), showTransitNote: false };

  const closest = matches[0];
  const parts = [
    t(matches.length === 1 ? "ai.reply.found.one" : "ai.reply.found.many", { n: matches.length }),
  ];

  if (closest.distanceMiles !== null) {
    parts.push(
      t("ai.reply.closest", {
        name: closest.name,
        distance: closest.distanceMiles.toFixed(1),
      }),
    );
    parts.push(
      t("ai.reply.travel", {
        walk: roundedTravelMinutes(closest.distanceMiles, 3),
        drive: roundedTravelMinutes(closest.distanceMiles, 20),
      }),
    );
  }

  if (closest.open.state === "open") parts.push(t("ai.reply.open"));

  const otherNames = matches.slice(1, 3).map((listing) => listing.name);
  if (otherNames.length > 0) parts.push(t("ai.reply.more", { names: otherNames.join(" · ") }));

  return { message: parts.join(" "), showTransitNote: closest.distanceMiles !== null };
}

function rankResults(matches: ListingView[], unconfirmed: ListingView[], hasOrigin: boolean): RankedResult[] {
  const combined: RankedResult[] = [
    ...matches.map((listing, index) => ({ listing, unconfirmed: false, originalIndex: index })),
    ...unconfirmed.map((listing, index) => ({ listing, unconfirmed: true, originalIndex: matches.length + index })),
  ];

  if (!hasOrigin) return combined;

  return combined.sort((a, b) => {
    const da = a.listing.distanceMiles ?? Number.POSITIVE_INFINITY;
    const db = b.listing.distanceMiles ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    if (a.unconfirmed !== b.unconfirmed) return a.unconfirmed ? 1 : -1;
    return a.originalIndex - b.originalIndex;
  });
}

export function ResultsScreen({ foodLinePhone }: { foodLinePhone: string }) {
  const { t, lang } = useI18n();
  const s = useSearch();
  const [draft, setDraft] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [activeListingId, setActiveListingId] = useState<string | null>(null);
  const [focusedListingId, setFocusedListingId] = useState<string | null>(null);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [exploreQuery, setExploreQuery] = useState("");
  const [exploreFilter, setExploreFilter] = useState<
    "all" | "open" | "no_id" | "wheelchair" | "groceries" | "hot_meal" | "produce" | "pantry" | "event"
  >("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [desktopMapHeight, setDesktopMapHeight] = useState(520);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const capturedTurnRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const desktopResultsRef = useRef<HTMLElement>(null);

  const { status, hasSearched, search } = s;

  useEffect(() => {
    if (status === "idle" && !hasSearched) void search(EMPTY_TAGS);
  }, [status, hasSearched, search]);

  useEffect(() => {
    setPageIndex(0);
    setFocusedListingId(null);
  }, [s.queryId, s.tags.zip, s.origin?.lat, s.origin?.lng]);

  useEffect(() => {
    const element = desktopResultsRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateHeight = () => {
      setDesktopMapHeight(Math.max(1, Math.round(element.getBoundingClientRect().height)));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageIndex, s.status]);

  useEffect(() => {
    if (s.status !== "ready" || !s.query || s.queryId === 0 || capturedTurnRef.current === s.queryId) return;
    const reply = conversationalReply(s.matches, !!s.origin, t);
    setTurns((current) => [
      ...current,
      {
        id: s.queryId,
        question: s.query ?? "",
        answer: reply.message,
        labels: selectedLabels(s.tags, t),
        showTransitNote: reply.showTransitNote,
      },
    ]);
    capturedTurnRef.current = s.queryId;
  }, [s.status, s.queryId, s.query, s.matches, s.origin, s.tags, t]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns.length, s.status]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || s.status === "parsing" || s.status === "searching") return;
    setDraft("");
    void s.ask(text, true);
  }

  const busy = s.status === "parsing" || s.status === "searching" || s.status === "idle";
  const allRankedResults = rankResults(s.matches, s.unconfirmed, !!s.origin);
  const normalizedExploreQuery = exploreQuery.trim().toLowerCase();
  const rankedResults = allRankedResults.filter(({ listing }) => {
    const queryMatches =
      !normalizedExploreQuery ||
      [
        listing.name,
        listing.type,
        listing.city,
        listing.zip,
        ...listing.offers,
        ...listing.audiences,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedExploreQuery);

    if (!queryMatches) return false;

    switch (exploreFilter) {
      case "open":
        return listing.open.state === "open";
      case "no_id":
        return listing.idRequired === "no";
      case "wheelchair":
        return listing.wheelchair === "yes";
      case "groceries":
      case "hot_meal":
      case "produce":
        return listing.offers.includes(exploreFilter);
      case "pantry":
        return listing.type === "pantry" || listing.type === "food_bank" || listing.type === "campus_pantry";
      case "event":
        return listing.type === "event" || listing.type === "mobile";
      default:
        return true;
    }
  });
  const pageStart = pageIndex * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, rankedResults.length);
  const visibleResults = rankedResults.slice(pageStart, pageEnd);
  const visibleListings = visibleResults.map((result) => result.listing);
  const hasPreviousPage = pageIndex > 0;
  const hasNextPage = pageEnd < rankedResults.length;

  const listingKinds: Record<string, MapListingKind> = {};
  const rankById: Record<string, number> = {};
  visibleResults.forEach(({ listing, unconfirmed }, index) => {
    listingKinds[listing.id] = listing.underReview
      ? "review"
      : unconfirmed
        ? "check"
        : pageStart + index === 0
          ? "best"
          : "match";
    rankById[listing.id] = pageStart + index + 1;
  });

  const pendingQuestion =
    busy && s.query && s.queryId > 0 && capturedTurnRef.current !== s.queryId ? s.query : null;

  const exploreOptions = [
    ["all", t("map.explore.all")],
    ["open", t("chip.open_now")],
    ["no_id", t("tag.no_id")],
    ["wheelchair", t("tag.wheelchair")],
    ["groceries", t("tag.groceries")],
    ["hot_meal", t("tag.hot_meal")],
    ["produce", t("tag.produce")],
    ["pantry", t("map.explore.pantries")],
    ["event", t("map.explore.events")],
  ] as const;

  function chooseExploreFilter(next: typeof exploreFilter) {
    setExploreFilter(next);
    setPageIndex(0);
    setFocusedListingId(null);
  }

  const resultsContent = (
    <div aria-live="polite" aria-busy={busy}>
      {busy && rankedResults.length === 0 && (
        <div role="status" className="space-y-3">
          <span className="sr-only">{t("results.loading")}</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-line/60" aria-hidden />
          ))}
        </div>
      )}

      {s.status === "ready" && (
        <>
          {rankedResults.length > 0 && (
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-ink">
                  {t("results.showingRange", {
                    start: pageStart + 1,
                    end: pageEnd,
                    total: rankedResults.length,
                  })}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {s.origin ? t("results.closest") : t("results.noOrigin")}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {visibleResults.map(({ listing, unconfirmed }) => {
              const reasons = matchReasons(listing, s.tags, t);
              return (
                <div key={listing.id}>
                  <ListingCard
                    listing={listing}
                    highlighted={activeListingId === listing.id || focusedListingId === listing.id}
                    onHover={(active) => setActiveListingId(active ? listing.id : null)}
                    onSelect={() => setFocusedListingId((current) => (current === listing.id ? null : listing.id))}
                  />
                  {(reasons.length > 0 || unconfirmed) && (
                    <div
                      className={`-mt-2 mx-3 rounded-b-xl border-x border-b px-3 pb-2.5 pt-3 text-xs ${
                        unconfirmed
                          ? "border-amber-soft bg-amber-soft text-amber"
                          : "border-ai-line bg-ai-soft text-ai-dark"
                      }`}
                    >
                      {unconfirmed ? (
                        <span className="font-bold">{t("results.unconfirmed.body")}</span>
                      ) : (
                        <>
                          <span className="font-bold">{t("ai.match.title")}:</span> {reasons.join(" · ")}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {rankedResults.length === 0 && (
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

          {(hasPreviousPage || hasNextPage) && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFocusedListingId(null);
                  setPageIndex((page) => Math.max(0, page - 1));
                }}
                disabled={!hasPreviousPage}
                className="min-h-12 rounded-full border-2 border-line bg-paper/90 px-4 text-sm font-bold text-forest shadow-card transition hover:bg-mint disabled:cursor-not-allowed disabled:opacity-35"
              >
                {t("results.showPrevious")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFocusedListingId(null);
                  setPageIndex((page) => page + 1);
                }}
                disabled={!hasNextPage}
                className="min-h-12 rounded-full border-2 border-forest bg-paper/90 px-4 text-sm font-bold text-forest shadow-card transition hover:-translate-y-0.5 hover:bg-mint disabled:cursor-not-allowed disabled:opacity-35"
              >
                {t("results.showMore")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
      <section className="fade-up overflow-hidden rounded-[26px] border border-ai-line bg-paper/90 shadow-card backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-ai-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label={t("results.back")} className="grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-cream">
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </Link>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ai text-white shadow-card">
              <Bot className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-sm font-semibold text-ink">FoodLink AI</h1>
              <p className="text-[11px] text-muted">{t("chat.context")}</p>
            </div>
          </div>
        </div>

        <div className="max-h-[440px] min-h-[160px] space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
          {turns.length === 0 && !pendingQuestion && (
            <div className="flex items-start gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ai text-white">
                <Bot className="h-4 w-4" aria-hidden />
              </span>
              <div className="max-w-[90%] rounded-2xl rounded-ss-md border border-ai-line bg-ai-soft px-4 py-3">
                <p className="text-sm leading-relaxed text-body">{t("chat.welcome")}</p>
              </div>
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className="space-y-3">
              <div className="ms-auto flex max-w-[90%] items-start justify-end gap-2">
                <div className="rounded-2xl rounded-se-md bg-forest px-4 py-3 text-sm leading-relaxed text-white shadow-card">
                  {turn.question}
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest text-white">
                  <UserRound className="h-4 w-4" aria-hidden />
                </span>
              </div>

              <div className="flex max-w-[94%] items-start gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ai text-white shadow-card">
                  <Bot className="h-4 w-4" aria-hidden />
                </span>
                <div className="rounded-2xl rounded-ss-md border border-ai-line bg-ai-soft px-4 py-3 shadow-card">
                  <p className="text-sm leading-relaxed text-body">{turn.answer}</p>
                  {turn.labels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {turn.labels.map((label) => (
                        <span key={label} className="rounded-full border border-ai-line bg-paper/70 px-2 py-1 text-[10px] font-bold text-ai-dark">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                  {turn.showTransitNote && (
                    <p className="mt-2 text-[11px] leading-relaxed text-muted">{t("ai.reply.transit")}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {pendingQuestion && (
            <div className="space-y-3">
              <div className="ms-auto flex max-w-[90%] items-start justify-end gap-2">
                <div className="rounded-2xl rounded-se-md bg-forest px-4 py-3 text-sm leading-relaxed text-white shadow-card">
                  {pendingQuestion}
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest text-white">
                  <UserRound className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-ai-dark">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ai text-white">
                  <Bot className="h-4 w-4" aria-hidden />
                </span>
                <span className="rounded-2xl rounded-ss-md border border-ai-line bg-ai-soft px-4 py-3">
                  <Sparkles className="me-1.5 inline h-4 w-4 animate-pulse" aria-hidden />
                  {t("ai.thinking")}
                </span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={submit} className="border-t border-ai-line bg-ai-soft/40 p-3 sm:p-4">
          <div className="ring-within flex items-center gap-2 rounded-2xl border border-ai-line bg-paper px-2 py-1.5 shadow-card">
            <Sparkles className="ms-2 h-4 w-4 shrink-0 text-ai" aria-hidden />
            <label htmlFor="ask-followup" className="sr-only">
              {t("chat.followup")}
            </label>
            <input
              id="ask-followup"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={280}
              autoComplete="off"
              enterKeyHint="send"
              placeholder={t("chat.followup")}
              className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted"
            />
            <VoiceInputButton
              lang={lang}
              onTranscript={(text) => setDraft((current) => (current.trim() ? `${current.trim()} ${text}` : text))}
              label={t("voice.start")}
              listeningLabel={t("voice.listening")}
              unavailableLabel={t("voice.unavailable")}
            />
            <button
              type="submit"
              disabled={!draft.trim() || busy}
              aria-label={t("chat.send")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ai text-white transition hover:bg-ai-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </form>
      </section>

      <Link href="/privacy" className="interactive-card rounded-2xl border border-mint-line bg-mint/90 p-4 shadow-card backdrop-blur hover:bg-mint-line/60">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <div>
            <h2 className="font-display text-sm font-semibold text-ink">{t("home.private.title")}</h2>
            <p className="mt-1 text-sm text-body">{t("home.private.body")}</p>
            <p className="mt-2 text-xs font-bold text-forest">{t("privacy.link")} →</p>
          </div>
        </div>
      </Link>

      {s.status === "ready" && allRankedResults.length > 0 && (
        <section className="rounded-2xl border border-line bg-paper/90 p-3 shadow-card backdrop-blur sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setExploreOpen((open) => !open)}
              aria-expanded={exploreOpen}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-forest px-4 text-sm font-bold text-white transition hover:bg-forest-dark"
            >
              <Compass className="h-4 w-4" aria-hidden />
              {t("map.explore.title")}
            </button>
            {(exploreQuery || exploreFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setExploreQuery("");
                  chooseExploreFilter("all");
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-bold text-muted hover:bg-cream"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {t("map.explore.clear")}
              </button>
            )}
          </div>

          {exploreOpen && (
            <div className="mt-3 space-y-3">
              <label className="ring-within flex items-center gap-2 rounded-xl border border-line bg-paper px-3">
                <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span className="sr-only">{t("map.explore.search")}</span>
                <input
                  value={exploreQuery}
                  onChange={(event) => {
                    setExploreQuery(event.target.value);
                    setPageIndex(0);
                    setFocusedListingId(null);
                  }}
                  placeholder={t("map.explore.search")}
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted"
                />
              </label>

              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label={t("map.explore.categories")}>
                {exploreOptions.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => chooseExploreFilter(value)}
                    aria-pressed={exploreFilter === value}
                    className={`interactive-chip min-h-9 shrink-0 rounded-full border px-3 text-xs font-bold ${
                      exploreFilter === value
                        ? "border-forest bg-forest text-white"
                        : "border-line bg-paper text-body"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted">
                {t("map.explore.count", { n: rankedResults.length })}
              </p>
            </div>
          )}
        </section>
      )}

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

      {s.status === "ready" && visibleListings.length > 0 && (
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
            <div className="overflow-hidden rounded-2xl border border-line bg-paper/90 shadow-card backdrop-blur">
              <MapView
                listings={visibleListings}
                origin={s.origin}
                listingKinds={listingKinds}
                rankById={rankById}
                activeListingId={activeListingId}
                focusedListingId={focusedListingId}
                onListingHover={setActiveListingId}
                onListingSelect={setFocusedListingId}
                className="h-[62dvh] min-h-[430px]"
              />
            </div>
          )}
        </div>
      )}

      <div className="md:grid md:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)] md:items-start md:gap-5 lg:gap-6">
        <section ref={desktopResultsRef} className={view === "map" ? "hidden md:block" : "block"}>{resultsContent}</section>

        <aside className="sticky top-4 hidden md:block">
          <div
            style={{ height: desktopMapHeight }}
            className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper/90 shadow-card backdrop-blur"
          >
            <div className="border-b border-line px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">{t("map.title")}</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.tags.zip ? t("ai.summary.near", { zip: s.tags.zip }) : t("ai.summary.all")}
                  </p>
                </div>
                <span className="rounded-full bg-cream px-2.5 py-1 text-[10px] font-bold text-muted">
                  {t("results.showingRange", {
                    start: pageStart + 1,
                    end: pageEnd,
                    total: rankedResults.length,
                  })}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-medium text-muted" aria-label="Map legend">
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-ai" />{t("map.legend.best")}</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-forest" />{t("map.legend.match")}</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber" />{t("map.legend.check")}</span>
                {visibleListings.some((listing) => listing.underReview) && (
                  <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-danger" />{t("map.legend.review")}</span>
                )}
                {s.origin && <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-blue-500" />{t("map.legend.you")}</span>}
              </div>
            </div>

            {s.status === "ready" && visibleListings.length > 0 ? (
              <MapView
                listings={visibleListings}
                origin={s.origin}
                listingKinds={listingKinds}
                rankById={rankById}
                activeListingId={activeListingId}
                focusedListingId={focusedListingId}
                onListingHover={setActiveListingId}
                onListingSelect={setFocusedListingId}
                height="100%"
                className="min-h-0 flex-1"
              />
            ) : (
              <div className="min-h-0 flex-1 animate-pulse bg-line/60" aria-hidden />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
