// Integration tests against a real (temporary) SQLite database: seeding,
// search, and the full organizer -> AI screening -> human review pipeline.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query, queryOne, run, useDatabaseForTests } from "@/lib/db/client";
import { getAlerts, getListingView, getPublishedListings, getUpcomingEvents, searchListings } from "@/lib/db/listings";
import {
  addConfirmation,
  addReport,
  confirmStillAccurate,
  decideReport,
  decideRevision,
  listOpenReports,
  listPendingRevisions,
  submitRevision,
} from "@/lib/db/moderation";
import { createApplicant, findUserByEmail, isLocked, MAX_FAILED_LOGINS, recordFailedLogin } from "@/lib/db/users";
import { zipToPoint } from "@/lib/geo";
import type { ListingDraft, SearchTags, SessionUser } from "@/lib/types";

const dir = mkdtempSync(path.join(tmpdir(), "foodlink-test-"));
const tags = (t: Partial<SearchTags> = {}): SearchTags => ({ needs: [], audiences: [], noId: false, wheelchair: false, when: "any", zip: null, ...t });

const organizer: SessionUser = { id: "user_test_org", role: "organizer", orgName: "Test Org", email: "org@example.org" };
const reviewer: SessionUser = { id: "user_test_rev", role: "reviewer", orgName: "Reviewers", email: "rev@example.org" };

const draft: ListingDraft = {
  name: "Lakewood Neighbors Pantry",
  type: "pantry",
  address: "77 Lakewood Dr NW",
  city: "Huntsville",
  zip: "35810",
  lat: 34.78,
  lng: -86.6,
  phone: "256-555-0123",
  website: null,
  hours: { weekly: [{ days: [0, 1, 2, 3, 4, 5, 6], open: "00:00", close: "23:59" }], monthly: [] },
  hoursNoteEn: null,
  eligibilityEn: "Anyone can come. No ID needed.",
  idRequired: "no",
  appointmentRequired: false,
  wheelchair: "yes",
  offers: ["groceries"],
  audiences: ["anyone"],
  startsAt: null,
  endsAt: null,
};

