// Write side: organizer submissions, human review, and resident feedback.
//
// The rule that shapes this file: nothing an organizer types is ever shown to
// residents until the AI has screened it AND a human reviewer has approved it.

import { redactPII } from "../ai/redact";
import { screenListing } from "../ai/screening";
import { localDay } from "../hours";
import { randomId } from "../security/crypto";
import type { Listing, ListingDraft, ScreeningResult, SessionUser } from "../types";
import { query, queryOne, run, transaction } from "./client";
import { rowToListing } from "./listings";
import { audit } from "./users";

// ---------- Organizer side ----------

export type SubmitOutcome =
  | { ok: true; revisionId: string; screening: ScreeningResult }
  | { ok: false; status: number; error: string };

export async function submitRevision(
  organizer: SessionUser,
  listingId: string | null,
  draft: ListingDraft,
): Promise<SubmitOutcome> {
  if (listingId) {
    const owner = await queryOne<{ organizer_id: string | null }>(
      "SELECT organizer_id FROM listings WHERE id = ? AND status = 'published'",
      [listingId],
    );
    // Same answer whether the listing is missing or belongs to someone else,
    // so one organizer cannot probe for another organizer's listing ids.
    if (!owner || owner.organizer_id !== organizer.id) {
      return { ok: false, status: 404, error: "Listing not found." };
    }
  }
  const pending = await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM revisions WHERE organizer_id = ? AND status = 'pending'",
    [organizer.id],
  );
  if (Number(pending?.n ?? 0) >= 10) {
    return { ok: false, status: 429, error: "You have 10 submissions waiting for review. Please wait for a reviewer." };
  }

  const existing = await query<{ id: string; name: string; address: string; zip: string; lat: number; lng: number }>(
    "SELECT id, name, address, zip, lat, lng FROM listings WHERE status = 'published'",
  );
  const screening = await screenListing(
    draft,
    existing.map((e) => ({ ...e, lat: Number(e.lat), lng: Number(e.lng) })),
    listingId,
  );

  const revisionId = randomId("rev");
  await run(
    `INSERT INTO revisions (id, listing_id, kind, organizer_id, data_json, screening_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      revisionId,
      listingId,
      listingId ? "update" : "new",
      organizer.id,
      JSON.stringify(draft),
      JSON.stringify(screening),
      new Date().toISOString(),
    ],
  );
  await audit(organizer.id, listingId ? "listing.update_submitted" : "listing.new_submitted", revisionId, `AI screening risk: ${screening.risk}`);
  return { ok: true, revisionId, screening };
}

export async function listOrganizerListings(organizerId: string): Promise<Listing[]> {
  const rows = await query<Parameters<typeof rowToListing>[0]>(
    "SELECT * FROM listings WHERE organizer_id = ? AND status = 'published' ORDER BY name",
    [organizerId],
  );
  return rows.map(rowToListing);
}

export async function getOrganizerListing(organizerId: string, listingId: string): Promise<Listing | null> {
  const row = await queryOne<Parameters<typeof rowToListing>[0]>(
    "SELECT * FROM listings WHERE id = ? AND organizer_id = ? AND status = 'published'",
    [listingId, organizerId],
  );
  return row ? rowToListing(row) : null;
}

export interface RevisionView {
  id: string;
  listingId: string | null;
  kind: "new" | "update";
  organizerName: string;
  draft: ListingDraft;
  screening: ScreeningResult;
  status: "pending" | "approved" | "rejected";
  reviewerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface RevisionRow {
  id: string;
  listing_id: string | null;
  kind: "new" | "update";
  org_name: string;
  data_json: string;
  screening_json: string;
  status: RevisionView["status"];
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

function toRevisionView(r: RevisionRow): RevisionView {
  return {
    id: r.id,
    listingId: r.listing_id,
    kind: r.kind,
    organizerName: r.org_name,
    draft: JSON.parse(r.data_json),
    screening: JSON.parse(r.screening_json),
    status: r.status,
    reviewerNote: r.reviewer_note,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  };
}

const REVISION_SELECT = `SELECT r.id, r.listing_id, r.kind, u.org_name, r.data_json, r.screening_json, r.status,
  r.reviewer_note, r.created_at, r.reviewed_at
  FROM revisions r JOIN users u ON u.id = r.organizer_id`;

export async function listOrganizerRevisions(organizerId: string): Promise<RevisionView[]> {
  const rows = await query<RevisionRow>(
    `${REVISION_SELECT} WHERE r.organizer_id = ? AND r.data_json != '{}' ORDER BY r.created_at DESC LIMIT 20`,
    [organizerId],
  );
  return rows.map(toRevisionView);
}

/** "Still accurate": the organizer re-confirms a listing without changing it. */
export async function confirmStillAccurate(organizer: SessionUser, listingId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const changed = await run(
    "UPDATE listings SET last_verified_at = ?, updated_at = ? WHERE id = ? AND organizer_id = ? AND status = 'published'",
    [now, now, listingId, organizer.id],
  );
  if (changed > 0) await audit(organizer.id, "listing.reconfirmed", listingId);
  return changed > 0;
}

// ---------- Reviewer side ----------

export async function listPendingRevisions(): Promise<RevisionView[]> {
  const rows = await query<RevisionRow>(`${REVISION_SELECT} WHERE r.status = 'pending' ORDER BY r.created_at ASC`);
  return rows.map(toRevisionView);
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "listing"}-${randomId("x").slice(2, 8).toLowerCase().replace(/[^a-z0-9]/g, "0")}`;
}

