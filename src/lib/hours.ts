// Opening-hours logic. Everything is evaluated in the pilot area's time zone
// so the answer is the same whether the server runs in Huntsville or in UTC.

import type { Hours, Listing, MonthlyHours, OpenStatus } from "./types";

export const TIME_ZONE = "America/Chicago";

export interface LocalNow {
  year: number;
  /** 1..12 */
  month: number;
  /** 1..31 */
  day: number;
  /** 0 = Sunday */
  weekday: number;
  /** Minutes since local midnight */
  minutes: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function localNow(at: Date = new Date(), timeZone: string = TIME_ZONE): LocalNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** Calendar date in the pilot time zone as "YYYY-MM-DD". Used wherever only the day is stored. */
export function localDay(at: Date = new Date(), timeZone: string = TIME_ZONE): string {
  const n = localNow(at, timeZone);
  return `${n.year}-${String(n.month).padStart(2, "0")}-${String(n.day).padStart(2, "0")}`;
}

/**
 * Converts a wall-clock time in the pilot time zone to a UTC Date, handling
 * daylight saving without a date library.
 */
export function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = TIME_ZONE,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // What wall-clock time does that instant show in the zone? The gap is the offset.
  const shown = localNow(new Date(guess), timeZone);
  const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, 0, shown.minutes);
  return new Date(guess - (shownAsUtc - guess));
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 1 for the first Monday of the month, 2 for the second, and so on. */
export function nthOfMonth(dayOfMonth: number): number {
  return Math.floor((dayOfMonth - 1) / 7) + 1;
}

function monthlyAppliesToday(rule: MonthlyHours, now: LocalNow): boolean {
  return rule.weekday === now.weekday && rule.nth.includes(nthOfMonth(now.day));
}

/** All [open, close] windows that apply on the given local day, earliest first. */
export function windowsForDay(hours: Hours, now: LocalNow): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const w of hours.weekly) {
    if (w.days.includes(now.weekday)) out.push([toMinutes(w.open), toMinutes(w.close)]);
  }
  for (const m of hours.monthly) {
    if (monthlyAppliesToday(m, now)) out.push([toMinutes(m.open), toMinutes(m.close)]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hasStructuredHours(hours: Hours): boolean {
  return hours.weekly.length > 0 || hours.monthly.length > 0;
}

export function openStatus(
  listing: Pick<Listing, "hours" | "type" | "startsAt" | "endsAt">,
  at: Date = new Date(),
): OpenStatus {
  // One-off events are open exactly between their start and end.
  if (listing.type === "event" && listing.startsAt && listing.endsAt) {
    const start = new Date(listing.startsAt);
    const end = new Date(listing.endsAt);
    const now = localNow(at);
    const s = localNow(start);
    const e = localNow(end);
    const sameDay = s.year === now.year && s.month === now.month && s.day === now.day;
    if (at >= start && at <= end) return { state: "open", until: fmt(e.minutes), openToday: true };
    if (sameDay && at < start) return { state: "opens_later", until: fmt(s.minutes), openToday: true };
    return { state: "closed_today", until: null, openToday: false };
  }

  if (!hasStructuredHours(listing.hours)) {
    return { state: "unknown", until: null, openToday: false };
  }
  const now = localNow(at);
  const windows = windowsForDay(listing.hours, now);
  for (const [open, close] of windows) {
    if (now.minutes >= open && now.minutes < close) {
      return { state: "open", until: fmt(close), openToday: true };
    }
  }
  const later = windows.find(([open]) => open > now.minutes);
  if (later) return { state: "opens_later", until: fmt(later[0]), openToday: true };
  return { state: "closed_today", until: null, openToday: false };
}

/** "13:00" -> "1 PM", "09:30" -> "9:30 AM". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export interface Occurrence {
  /** Local calendar date */
  year: number;
  month: number;
  day: number;
  weekday: number;
  open: string;
  close: string;
}

/**
 * Upcoming dates for "nth weekday of the month" distributions, for example
 * "2nd Saturday 10 AM to noon". Used to build the Events tab from real
 * recurring schedules instead of hand-entered dates that go stale.
 */
export function upcomingMonthly(hours: Hours, at: Date = new Date(), daysAhead = 14): Occurrence[] {
  const out: Occurrence[] = [];
  if (hours.monthly.length === 0) return out;
  const today = localNow(at);
  // Walk forward one local day at a time. Noon avoids daylight-saving edges.
  const base = Date.UTC(today.year, today.month - 1, today.day, 12);
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(base + i * 86_400_000);
    const day = {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
      minutes: i === 0 ? today.minutes : 0,
    };
    for (const rule of hours.monthly) {
      if (!monthlyAppliesToday(rule, day)) continue;
      if (i === 0 && toMinutes(rule.close) <= today.minutes) continue; // already over today
      out.push({
        year: day.year,
        month: day.month,
        day: day.day,
        weekday: day.weekday,
        open: rule.open,
        close: rule.close,
      });
    }
  }
  return out;
}
