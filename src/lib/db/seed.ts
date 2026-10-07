// Loads the pilot dataset and demo accounts into an empty database.
// Runs automatically the first time the app starts; never overwrites data.

import type { Client } from "@libsql/client";
import { SEED_LISTINGS, SOURCES } from "@/data/seed-listings";
import { screenWithRules } from "../ai/screening";
import { localDay, localNow, localToUtc } from "../hours";
import { blindIndex, encrypt, hashPassword, randomId } from "../security/crypto";
import type { ListingDraft } from "../types";

const DAY_MS = 86_400_000;

interface DemoAccount {
  id: string;
  role: "organizer" | "reviewer";
  orgName: string;
  email?: string;
  password?: string;
  totpSecret?: string;
}

function demoAccounts(): DemoAccount[] {
  const env = process.env;
  return [
    {
      id: "user_demo_organizer",
      role: "organizer",
      orgName: "Demo Organizer (FoodLink team)",
      email: env.DEMO_ORGANIZER_EMAIL,
      password: env.DEMO_ORGANIZER_PASSWORD,
      totpSecret: env.DEMO_ORGANIZER_TOTP_SECRET,
    },
    {
      id: "user_demo_reviewer",
      role: "reviewer",
      orgName: "FoodLink Review Team",
      email: env.DEMO_REVIEWER_EMAIL,
      password: env.DEMO_REVIEWER_PASSWORD,
      totpSecret: env.DEMO_REVIEWER_TOTP_SECRET,
    },
    {
      // Approved but has not set up two-factor yet: used to demo enrollment.
      id: "user_demo_new_organizer",
      role: "organizer",
      orgName: "New Hope Community Kitchen (demo)",
      email: env.DEMO_NEW_ORGANIZER_EMAIL,
      password: env.DEMO_NEW_ORGANIZER_PASSWORD,
    },
  ];
}

