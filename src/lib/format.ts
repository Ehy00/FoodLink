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

const WEEKDAY_KEYS = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] };
const ORDINALS = { en: ["1st", "2nd", "3rd", "4th", "5th"], es: ["1.º", "2.º", "3.º", "4.º", "5.º"] };

export function weekdayShort(day: number, lang: Lang): string {
  return WEEKDAY_KEYS[lang][day];
}

/** [0,1,2,3,4] -> "Mon to Fri"; [1,3,4] -> "Mon, Wed, Thu". */
export function daysLabel(days: number[], lang: Lang): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return lang === "es" ? "Todos los días" : "Every day";
  const consecutive = sorted.length >= 3 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive) {
    const joiner = lang === "es" ? " a " : " to ";
    return `${weekdayShort(sorted[0], lang)}${joiner}${weekdayShort(sorted[sorted.length - 1], lang)}`;
  }
  return sorted.map((d) => weekdayShort(d, lang)).join(", ");
}

export function nthLabel(nth: number[], weekday: number, lang: Lang): string {
  const parts = nth.map((n) => ORDINALS[lang][n - 1]);
  const joined = parts.length > 1 ? parts.join(lang === "es" ? " y " : " and ") : parts[0];
  return `${joined} ${weekdayShort(weekday, lang)}`;
}

export function timeRange(open: string, close: string): string {
  return `${formatTime(open)} – ${formatTime(close)}`;
}

/** Date and time of an ISO instant, shown in the pilot area's time zone. */
export function eventParts(iso: string, lang: Lang): { weekday: string; day: string; month: string; time: string } {
  const d = new Date(iso);
  const locale = lang === "es" ? "es-US" : "en-US";
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, ...opts }).format(d);
  return {
    weekday: part({ weekday: "short" }).replace(".", "").toUpperCase(),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
    time: new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" })
      .format(d)
      .replace(":00", ""),
  };
}

export function relativeDay(iso: string, lang: Lang): string {
  const days = calendarDaysBetween(new Date(iso), new Date());
  if (days <= 0) return lang === "es" ? "hoy" : "today";
  if (days === 1) return lang === "es" ? "ayer" : "yesterday";
  return lang === "es" ? `hace ${days} días` : `${days} days ago`;
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