export async function decideRevision(
  reviewer: SessionUser,
  revisionId: string,
  decision: "approve" | "reject",
  note: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const rev = await queryOne<{ id: string; listing_id: string | null; organizer_id: string; data_json: string; status: string }>(
    "SELECT id, listing_id, organizer_id, data_json, status FROM revisions WHERE id = ?",
    [revisionId],
  );
  if (!rev || rev.status !== "pending") return { ok: false, error: "This submission has already been reviewed." };
  const now = new Date().toISOString();

  if (decision === "reject") {
    await run("UPDATE revisions SET status = 'rejected', reviewer_id = ?, reviewer_note = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'", [
      reviewer.id,
      note,
      now,
      revisionId,
    ]);
    await audit(reviewer.id, "revision.rejected", revisionId, note);
    return { ok: true };
  }

  const d = JSON.parse(rev.data_json) as ListingDraft;
  const listingId = rev.listing_id ?? slugify(d.name);
  const shared = [
    d.name, d.type, d.address, d.city, d.zip, d.lat, d.lng, d.phone, d.website,
    JSON.stringify(d.hours), d.hoursNoteEn, d.eligibilityEn, d.idRequired, d.appointmentRequired ? 1 : 0,
    d.wheelchair, JSON.stringify(d.offers), JSON.stringify(d.audiences), d.startsAt, d.endsAt,
  ];

  const listingWrite = rev.listing_id
    ? {
        // Spanish text is cleared on update: the old translation may no longer match.
        sql: `UPDATE listings SET name=?, type=?, address=?, city=?, zip=?, lat=?, lng=?, phone=?, website=?,
              hours_json=?, hours_note_en=?, eligibility_en=?, id_required=?, appointment_required=?,
              wheelchair=?, offers_json=?, audiences_json=?, starts_at=?, ends_at=?,
              hours_note_es=NULL, eligibility_es=?, geo_approx=0, verified_organizer=1,
              last_verified_at=?, under_review=0, updated_at=?
              WHERE id=?`,
        args: [...shared, d.eligibilityEn, now, now, listingId],
      }
    : {
        sql: `INSERT INTO listings (
                name, type, address, city, zip, lat, lng, phone, website,
                hours_json, hours_note_en, eligibility_en, id_required, appointment_required,
                wheelchair, offers_json, audiences_json, starts_at, ends_at,
                id, hours_note_es, eligibility_es, geo_approx, organizer_id, verified_organizer,
                last_verified_at, source_url, under_review, status, created_at, updated_at
              ) VALUES (?,?,?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,NULL,?,0,?,1, ?,NULL,0,'published',?,?)`,
        args: [...shared, listingId, d.eligibilityEn, rev.organizer_id, now, now, now],
      };

  await transaction([
    listingWrite,
    {
      sql: "UPDATE revisions SET status = 'approved', listing_id = ?, reviewer_id = ?, reviewer_note = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'",
      args: [listingId, reviewer.id, note, now, revisionId],
    },
  ]);
  await audit(reviewer.id, "revision.approved", listingId, note);
  return { ok: true };
}

