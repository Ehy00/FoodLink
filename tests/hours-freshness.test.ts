import { describe, expect, it } from "vitest";
import { calendarDaysBetween, freshness } from "@/lib/freshness";
import { localDay, localNow, localToUtc, nthOfMonth, openStatus, upcomingMonthly } from "@/lib/hours";
import type { Hours } from "@/lib/types";

// Wednesday 7 October 2026, Central Daylight Time (UTC-5)
const wedNoon = localToUtc(2026, 10, 7, 12, 0);
const weekly: Hours = { weekly: [{ days: [1, 3, 4], open: "16:00", close: "19:00" }], monthly: [] };
const pantry = (hours: Hours) => ({ hours, type: "pantry" as const, startsAt: null, endsAt: null });

describe("time zone handling", () => {
  it("converts Central time to UTC in summer and winter", () => {
    expect(wedNoon.toISOString()).toBe("2026-10-07T17:00:00.000Z"); // CDT
    expect(localToUtc(2026, 12, 7, 12, 0).toISOString()).toBe("2026-12-07T18:00:00.000Z"); // CST
  });

  it("reads the local weekday and day even when UTC is already tomorrow", () => {
    const lateTuesday = localToUtc(2026, 10, 6, 23, 30); // 04:30 UTC Wednesday
    expect(localNow(lateTuesday)).toMatchObject({ day: 6, weekday: 2, minutes: 23 * 60 + 30 });
    expect(localDay(lateTuesday)).toBe("2026-10-06");
  });
});

describe("opening status", () => {
  it("knows open, opens later and closed", () => {
    expect(openStatus(pantry(weekly), wedNoon)).toEqual({ state: "opens_later", until: "16:00", openToday: true });
    expect(openStatus(pantry(weekly), localToUtc(2026, 10, 7, 17, 0))).toEqual({ state: "open", until: "19:00", openToday: true });
    expect(openStatus(pantry(weekly), localToUtc(2026, 10, 7, 19, 0)).state).toBe("closed_today");
    expect(openStatus(pantry(weekly), localToUtc(2026, 10, 6, 17, 0)).state).toBe("closed_today"); // Tuesday
  });

  it("never guesses when hours are unknown", () => {
    expect(openStatus(pantry({ weekly: [], monthly: [] }), wedNoon)).toEqual({ state: "unknown", until: null, openToday: false });
  });

  it("handles '2nd Saturday' style schedules", () => {
    const second: Hours = { weekly: [], monthly: [{ nth: [2], weekday: 6, open: "10:00", close: "12:00" }] };
    expect(nthOfMonth(10)).toBe(2);
    expect(openStatus(pantry(second), localToUtc(2026, 10, 10, 11, 0)).state).toBe("open"); // 2nd Saturday
    expect(openStatus(pantry(second), localToUtc(2026, 10, 17, 11, 0)).state).toBe("closed_today"); // 3rd Saturday
    const next = upcomingMonthly(second, wedNoon, 14);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ month: 10, day: 10, open: "10:00" });
  });

  it("treats one-off events as open only between start and end", () => {
    const event = {
      hours: { weekly: [], monthly: [] },
      type: "event" as const,
      startsAt: localToUtc(2026, 10, 10, 9, 0).toISOString(),
      endsAt: localToUtc(2026, 10, 10, 12, 0).toISOString(),
    };
    expect(openStatus(event, localToUtc(2026, 10, 10, 10, 0)).state).toBe("open");
    expect(openStatus(event, localToUtc(2026, 10, 10, 8, 0)).state).toBe("opens_later");
    expect(openStatus(event, wedNoon).state).toBe("closed_today");
  });
});

describe("freshness score", () => {
  const now = new Date("2026-10-07T17:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const base = { recentConfirmations: 0, openReports: 0, verifiedOrganizer: false };

  it("is high when just verified and decays with time", () => {
    expect(freshness({ ...base, lastVerifiedAt: ago(0) }, now)).toMatchObject({ score: 100, level: "fresh" });
    expect(freshness({ ...base, lastVerifiedAt: ago(21) }, now)).toMatchObject({ score: 50, level: "check" });
    expect(freshness({ ...base, lastVerifiedAt: ago(60) }, now).level).toBe("stale");
  });

  it("rises with visitor confirmations, capped so it cannot be gamed", () => {
    const plain = freshness({ ...base, lastVerifiedAt: ago(30) }, now).score;
    const confirmed = freshness({ ...base, lastVerifiedAt: ago(30), recentConfirmations: 3 }, now).score;
    const flooded = freshness({ ...base, lastVerifiedAt: ago(30), recentConfirmations: 500 }, now).score;
    expect(confirmed).toBe(plain + 18);
    expect(flooded).toBe(plain + 24);
  });

  it("drops when a resident reports a problem", () => {
    const result = freshness({ ...base, lastVerifiedAt: ago(1), openReports: 2 }, now);
    expect(result.score).toBeLessThan(50);
    expect(result.level).not.toBe("fresh");
  });

  it("counts calendar days, not 24-hour blocks", () => {
    const lastNight = localToUtc(2026, 10, 6, 23, 0);
    const thisMorning = localToUtc(2026, 10, 7, 7, 0);
    expect(calendarDaysBetween(lastNight, thisMorning)).toBe(1);
    expect(calendarDaysBetween(thisMorning, thisMorning)).toBe(0);
  });
});
