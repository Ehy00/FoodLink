// Freshness score: how much should a resident trust that a listing is still right?
//
// A wrong listing wastes a trip for someone with no car, so the score is
// deliberately conservative. It is a transparent formula, not a black box, so
// a reviewer can always explain why a listing was flagged.
//
//   score = time decay since last verification
//         + boost from recent "Yes, I got food" confirmations
//         + small boost when a verified organizer owns the listing
//         - penalty for each open "Report a problem"

import { localNow } from "./hours";
import type { Freshness } from "./types";

export interface FreshnessInput {
  lastVerifiedAt: string;
  /** "Yes, I got food" confirmations in the last 14 days */
  recentConfirmations: number;
  /** Reports a human reviewer has not yet resolved */
  openReports: number;
  verifiedOrganizer: boolean;
}

const HALF_LIFE_DAYS = 21;
const CONFIRMATION_BOOST = 6;
const MAX_CONFIRMATION_BOOST = 24;
const ORGANIZER_BOOST = 5;
const REPORT_PENALTY = 25;

export const FRESH_THRESHOLD = 70;
export const STALE_THRESHOLD = 40;

/** Whole calendar days between two instants in the pilot time zone, so "today" means today. */
export function calendarDaysBetween(earlier: Date, later: Date): number {
  const a = localNow(earlier);
  const b = localNow(later);
  const diff = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.max(0, Math.round(diff / 86_400_000));
}

export function freshness(input: FreshnessInput, at: Date = new Date()): Freshness {
  const verified = new Date(input.lastVerifiedAt).getTime();
  const days = Math.max(0, (at.getTime() - verified) / 86_400_000);
  const decay = 100 * Math.pow(0.5, days / HALF_LIFE_DAYS);
  const boost = Math.min(MAX_CONFIRMATION_BOOST, input.recentConfirmations * CONFIRMATION_BOOST);
  const raw =
    decay +
    boost +
    (input.verifiedOrganizer ? ORGANIZER_BOOST : 0) -
    input.openReports * REPORT_PENALTY;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const level = score >= FRESH_THRESHOLD ? "fresh" : score >= STALE_THRESHOLD ? "check" : "stale";
  return { score, level, daysSinceVerified: calendarDaysBetween(new Date(input.lastVerifiedAt), at) };
}
