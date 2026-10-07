"use client";

// Step 1 of the resident journey: open FoodLink and say what you need.

import { ArrowRight, Building2, ClipboardCheck, LocateFixed, LockKeyhole, Phone, Search, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { postJson } from "@/lib/client-api";
import type { EventView } from "@/lib/db/listings";
import { telUrl } from "@/lib/format";
import type { Key } from "@/lib/i18n/dictionary";
import type { SearchTags } from "@/lib/types";
import { EventRow } from "./EventRow";
import { useI18n } from "./I18nProvider";
import { EMPTY_TAGS, useSearch } from "./SearchProvider";
import { SecurityShowcase } from "./SecurityShowcase";
import { VoiceInputButton } from "./VoiceInputButton";

const QUICK_FILTERS: Array<{ key: Key; apply: (t: SearchTags) => SearchTags }> = [
  { key: "chip.open_today", apply: (t) => ({ ...t, when: "today" }) },
  { key: "chip.free_meals", apply: (t) => ({ ...t, needs: ["hot_meal"] }) },
  { key: "chip.no_id", apply: (t) => ({ ...t, noId: true }) },
  { key: "chip.groceries", apply: (t) => ({ ...t, needs: ["groceries"] }) },
  { key: "chip.wheelchair", apply: (t) => ({ ...t, wheelchair: true }) },
];

export function HomeScreen({ foodLinePhone }: { foodLinePhone: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const search = useSearch();
  const [zip, setZip] = useState(search.tags.zip ?? "");
  const [zipError, setZipError] = useState(false);
  const [question, setQuestion] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationFailed, setLocationFailed] = useState(false);
  const [events, setEvents] = useState<EventView[] | null>(null);

  // "This week near you": uses a ZIP or location only if the resident already gave one this visit.
  const knownZip = search.tags.zip;
  const device = search.deviceOrigin;
  useEffect(() => {
    let cancelled = false;
    postJson<{ events: EventView[] }>("/api/events", { zip: knownZip, origin: device })
      .then((r) => !cancelled && setEvents(r.events))
      .catch(() => !cancelled && setEvents([]));
    return () => {
      cancelled = true;
    };
  }, [knownZip, device]);

  /** Start from a clean set of filters but remember the ZIP typed during this visit. */
  const base = (): SearchTags => ({ ...EMPTY_TAGS, zip: /^\d{5}$/.test(zip) ? zip : search.tags.zip });

  function submitZip(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      setZipError(true);
      return;
    }
    void search.search({ ...EMPTY_TAGS, zip });
    router.push("/search");
  }

  function submitQuestion(e: FormEvent) {
    e.preventDefault();
    const text = question.trim();
    if (!text) return;
    void search.ask(text);
    router.push("/search");
  }

  async function shareLocation() {
    setLocating(true);
    setLocationFailed(false);
    const ok = await search.locate();
    setLocating(false);
    if (!ok) {
      setLocationFailed(true);
      return;
    }
    void search.search({ ...EMPTY_TAGS });
    router.push("/search");
  }

  return (
    <div className="mx-auto grid w-full max-w-[1220px] gap-5 px-4 pb-8 pt-5 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
      <section className="hero-panel fade-up relative overflow-hidden rounded-[30px] border border-line bg-paper/80 px-5 py-7 shadow-card backdrop-blur-xl md:col-span-2 sm:px-7 sm:py-9">
        <div className="hero-orb hero-orb-one" aria-hidden />
        <div className="hero-orb hero-orb-two" aria-hidden />
        <div className="relative max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-mint-line bg-mint/80 px-3 py-1.5 text-xs font-bold text-forest shadow-card">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {t("home.private.title")}
          </div>
          <h1 className="font-display text-[30px] font-semibold leading-[1.08] text-ink sm:text-[40px] lg:text-[48px]">{t("home.title")}</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">{t("home.subtitle")}</p>
        </div>
      </section>

      <SecurityShowcase />

      <div>
        <form onSubmit={submitZip} className="ring-within interactive-card flex items-center gap-2 rounded-2xl border border-line bg-paper/90 py-1.5 pl-4 pr-1.5 shadow-card backdrop-blur">
          <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
          <label htmlFor="zip" className="sr-only">
            {t("home.zip.placeholder")}
          </label>
          <input
            id="zip"
            name="zip"
            value={zip}
            onChange={(e) => {
              setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
              setZipError(false);
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder={t("home.zip.placeholder")}
            aria-invalid={zipError}
            aria-describedby={zipError ? "zip-error" : undefined}
            className="min-h-11 w-full bg-transparent text-base text-ink placeholder:text-muted"
          />
          <button
            type="submit"
            aria-label={t("home.zip.submit")}
            className="grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-forest text-white active:bg-forest-dark"
          >
            <ArrowRight className="h-5 w-5" aria-hidden />
          </button>
        </form>
        {zipError && (
          <p id="zip-error" role="alert" className="mt-1.5 px-1 text-sm text-danger">
            {t("home.zip.invalid")}
          </p>
        )}
        <button
          type="button"
          onClick={shareLocation}
          disabled={locating}
          className="mt-2 flex min-h-10 items-center gap-1.5 px-1 text-sm font-bold text-forest disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" aria-hidden />
          {locating ? t("home.location.working") : t("home.location.use")}
          <span className="font-normal text-muted">· {t("home.location.notStored")}</span>
        </button>
        {locationFailed && (
          <p role="alert" className="px-1 text-sm text-danger">
            {t("home.location.denied")}
          </p>
        )}
      </div>

      <form onSubmit={submitQuestion} className="interactive-card relative overflow-hidden rounded-2xl border border-ai-line bg-ai-soft/90 p-4 shadow-card backdrop-blur">
        <label htmlFor="ask" className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-5 w-5 text-ai" aria-hidden />
          <span className="font-display text-[15px] font-semibold text-ai-dark">{t("home.ask.title")}</span>
          <span className="rounded-full bg-ai px-1.5 py-0.5 text-[10px] font-bold text-white">{t("home.ask.badge")}</span>
          <span className="text-xs text-muted">{t("home.ask.hint")}</span>
        </label>
        <div className="ring-within mt-2.5 flex items-center gap-2 rounded-xl border border-ai-line bg-paper py-1 pl-3.5 pr-1">
          <input
            id="ask"
            name="ask"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={280}
            autoComplete="off"
            enterKeyHint="search"
            placeholder={`“${t("home.ask.placeholder")}”`}
            className="min-h-11 w-full bg-transparent text-base text-ink placeholder:text-muted"
          />
          <VoiceInputButton
            lang={lang}
            onTranscript={(text) => setQuestion((current) => (current.trim() ? `${current.trim()} ${text}` : text))}
            label={t("voice.start")}
            listeningLabel={t("voice.listening")}
            unavailableLabel={t("voice.unavailable")}
          />
          <button
            type="submit"
            aria-label={t("home.ask.submit")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ai text-white active:bg-ai-dark"
          >
            <ArrowRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </form>

      <div className="no-scrollbar flex gap-2 overflow-x-auto md:col-span-2">
        {QUICK_FILTERS.map(({ key, apply }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              void search.search(apply(base()));
              router.push("/search");
            }}
            className="interactive-chip min-h-10 shrink-0 rounded-full border border-line bg-paper/90 px-3.5 text-sm font-medium text-ink shadow-card backdrop-blur active:bg-mint"
          >
            {t(key)}
          </button>
        ))}
      </div>

      <section aria-labelledby="week-title" className="min-w-0">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 id="week-title" className="font-display text-[17px] font-semibold text-ink">
            {t("home.week.title")}
          </h2>
          <Link href="/events" className="text-sm font-bold text-forest">
            {t("home.week.all")}
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          {events === null && <div className="h-20 animate-pulse rounded-2xl bg-line/60" aria-hidden />}
          {events?.length === 0 && <p className="text-sm text-muted">{t("home.week.empty")}</p>}
          {events?.slice(0, 3).map((e) => <EventRow key={e.key} event={e} />)}
        </div>
      </section>

      <a
        href={telUrl(foodLinePhone)}
        className="flex min-h-12 items-center justify-center gap-2 self-start rounded-full border-2 border-forest bg-paper px-4 text-sm font-bold text-forest transition hover:bg-mint active:bg-mint md:self-end"
      >
        <Phone className="h-4 w-4" aria-hidden />
        {t("home.foodline")} · {foodLinePhone}
      </a>

      <section className="md:col-span-2 mt-2 rounded-[26px] border border-line bg-paper/90 p-5 shadow-card backdrop-blur sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest text-white">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Organizations & FoodLink Review Team</h2>
            <p className="mt-1 text-sm text-muted">
              Food banks, churches and nonprofits can manage verified resources. FoodLink reviewers approve organizations, listings and reports before changes reach residents.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Link
            href="/organizer/login"
            className="interactive-card rounded-2xl border border-mint-line bg-mint/70 p-4 shadow-card"
          >
            <div className="flex items-center gap-2 text-forest">
              <LockKeyhole className="h-5 w-5" aria-hidden />
              <h3 className="font-display text-base font-semibold">Verified Organization Sign In</h3>
            </div>
            <p className="mt-2 text-sm text-body">
              Sign in with your organization ID, password and 6-digit authenticator code.
            </p>
            <p className="mt-3 text-xs font-bold text-forest">Open organization portal →</p>
          </Link>

          <Link
            href="/review"
            className="interactive-card rounded-2xl border border-ai-line bg-ai-soft/70 p-4 shadow-card"
          >
            <div className="flex items-center gap-2 text-ai-dark">
              <ClipboardCheck className="h-5 w-5" aria-hidden />
              <h3 className="font-display text-base font-semibold">Review Queue & Security Log</h3>
            </div>
            <p className="mt-2 text-sm text-body">
              Review new organizations, food-resource submissions, resident reports and recent staff security activity.
            </p>
            <p className="mt-3 text-xs font-bold text-ai-dark">Open review portal →</p>
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted">
          New organization? <Link href="/organizer/apply" className="font-bold text-forest underline">Apply to become a verified FoodLink organization</Link>.
        </p>
      </section>
    </div>
  );
}
