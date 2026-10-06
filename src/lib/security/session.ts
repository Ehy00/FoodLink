// Server-side sessions for organizers and reviewers.
//
// The browser only ever holds a random token in an HttpOnly, SameSite=Strict
// cookie. The database stores a SHA-256 hash of that token, so a database
// leak does not hand out working sessions. Signing in is a three-step ladder
// and each step gets a fresh token:
//   password ok -> "pending_2fa" (or "setup_2fa" on first sign-in) -> "full"

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { queryOne, run } from "../db/client";
import { findUserById, toSessionUser, type UserRow } from "../db/users";
import type { Role, SessionUser } from "../types";
import { randomToken, sha256 } from "./crypto";

export type SessionKind = "pending_2fa" | "setup_2fa" | "full";

const IS_PROD = process.env.NODE_ENV === "production";
/** The __Host- prefix makes browsers refuse the cookie unless it is Secure, host-only and Path=/. */
const COOKIE = IS_PROD ? "__Host-fl_session" : "fl_session";

const LIFETIME_MS: Record<SessionKind, number> = {
  pending_2fa: 5 * 60_000,
  setup_2fa: 15 * 60_000,
  full: 8 * 60 * 60_000,
};
/** A signed-in session ends after this long with no activity. */
const IDLE_MS = 30 * 60_000;

interface SessionRow {
  token_hash: string;
  user_id: string;
  kind: SessionKind;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
}

export async function startSession(userId: string, kind: SessionKind): Promise<void> {
  const jar = await cookies();
  const old = jar.get(COOKIE)?.value;
  if (old) await run("DELETE FROM sessions WHERE token_hash = ?", [sha256(old)]);

  const token = randomToken();
  const now = new Date();
  await run(
    "INSERT INTO sessions (token_hash, user_id, kind, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    [sha256(token), userId, kind, now.toISOString(), now.toISOString(), new Date(now.getTime() + LIFETIME_MS[kind]).toISOString()],
  );
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(LIFETIME_MS[kind] / 1000),
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
  jar.delete(COOKIE);
}

/** Signs a user out everywhere, for example after their password or status changes. */
export async function endAllSessions(userId: string): Promise<void> {
  await run("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

export interface ActiveSession {
  kind: SessionKind;
  user: UserRow;
}

/** Looks up the current session of the given kind. Expired and idle sessions are deleted. */
export async function getSession(kind: SessionKind): Promise<ActiveSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const hash = sha256(token);
  const row = await queryOne<SessionRow>("SELECT * FROM sessions WHERE token_hash = ?", [hash]);
  if (!row || row.kind !== kind) return null;

  const now = Date.now();
  const expired = new Date(row.expires_at).getTime() <= now;
  const idle = kind === "full" && now - new Date(row.last_seen_at).getTime() > IDLE_MS;
  if (expired || idle) {
    await run("DELETE FROM sessions WHERE token_hash = ?", [hash]);
    return null;
  }

  const user = await findUserById(row.user_id);
  if (!user || user.status !== "approved") {
    await run("DELETE FROM sessions WHERE token_hash = ?", [hash]);
    return null;
  }
  // Slide the idle timer, at most once a minute to avoid a write per request.
  if (now - new Date(row.last_seen_at).getTime() > 60_000) {
    await run("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?", [new Date(now).toISOString(), hash]);
  }
  return { kind: row.kind, user };
}

/** The signed-in user (password and second factor both passed), or null. */
export async function getUser(role?: Role): Promise<SessionUser | null> {
  const session = await getSession("full");
  if (!session) return null;
  if (role && session.user.role !== role) return null;
  return toSessionUser(session.user);
}

/** For pages: send anyone who is not signed in with the right role to the sign-in page. */
export async function requireUser(role?: Role): Promise<SessionUser> {
  const user = await getUser(role);
  if (!user) redirect("/organizer/login");
  return user;
}
