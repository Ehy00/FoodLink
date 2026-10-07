// Small display helpers shared by resident screens.

import { calendarDaysBetween } from "./freshness";
import { formatTime, TIME_ZONE } from "./hours";
import type { Key } from "./i18n/dictionary";
import type { Freshness, Lang, Listing, OpenStatus } from "./types";

type T = (key: Key, vars?: Record<string, string | number>) => string;

export function formatMiles(miles: number): string {
  return miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
}

export function openLabel(t: T, open: OpenStatus): string {
  switch (open.state) {
    case "open":
      return open.until ? t("open.until", { t: formatTime(open.until) }) : t("open.now");
    case "opens_later":
      return t("open.opensAt", { t: formatTime(open.until ?? "00:00") });
    case "closed_today":
      return t("open.closedToday");
    default:
      return t("open.unknown");
  }
}

/** One line for a card: opening status, or the date and time for a one-off event. */
export function whenLabel(t: T, l: Pick<Listing, "type" | "startsAt" | "endsAt"> & { open: OpenStatus }, lang: Lang): string {
  if (l.type === "event" && l.startsAt && l.endsAt && l.open.state !== "open") {
    const s = eventParts(l.startsAt, lang);
    const e = eventParts(l.endsAt, lang);
    return `${s.weekday} ${s.day} ${s.month} · ${s.time} – ${e.time}`;
  }
  return openLabel(t, l.open);
}

export function verifiedLabel(t: T, f: Freshness): string {
  if (f.daysSinceVerified === 0) return t("fresh.today");
  if (f.daysSinceVerified === 1) return t("fresh.yesterday");
  return t("fresh.days", { n: f.daysSinceVerified });
}

export function eligibilityText(l: Pick<Listing, "eligibilityEn" | "eligibilityEs">, lang: Lang): string {
  return lang === "es" && l.eligibilityEs ? l.eligibilityEs : l.eligibilityEn;
}

export function hoursNote(l: Pick<Listing, "hoursNoteEn" | "hoursNoteEs">, lang: Lang): string | null {
  return lang === "es" && l.hoursNoteEs ? l.hoursNoteEs : l.hoursNoteEn;
}

const LOCALES: Record<Lang, string> = {
  en: "en-US",
  es: "es-US",
  fr: "fr-FR",
  pt: "pt-BR",
  ar: "ar",
  zh: "zh-CN",
  hi: "hi-IN",
  bn: "bn-BD",
  ru: "ru-RU",
  sw: "sw-KE",
};

const EVERY_DAY: Record<Lang, string> = {
  en: "Every day",
  es: "Todos los días",
  fr: "Tous les jours",
  pt: "Todos os dias",
  ar: "كل يوم",
  zh: "每天",
  hi: "हर दिन",
  bn: "প্রতিদিন",
  ru: "Каждый день",
  sw: "Kila siku",
};

const RANGE_JOINER: Record<Lang, string> = {
  en: " to ",
  es: " a ",
  fr: " à ",
  pt: " a ",
  ar: " إلى ",
  zh: " 至 ",
  hi: " से ",
  bn: " থেকে ",
  ru: " – ",
  sw: " hadi ",
};

const LIST_JOINER: Record<Lang, string> = {
  en: " and ",
  es: " y ",
  fr: " et ",
  pt: " e ",
  ar: " و",
  zh: "、",
  hi: " और ",
  bn: " এবং ",
  ru: " и ",
  sw: " na ",
};

export function weekdayShort(day: number, lang: Lang): string {
  const date = new Date(Date.UTC(2024, 0, 7 + day));
  return new Intl.DateTimeFormat(LOCALES[lang], { weekday: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "");
}

/** [0,1,2,3,4] -> a localized day range; [1,3,4] -> a localized list. */
export function daysLabel(days: number[], lang: Lang): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return EVERY_DAY[lang];
  const consecutive = sorted.length >= 3 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive) {
    return `${weekdayShort(sorted[0], lang)}${RANGE_JOINER[lang]}${weekdayShort(sorted[sorted.length - 1], lang)}`;
  }
  return sorted.map((d) => weekdayShort(d, lang)).join(", ");
}

function ordinal(n: number, lang: Lang): string {
  if (lang === "en") {
    const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
    return `${n}${suffix}`;
  }
  if (lang === "es") return `${n}.º`;
  return String(n);
}

export function nthLabel(nth: number[], weekday: number, lang: Lang): string {
  const parts = nth.map((n) => ordinal(n, lang));
  const joined =
    parts.length > 1
      ? `${parts.slice(0, -1).join(", ")}${LIST_JOINER[lang]}${parts[parts.length - 1]}`
      : parts[0];
  return `${joined} ${weekdayShort(weekday, lang)}`;
}

export function timeRange(open: string, close: string): string {
  return `${formatTime(open)} – ${formatTime(close)}`;
}

/** Date and time of an ISO instant, shown in the pilot area's time zone. */
export function eventParts(iso: string, lang: Lang): { weekday: string; day: string; month: string; time: string } {
  const d = new Date(iso);
  const locale = LOCALES[lang];
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, ...opts }).format(d);
  return {
    weekday: part({ weekday: "short" }).replace(".", "").toUpperCase(),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
    time: new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" })
      .format(d)
      .replace(":00", ""),
  };
}

export function relativeDay(iso: string, lang: Lang): string {
  const days = calendarDaysBetween(new Date(iso), new Date());
  const relative = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: "auto" });
  return relative.format(-Math.max(days, 0), "day");
}

/**
 * Link that opens the phone's own maps app with the destination filled in.
 * Only the destination is passed. FoodLink never sends the resident's location.
 */
export function directionsUrl(l: Pick<Listing, "address" | "city" | "zip">): string {
  const destination = encodeURIComponent(`${l.address}, ${l.city}, AL ${l.zip}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

export function telUrl(phone: string): string {
  return `tel:+1${phone.replace(/\D/g, "").replace(/^1/, "")}`;
}