// ---------- Resident feedback ----------

export async function listingExists(id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    "SELECT id FROM listings WHERE id = ? AND status = 'published' AND (ends_at IS NULL OR ends_at > ?)",
    [id, new Date().toISOString()],
  );
  return !!row;
}

/** "Yes, I got food": stores the listing and today's date. Nothing about the person. */
export async function addConfirmation(listingId: string): Promise<void> {
  await run("INSERT INTO confirmations (listing_id, created_day) VALUES (?, ?)", [listingId, localDay()]);
}

/** Reasons serious enough that one report puts a caution on the listing straight away. */
const URGENT_REASONS = new Set(["asked_for_money"]);

export async function addReport(listingId: string, reason: string, note: string | undefined): Promise<void> {
  // Residents sometimes type a phone number or name into the note. Strip it before storing.
  const cleanNote = note ? redactPII(note, 300) : null;
  await run("INSERT INTO reports (id, listing_id, reason, note, status, created_day) VALUES (?, ?, ?, ?, 'open', ?)", [
    randomId("rep"),
    listingId,
    reason,
    cleanNote,
    localDay(),
  ]);
  const open = await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM reports WHERE listing_id = ? AND status = 'open'", [listingId]);
  if (URGENT_REASONS.has(reason) || Number(open?.n ?? 0) >= 2) {
    await run("UPDATE listings SET under_review = 1, updated_at = ? WHERE id = ?", [new Date().toISOString(), listingId]);
  }
}

export interface ReportView {
  id: string;
  listingId: string;
  listingName: string;
  reason: string;
  note: string | null;
  createdDay: string;
}

export async function listOpenReports(): Promise<ReportView[]> {
  const rows = await query<{ id: string; listing_id: string; name: string; reason: string; note: string | null; created_day: string }>(
    `SELECT r.id, r.listing_id, l.name, r.reason, r.note, r.created_day
     FROM reports r JOIN listings l ON l.id = r.listing_id
     WHERE r.status = 'open' ORDER BY r.created_day ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    listingId: r.listing_id,
    listingName: r.name,
    reason: r.reason,
    note: r.note,
    createdDay: r.created_day,
  }));
}

export async function decideReport(
  reviewer: SessionUser,
  reportId: string,
  decision: "resolve" | "dismiss" | "unpublish",
): Promise<boolean> {
  const report = await queryOne<{ listing_id: string; status: string }>("SELECT listing_id, status FROM reports WHERE id = ?", [reportId]);
  if (!report || report.status !== "open") return false;
  const now = new Date().toISOString();

  await run("UPDATE reports SET status = ?, resolved_at = ?, reviewer_id = ? WHERE id = ?", [
    decision === "dismiss" ? "dismissed" : "resolved",
    now,
    reviewer.id,
    reportId,
  ]);

  if (decision === "unpublish") {
    await run("UPDATE listings SET status = 'archived', updated_at = ? WHERE id = ?", [now, report.listing_id]);
  } else {
    const stillOpen = await queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM reports WHERE listing_id = ? AND status = 'open'",
      [report.listing_id],
    );
    if (Number(stillOpen?.n ?? 0) === 0) {
      // "resolve" means the reviewer checked the listing and it is right (or was fixed),
      // so it also counts as a fresh verification.
      await run(
        decision === "resolve"
          ? "UPDATE listings SET under_review = 0, last_verified_at = ?, updated_at = ? WHERE id = ?"
          : "UPDATE listings SET under_review = 0, updated_at = ? WHERE id = ?",
        decision === "resolve" ? [now, now, report.listing_id] : [now, report.listing_id],
      );
    }
  }
  await audit(reviewer.id, `report.${decision}`, report.listing_id);
  return true;
}