beforeAll(async () => {
  await useDatabaseForTests(`file:${path.join(dir, "test.db")}`);
  for (const u of [organizer, reviewer]) {
    await run(
      `INSERT INTO users (id, role, org_name, email_enc, email_index, password_hash, status, created_at)
       VALUES (?, ?, ?, 'x', ?, 'x', 'approved', ?)`,
      [u.id, u.role, u.orgName, u.id, new Date().toISOString()],
    );
  }
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("seed data", () => {
  it("loads the pilot listings with complete, in-area records", async () => {
    const listings = await getPublishedListings();
    expect(listings.length).toBeGreaterThanOrEqual(25);
    for (const l of listings) {
      expect(l.zip).toMatch(/^35\d{3}$/);
      expect(l.lat).toBeGreaterThan(34.4);
      expect(l.lat).toBeLessThan(35.1);
      expect(l.offers.length).toBeGreaterThan(0);
      expect(l.eligibilityEs.length).toBeGreaterThan(0);
    }
  });

  it("stores nothing about residents: no table could hold a search or a location", async () => {
    const tables = (await query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name);
    expect(tables.sort()).toEqual(["audit_log", "confirmations", "listings", "reports", "revisions", "sessions", "sqlite_sequence", "users"].sort());
    const columns = (await query<{ name: string }>("SELECT name FROM pragma_table_info('confirmations')")).map((c) => c.name);
    expect(columns).toEqual(["id", "listing_id", "created_day"]);
  });
});

describe("search API logic", () => {
  it("sorts closest first from a ZIP code", async () => {
    const { matches } = await searchListings(tags({ needs: ["groceries"] }), zipToPoint("35801"));
    const miles = matches.map((m) => m.distanceMiles ?? 0);
    expect(matches.length).toBeGreaterThan(5);
    // Ranking is by distance, with a half-mile band where audience fit may reorder.
    for (let i = 1; i < miles.length; i++) expect(miles[i]).toBeGreaterThanOrEqual(miles[i - 1] - 0.5);
  });

  it("keeps 'No ID' honest: confirmed places first, unconfirmed separately, ID-required never", async () => {
    const { matches, unconfirmed } = await searchListings(tags({ noId: true }), zipToPoint("35801"));
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.idRequired === "no")).toBe(true);
    expect(unconfirmed.every((m) => m.idRequired === "unknown")).toBe(true);
    expect([...matches, ...unconfirmed].some((m) => m.id === "life-church-huntsville")).toBe(false);
  });

  it("only suggests the campus pantry to students", async () => {
    const everyone = await searchListings(tags(), null);
    const students = await searchListings(tags({ audiences: ["students"] }), null);
    const has = (r: typeof everyone) => [...r.matches, ...r.unconfirmed].some((m) => m.id === "bulldog-market-aamu");
    expect(has(everyone)).toBe(false);
    expect(has(students)).toBe(true);
  });

  it("treats a hostile listing id as plain data", async () => {
    expect(await getListingView("x' OR '1'='1")).toBeNull();
    expect(await getListingView("manna-house'; DROP TABLE listings;--")).toBeNull();
    expect((await getPublishedListings()).length).toBeGreaterThan(0);
  });

  it("builds events from recurring schedules and hides events that have ended", async () => {
    const events = await getUpcomingEvents(null, 35);
    expect(events.some((e) => e.recurring)).toBe(true);
    expect(events.some((e) => e.listingId === "sample-mobile-pantry")).toBe(true);
    const afterItEnds = new Date(Date.now() + 9 * 86_400_000);
    expect(await getListingView("sample-mobile-pantry", null, afterItEnds)).toBeNull();
  });
});

describe("organizer -> AI screening -> human review", () => {
  let revisionId = "";

  it("a submission is screened and held: residents cannot see it", async () => {
    const outcome = await submitRevision(organizer, null, draft);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    revisionId = outcome.revisionId;
    expect(outcome.screening.decision).toBe("needs_human_review");
    expect((await listPendingRevisions()).some((r) => r.id === revisionId)).toBe(true);
    const { matches } = await searchListings(tags(), null);
    expect(matches.some((m) => m.name === draft.name)).toBe(false);
  });

  it("an organizer cannot edit a listing they do not own", async () => {
    const outcome = await submitRevision(organizer, "manna-house", { ...draft, name: "Hijacked" });
    expect(outcome).toMatchObject({ ok: false, status: 404 });
    expect(await confirmStillAccurate(organizer, "manna-house")).toBe(false);
  });

  it("after a reviewer approves, it is published as a verified-organizer listing", async () => {
    expect((await decideRevision(reviewer, revisionId, "approve", null)).ok).toBe(true);
    const { matches } = await searchListings(tags({ noId: true, wheelchair: true }), zipToPoint("35810"));
    const published = matches.find((m) => m.name === draft.name);
    expect(published).toBeDefined();
    expect(published?.verifiedOrganizer).toBe(true);
    expect(published?.freshness.level).toBe("fresh");
    // deciding twice is refused
    expect((await decideRevision(reviewer, revisionId, "reject", null)).ok).toBe(false);
    // and it shows up as a "new listing" alert nearby
    expect((await getAlerts(zipToPoint("35810"))).some((a) => a.kind === "new" && a.name === draft.name)).toBe(true);
  });

  it("a rejected submission never appears", async () => {
    const outcome = await submitRevision(organizer, null, { ...draft, name: "Should Not Appear Pantry", address: "9 Other Rd" });
    if (!outcome.ok) throw new Error("submit failed");
    await decideRevision(reviewer, outcome.revisionId, "reject", "Could not verify.");
    expect((await getPublishedListings()).some((l) => l.name === "Should Not Appear Pantry")).toBe(false);
  });

  it("flags a duplicate of an existing listing for the reviewer", async () => {
    const outcome = await submitRevision(organizer, null, { ...draft, name: "Manna House", address: "2110 Memorial Pkwy SW", zip: "35801", lat: 34.714, lng: -86.5869 });
    if (!outcome.ok) throw new Error("submit failed");
    expect(outcome.screening.flags.some((f) => f.code === "duplicate")).toBe(true);
  });
});