async function seedUsers(c: Client, now: Date): Promise<boolean> {
  let organizerSeeded = false;
  for (const account of demoAccounts()) {
    if (!account.email || !account.password) continue;
    await c.execute({
      sql: `INSERT OR IGNORE INTO users
        (id, role, org_name, email_enc, email_index, password_hash, totp_secret_enc, totp_enabled, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)`,
      args: [
        account.id,
        account.role,
        account.orgName,
        encrypt(account.email),
        blindIndex(account.email),
        await hashPassword(account.password),
        account.totpSecret ? encrypt(account.totpSecret) : null,
        account.totpSecret ? 1 : 0,
        now.toISOString(),
      ],
    });
    if (account.id === "user_demo_organizer") organizerSeeded = true;
  }

  // A pending organizer application for the reviewer to approve in the demo.
  // The password is random and discarded: the account cannot be used until a
  // reviewer approves it, and then only after a password reset.
  await c.execute({
    sql: `INSERT OR IGNORE INTO users
      (id, role, org_name, email_enc, email_index, phone_enc, password_hash, status, created_at)
      VALUES ('user_demo_applicant', 'organizer', ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [
      "Eastside Neighbors Pantry (demo applicant)",
      encrypt("applicant@foodlink.test"),
      blindIndex("applicant@foodlink.test"),
      encrypt("256-555-0142"),
      await hashPassword(randomId("pw")),
      now.toISOString(),
    ],
  });

  // The author of the suspicious sample submission below. Nobody can sign in
  // as this account: its password is random and thrown away.
  await c.execute({
    sql: `INSERT OR IGNORE INTO users
      (id, role, org_name, email_enc, email_index, password_hash, status, created_at)
      VALUES ('user_demo_suspicious', 'organizer', ?, ?, ?, ?, 'approved', ?)`,
    args: [
      "Quick Food Help (demo, suspicious)",
      encrypt("quickfood@foodlink.test"),
      blindIndex("quickfood@foodlink.test"),
      await hashPassword(randomId("pw")),
      now.toISOString(),
    ],
  });
  return organizerSeeded;
}

/** The coming Saturday (or today if it is Saturday morning), 9 AM to noon local time. */
function nextSaturdayWindow(now: Date): { startsAt: string; endsAt: string } {
  const local = localNow(now);
  let daysAhead = (6 - local.weekday + 7) % 7;
  if (daysAhead === 0 && local.minutes >= 12 * 60) daysAhead = 7;
  const base = new Date(Date.UTC(local.year, local.month - 1, local.day + daysAhead, 12));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const d = base.getUTCDate();
  return {
    startsAt: localToUtc(y, m, d, 9, 0).toISOString(),
    endsAt: localToUtc(y, m, d, 12, 0).toISOString(),
  };
}

export async function seedDatabase(c: Client, now: Date = new Date()): Promise<void> {
  const existing = await c.execute("SELECT COUNT(*) AS n FROM listings");
  if (Number(existing.rows[0].n) > 0) return;

  const staffDemoEnabled = !!process.env.FOODLINK_DATA_KEY;
  const organizerSeeded = staffDemoEnabled ? await seedUsers(c, now) : false;
  const nowIso = now.toISOString();

  for (const s of SEED_LISTINGS) {
    const owned = organizerSeeded && s.demoOrganizer === true;
    await c.execute({
      sql: `INSERT INTO listings (
          id, name, type, address, city, zip, lat, lng, geo_approx, phone, website,
          hours_json, hours_note_en, hours_note_es, eligibility_en, eligibility_es,
          id_required, appointment_required, wheelchair, offers_json, audiences_json,
          starts_at, ends_at, organizer_id, verified_organizer, last_verified_at,
          source_url, under_review, status, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?)`,
      args: [
        s.id, s.name, s.type, s.address, s.city, s.zip, s.lat, s.lng, s.geoApprox ? 1 : 0, s.phone, null,
        JSON.stringify(s.hours), s.hoursNoteEn ?? null, s.hoursNoteEs ?? null, s.eligibilityEn, s.eligibilityEs,
        s.idRequired, s.appointmentRequired ? 1 : 0, "unknown", JSON.stringify(s.offers), JSON.stringify(s.audiences),
        null, null, owned ? "user_demo_organizer" : null, owned ? 1 : 0,
        new Date(now.getTime() - s.verifiedDaysAgo * DAY_MS).toISOString(),
        SOURCES[s.source], 0, "published", nowIso, nowIso,
      ],
    });
  }

  // One clearly labelled sample event so the Events tab and auto-expiry can be shown.
  const sat = nextSaturdayWindow(now);
  await c.execute({
    sql: `INSERT INTO listings (
        id, name, type, address, city, zip, lat, lng, geo_approx, phone, website,
        hours_json, hours_note_en, hours_note_es, eligibility_en, eligibility_es,
        id_required, appointment_required, wheelchair, offers_json, audiences_json,
        starts_at, ends_at, organizer_id, verified_organizer, last_verified_at,
        source_url, under_review, status, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?)`,
    args: [
      "sample-mobile-pantry", "Mobile Food Pantry (sample event)", "event", "200 Church St SW", "Huntsville", "35801",
      34.7285, -86.5895, 1, null, null,
      JSON.stringify({ weekly: [], monthly: [] }),
      "Sample event for the class demo. Not a real distribution.",
      "Evento de muestra para la demostración. No es una distribución real.",
      "Drive-through or walk-up. Anyone can come. No ID needed.",
      "En auto o a pie. Cualquier persona puede venir. No se necesita identificación.",
      "no", 0, "unknown", JSON.stringify(["groceries", "produce"]), JSON.stringify(["anyone", "families"]),
      sat.startsAt, sat.endsAt, organizerSeeded ? "user_demo_organizer" : null, organizerSeeded ? 1 : 0, nowIso,
      null, 0, "published", nowIso, nowIso,
    ],
  });

  // Demo "Yes, I got food" confirmations (listing id and day only).
  const today = localDay(now);
  const yesterday = localDay(new Date(now.getTime() - DAY_MS));
  const confirmations: Array<[string, string]> = [
    ["manna-house", today], ["manna-house", today], ["manna-house", yesterday],
    ["salvation-army-soup-kitchen", today], ["salvation-army-soup-kitchen", yesterday],
    ["freedom-house-church", yesterday],
  ];
  for (const [listingId, day] of confirmations) {
    await c.execute({ sql: "INSERT INTO confirmations (listing_id, created_day) VALUES (?, ?)", args: [listingId, day] });
  }

  // One open report so the reviewer queue is not empty. The listing is marked
  // "being re-checked" so residents see a warning until a reviewer resolves it.
  await c.execute({ sql: "UPDATE listings SET under_review = 1 WHERE id = ?", args: ["st-luke-christian-church"] });
  await c.execute({
    sql: "INSERT INTO reports (id, listing_id, reason, note, status, created_day) VALUES (?, ?, ?, ?, 'open', ?)",
    args: [randomId("rep"), "st-luke-christian-church", "closed", "Went on Tuesday and the doors were locked. (demo report)", yesterday],
  });

  // A recently approved update, so the Alerts tab has something to show.
  if (organizerSeeded) {
    await c.execute({
      sql: `INSERT INTO revisions (id, listing_id, kind, organizer_id, data_json, screening_json, status, reviewer_id, reviewer_note, created_at, reviewed_at)
            VALUES ('rev_demo_update', 'fbna-market', 'update', 'user_demo_organizer', '{}', '{}', 'approved', NULL, 'Demo: hours confirmed by phone.', ?, ?)`,
      args: [new Date(now.getTime() - 3 * DAY_MS).toISOString(), new Date(now.getTime() - 2 * DAY_MS).toISOString()],
    });
  }

  // One suspicious submission waiting for review, to demonstrate AI screening.
  // It depends on seeded staff accounts, so skip it when the resident-only app
  // is running without staff demo secrets.
  if (staffDemoEnabled) {
    const scam: ListingDraft = {
      name: "Free Grocery Giveaway Huntsville",
      type: "pantry",
      address: "P.O. Box 4471",
      city: "Huntsville",
      zip: "30301",
      lat: 34.7304,
      lng: -86.5861,
      phone: "900-555-0199",
      website: "http://bit.ly/free-food-hsv",
      hours: { weekly: [], monthly: [] },
      hoursNoteEn: "Act now, limited time!",
      eligibilityEn:
        "Guaranteed groceries for every family. A $25 processing fee is required by Cash App before pickup. Bring your Social Security number.",
      idRequired: "yes",
      appointmentRequired: false,
      wheelchair: "unknown",
      offers: ["groceries"],
      audiences: ["anyone"],
      startsAt: null,
      endsAt: null,
    };
    const existingForScreening = SEED_LISTINGS.map((s) => ({
      id: s.id, name: s.name, address: s.address, zip: s.zip, lat: s.lat, lng: s.lng,
    }));
    await c.execute({
      sql: `INSERT INTO revisions (id, listing_id, kind, organizer_id, data_json, screening_json, status, created_at)
            VALUES (?, NULL, 'new', 'user_demo_suspicious', ?, ?, 'pending', ?)`,
      args: [
        "rev_demo_scam",
        JSON.stringify(scam),
        JSON.stringify(screenWithRules(scam, existingForScreening)),
        nowIso,
      ],
    });
  }
}
