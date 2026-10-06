// Database schema. Note what is NOT here: there is no table for searches,
// locations, devices or resident accounts. Residents are anonymous by design.

export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('organizer','reviewer')),
    org_name TEXT NOT NULL,
    email_enc TEXT NOT NULL,
    email_index TEXT NOT NULL UNIQUE,
    phone_enc TEXT,
    password_hash TEXT NOT NULL,
    totp_secret_enc TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    totp_last_step INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','disabled')),
    failed_logins INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('pending_2fa','setup_2fa','full')),
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    zip TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    geo_approx INTEGER NOT NULL DEFAULT 0,
    phone TEXT,
    website TEXT,
    hours_json TEXT NOT NULL,
    hours_note_en TEXT,
    hours_note_es TEXT,
    eligibility_en TEXT NOT NULL,
    eligibility_es TEXT NOT NULL,
    id_required TEXT NOT NULL CHECK (id_required IN ('yes','no','unknown')),
    appointment_required INTEGER NOT NULL DEFAULT 0,
    wheelchair TEXT NOT NULL CHECK (wheelchair IN ('yes','no','unknown')),
    offers_json TEXT NOT NULL,
    audiences_json TEXT NOT NULL,
    starts_at TEXT,
    ends_at TEXT,
    organizer_id TEXT REFERENCES users(id),
    verified_organizer INTEGER NOT NULL DEFAULT 0,
    last_verified_at TEXT NOT NULL,
    source_url TEXT,
    under_review INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('published','archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS listings_status ON listings(status)`,
  // An organizer never edits a published listing directly. They submit a
  // revision, the AI screens it, and a human approves it.
  `CREATE TABLE IF NOT EXISTS revisions (
    id TEXT PRIMARY KEY,
    listing_id TEXT,
    kind TEXT NOT NULL CHECK (kind IN ('new','update')),
    organizer_id TEXT NOT NULL REFERENCES users(id),
    data_json TEXT NOT NULL,
    screening_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
    reviewer_id TEXT,
    reviewer_note TEXT,
    created_at TEXT NOT NULL,
    reviewed_at TEXT
  )`,
  // "Yes, I got food": a listing id and a calendar day. No user, no device, no time of day.
  `CREATE TABLE IF NOT EXISTS confirmations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_day TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS confirmations_listing ON confirmations(listing_id, created_day)`,
  `CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL CHECK (status IN ('open','resolved','dismissed')),
    created_day TEXT NOT NULL,
    resolved_at TEXT,
    reviewer_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    created_at TEXT NOT NULL
  )`,
];
