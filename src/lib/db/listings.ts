// Read side of the listings database: everything residents see comes through here.

import { freshness } from "../freshness";
import { haversineMiles, type Point } from "../geo";
import { localDay, localNow, localToUtc, openStatus, upcomingMonthly } from "../hours";
import type { Listing, ListingView, SearchTags } from "../types";
import { query, queryOne } from "./client";

interface ListingRow {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  geo_approx: number;
  phone: string | null;
  website: string | null;
  hours_json: string;
  hours_note_en: string | null;
  hours_note_es: string | null;
  eligibility_en: string;
  eligibility_es: string;
  id_required: string;
  appointment_required: number;
  wheelchair: string;
  offers_json: string;
  audiences_json: string;
  starts_at: string | null;
  ends_at: string | null;
  organizer_id: string | null;
  verified_organizer: number;
  last_verified_at: string;
  source_url: string | null;
  under_review: number;
  created_at: string;
  updated_at: string;
}

export function rowToListing(r: ListingRow): Listing {
  return {
    id: r.id,
    name: r.name,
    type: r.type as Listing["type"],
    address: r.address,
    city: r.city,
    zip: r.zip,
    lat: Number(r.lat),
    lng: Number(r.lng),
    geoApprox: !!r.geo_approx,
    phone: r.phone,
    website: r.website,
    hours: JSON.parse(r.hours_json),
    hoursNoteEn: r.hours_note_en,
    hoursNoteEs: r.hours_note_es,
    eligibilityEn: r.eligibility_en,
    eligibilityEs: r.eligibility_es,
    idRequired: r.id_required as Listing["idRequired"],
    appointmentRequired: !!r.appointment_required,
    wheelchair: r.wheelchair as Listing["wheelchair"],
    offers: JSON.parse(r.offers_json),
    audiences: JSON.parse(r.audiences_json),
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    organizerId: r.organizer_id,
    verifiedOrganizer: !!r.verified_organizer,
    lastVerifiedAt: r.last_verified_at,
    sourceUrl: r.source_url,
    underReview: !!r.under_review,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function daysAgo(now: Date, days: number): string {
  return localDay(new Date(now.getTime() - days * 86_400_000));
}

interface Signals {
  confirmations14d: Map<string, number>;
  confirmations7d: Map<string, number>;
  openReports: Map<string, number>;
}

async function loadSignals(now: Date): Promise<Signals> {
  const [c14, c7, reports] = await Promise.all([
    query<{ listing_id: string; n: number }>(
      "SELECT listing_id, COUNT(*) AS n FROM confirmations WHERE created_day >= ? GROUP BY listing_id",
      [daysAgo(now, 14)],
    ),
    query<{ listing_id: string; n: number }>(
      "SELECT listing_id, COUNT(*) AS n FROM confirmations WHERE created_day >= ? GROUP BY listing_id",
      [daysAgo(now, 7)],
    ),
    query<{ listing_id: string; n: number }>(
      "SELECT listing_id, COUNT(*) AS n FROM reports WHERE status = 'open' GROUP BY listing_id",
    ),
  ]);
  const toMap = (rows: Array<{ listing_id: string; n: number }>) =>
    new Map(rows.map((r) => [r.listing_id, Number(r.n)]));
  return { confirmations14d: toMap(c14), confirmations7d: toMap(c7), openReports: toMap(reports) };
}

function toView(listing: Listing, signals: Signals, origin: Point | null, now: Date): ListingView {
  return {
    ...listing,
    distanceMiles: origin ? haversineMiles(origin, listing) : null,
    open: openStatus(listing, now),
    freshness: freshness(
      {
        lastVerifiedAt: listing.lastVerifiedAt,
        recentConfirmations: signals.confirmations14d.get(listing.id) ?? 0,
        openReports: signals.openReports.get(listing.id) ?? 0,
        verifiedOrganizer: listing.verifiedOrganizer,
      },
      now,
    ),
    confirmations7d: signals.confirmations7d.get(listing.id) ?? 0,
  };
}

/** Published listings. One-off events disappear automatically once they end. */
export async function getPublishedListings(now: Date = new Date()): Promise<Listing[]> {
  const rows = await query<ListingRow>(
    "SELECT * FROM listings WHERE status = 'published' AND (ends_at IS NULL OR ends_at > ?)",
    [now.toISOString()],
  );
  return rows.map(rowToListing);
}

export async function getListingViews(origin: Point | null, now: Date = new Date()): Promise<ListingView[]> {
  const [listings, signals] = await Promise.all([getPublishedListings(now), loadSignals(now)]);
  return listings.map((l) => toView(l, signals, origin, now));
}

export async function getListingView(id: string, origin: Point | null = null, now: Date = new Date()): Promise<ListingView | null> {
  const row = await queryOne<ListingRow>(
    "SELECT * FROM listings WHERE id = ? AND status = 'published' AND (ends_at IS NULL OR ends_at > ?)",
    [id, now.toISOString()],
  );
  if (!row) return null;
  return toView(rowToListing(row), await loadSignals(now), origin, now);
}

export interface SearchResult {
  /** Listings that meet every filter. */
  matches: ListingView[];
  /**
   * Listings that would match except that a policy (ID, wheelchair access) has
   * not been confirmed. Shown separately so nobody is sent somewhere on a guess.
   */
  unconfirmed: ListingView[];
}

function matchesNeeds(l: ListingView, tags: SearchTags): boolean {
  return tags.needs.length === 0 || tags.needs.some((n) => l.offers.includes(n));
}

function matchesWhen(l: ListingView, tags: SearchTags): boolean {
  if (tags.when === "now") return l.open.state === "open";
  if (tags.when === "today") return l.open.openToday;
  return true;
}

/** Soft preference: places that say they serve the people asked about rank a little higher. */
function audienceBoost(l: ListingView, tags: SearchTags): number {
  return tags.audiences.some((a) => l.audiences.includes(a)) ? 1 : 0;
}

export function filterAndRank(all: ListingView[], tags: SearchTags): SearchResult {
  const matches: ListingView[] = [];
  const unconfirmed: ListingView[] = [];

  for (const l of all) {
    if (!matchesNeeds(l, tags) || !matchesWhen(l, tags)) continue;

    // A student-only pantry should not be suggested to someone who did not say they are a student.
    const studentOnly = l.audiences.length === 1 && l.audiences[0] === "students";
    if (studentOnly && !tags.audiences.includes("students")) continue;

    let confirmed = true;
    let excluded = false;
    if (tags.noId) {
      if (l.idRequired === "yes") excluded = true;
      else if (l.idRequired === "unknown") confirmed = false;
    }
    if (tags.wheelchair) {
      if (l.wheelchair === "no") excluded = true;
      else if (l.wheelchair === "unknown") confirmed = false;
    }
    if (excluded) continue;
    (confirmed ? matches : unconfirmed).push(l);
  }

  const byRank = (a: ListingView, b: ListingView) => {
    // Distance comes first: many residents have no car. Audience fit breaks near-ties.
    const da = a.distanceMiles ?? Number.POSITIVE_INFINITY;
    const db = b.distanceMiles ?? Number.POSITIVE_INFINITY;
    if (Math.abs(da - db) > 0.5) return da - db;
    const boost = audienceBoost(b, tags) - audienceBoost(a, tags);
    if (boost !== 0) return boost;
    if (da !== db) return da - db;
    return b.freshness.score - a.freshness.score;
  };
  matches.sort(byRank);
  unconfirmed.sort(byRank);
  return { matches, unconfirmed };
}

export async function searchListings(tags: SearchTags, origin: Point | null, now: Date = new Date()): Promise<SearchResult> {
  return filterAndRank(await getListingViews(origin, now), tags);
}

export interface EventView {
  key: string;
  listingId: string;
  title: string;
  place: string;
  startsAt: string;
  endsAt: string;
  distanceMiles: number | null;
  verifiedOrganizer: boolean;
  recurring: boolean;
}

/** One-off events plus the next dates of "2nd Saturday"-style distributions. */
export async function getUpcomingEvents(origin: Point | null, daysAhead = 14, now: Date = new Date()): Promise<EventView[]> {
  const listings = await getPublishedListings(now);
  const horizon = now.getTime() + daysAhead * 86_400_000;
  const events: EventView[] = [];

  for (const l of listings) {
    const distanceMiles = origin ? haversineMiles(origin, l) : null;
    const place = `${l.address}, ${l.city}`;
    if (l.type === "event" && l.startsAt && l.endsAt) {
      if (new Date(l.startsAt).getTime() <= horizon) {
        events.push({
          key: l.id,
          listingId: l.id,
          title: l.name,
          place,
          startsAt: l.startsAt,
          endsAt: l.endsAt,
          distanceMiles,
          verifiedOrganizer: l.verifiedOrganizer,
          recurring: false,
        });
      }
      continue;
    }
    for (const o of upcomingMonthly(l.hours, now, daysAhead)) {
      const [oh, om] = o.open.split(":").map(Number);
      const [ch, cm] = o.close.split(":").map(Number);
      events.push({
        key: `${l.id}:${o.year}-${o.month}-${o.day}`,
        listingId: l.id,
        title: l.name,
        place,
        startsAt: localToUtc(o.year, o.month, o.day, oh, om).toISOString(),
        endsAt: localToUtc(o.year, o.month, o.day, ch, cm).toISOString(),
        distanceMiles,
        verifiedOrganizer: l.verifiedOrganizer,
        recurring: true,
      });
    }
  }
  return events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export interface AlertItem {
  kind: "new" | "updated" | "under_review" | "event_today";
  listingId: string;
  name: string;
  distanceMiles: number | null;
  at: string;
}

/**
 * The Alerts tab. Computed fresh for whatever area the device asks about:
 * FoodLink keeps no subscriber list, so there is nothing to leak.
 */
export async function getAlerts(origin: Point | null, radiusMiles = 10, now: Date = new Date()): Promise<AlertItem[]> {
  const [listings, events, recent] = await Promise.all([
    getPublishedListings(now),
    getUpcomingEvents(origin, 1, now),
    query<{ listing_id: string; kind: string; reviewed_at: string }>(
      `SELECT listing_id, kind, reviewed_at FROM revisions
       WHERE status = 'approved' AND listing_id IS NOT NULL AND reviewed_at >= ?
       ORDER BY reviewed_at DESC`,
      [new Date(now.getTime() - 7 * 86_400_000).toISOString()],
    ),
  ]);
  const byId = new Map(listings.map((l) => [l.id, l]));
  const inRange = (l: Listing): number | null | false => {
    const d = origin ? haversineMiles(origin, l) : null;
    return d !== null && d > radiusMiles ? false : d;
  };
  const out: AlertItem[] = [];
  const today = localNow(now);

  for (const e of events) {
    const l = byId.get(e.listingId);
    if (!l) continue;
    const s = localNow(new Date(e.startsAt));
    const d = inRange(l);
    if (d === false) continue;
    if (s.year === today.year && s.month === today.month && s.day === today.day) {
      out.push({ kind: "event_today", listingId: l.id, name: l.name, distanceMiles: d, at: e.startsAt });
    }
  }
  for (const l of listings) {
    const d = inRange(l);
    if (d === false || !l.underReview) continue;
    out.push({ kind: "under_review", listingId: l.id, name: l.name, distanceMiles: d, at: l.updatedAt });
  }
  const seen = new Set<string>();
  for (const r of recent) {
    const l = byId.get(r.listing_id);
    if (!l || seen.has(l.id)) continue;
    const d = inRange(l);
    if (d === false) continue;
    seen.add(l.id);
    out.push({
      kind: r.kind === "new" ? "new" : "updated",
      listingId: l.id,
      name: l.name,
      distanceMiles: d,
      at: r.reviewed_at,
    });
  }
  return out;
}