describe("resident feedback", () => {
  it("confirmations raise freshness and record no identity", async () => {
    await run("UPDATE listings SET last_verified_at = ? WHERE id = 'faith-chapel'", [new Date(Date.now() - 30 * 86_400_000).toISOString()]);
    const before = (await getListingView("faith-chapel"))!.freshness.score;
    await addConfirmation("faith-chapel");
    await addConfirmation("faith-chapel");
    const after = await getListingView("faith-chapel");
    expect(after!.freshness.score).toBe(before + 12);
    expect(after!.confirmations7d).toBe(2);
  });

  it("reports lower freshness, strip personal details, and go to a human", async () => {
    const before = (await getListingView("aldersgate-umc"))!.freshness.score;
    await addReport("aldersgate-umc", "closed", "Locked at noon. Text me 256-555-0147");
    const view = await getListingView("aldersgate-umc");
    expect(view!.freshness.score).toBe(before - 25);
    expect(view!.underReview).toBe(false); // one ordinary report is not enough to flag a listing
    const stored = (await listOpenReports()).find((r) => r.listingId === "aldersgate-umc");
    expect(stored?.note).toBe("Locked at noon. Text me [phone]");

    await addReport("aldersgate-umc", "asked_for_money", undefined);
    expect((await getListingView("aldersgate-umc"))!.underReview).toBe(true); // a safety report flags it at once
  });

  it("a reviewer resolving reports clears the flag and re-verifies the listing", async () => {
    for (const r of (await listOpenReports()).filter((x) => x.listingId === "aldersgate-umc")) {
      expect(await decideReport(reviewer, r.id, "resolve")).toBe(true);
    }
    const view = await getListingView("aldersgate-umc");
    expect(view!.underReview).toBe(false);
    expect(view!.freshness.daysSinceVerified).toBe(0);
  });

  it("a reviewer can take a listing down", async () => {
    await addReport("house-of-the-harvest", "closed", undefined);
    const report = (await listOpenReports()).find((r) => r.listingId === "house-of-the-harvest")!;
    await decideReport(reviewer, report.id, "unpublish");
    expect(await getListingView("house-of-the-harvest")).toBeNull();
  });
});

describe("accounts", () => {
  it("stores applicants encrypted and pending", async () => {
    expect(await createApplicant({ orgName: "Hope Pantry", email: "Hope@Example.org", phone: "256-555-0155", password: "maple-river-otter-42" })).toBe("created");
    expect(await createApplicant({ orgName: "Hope Pantry", email: "hope@example.org", phone: "256-555-0155", password: "maple-river-otter-42" })).toBe("exists");
    const row = await queryOne<Record<string, string>>("SELECT * FROM users WHERE org_name = 'Hope Pantry'");
    expect(row!.status).toBe("pending");
    const raw = JSON.stringify(row);
    expect(raw).not.toMatch(/hope@example\.org/i);
    expect(raw).not.toContain("256-555-0155");
    expect(raw).not.toContain("maple-river-otter-42");
    expect(await findUserByEmail("HOPE@example.org")).not.toBeNull();
  });

  it("locks an account after repeated failed sign-ins", async () => {
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      const user = (await findUserByEmail("hope@example.org"))!;
      expect(isLocked(user)).toBe(false);
      await recordFailedLogin(user);
    }
    expect(isLocked((await findUserByEmail("hope@example.org"))!)).toBe(true);
  });
});
