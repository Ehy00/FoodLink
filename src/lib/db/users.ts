// Organizer and reviewer accounts. Residents never have accounts.
// Emails, phone numbers and two-factor secrets are encrypted at rest.

import { blindIndex, decrypt, encrypt, hashPassword, randomId } from "../security/crypto";
import type { Role, SessionUser } from "../types";
import { query, queryOne, run } from "./client";

export interface UserRow {
  id: string;
  role: Role;
  org_name: string;
  email_enc: string;
  email_index: string;
  phone_enc: string | null;
  password_hash: string;
  totp_secret_enc: string | null;
  totp_enabled: number;
  totp_last_step: number;
  status: "pending" | "approved" | "rejected" | "disabled";
  failed_logins: number;
  locked_until: string | null;
  created_at: string;
}

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export function toSessionUser(row: UserRow): SessionUser {
  return { id: row.id, role: row.role, orgName: row.org_name, email: decrypt(row.email_enc) };
}

export function findUserByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>("SELECT * FROM users WHERE email_index = ?", [blindIndex(email)]);
}

export function findUserById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>("SELECT * FROM users WHERE id = ?", [id]);
}

export function findUserByIdentifier(identifier: string): Promise<UserRow | null> {
  const value = identifier.trim();
  if (value.includes("@")) return findUserByEmail(value.toLowerCase());
  return findUserById(value);
}

export function isLocked(user: UserRow, now: Date = new Date()): boolean {
  return !!user.locked_until && new Date(user.locked_until) > now;
}

/** Counts a failed password or code attempt and locks the account after too many. */
export async function recordFailedLogin(user: UserRow, now: Date = new Date()): Promise<void> {
  const failed = Number(user.failed_logins) + 1;
  const lockedUntil =
    failed >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : user.locked_until;
  await run("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?", [
    failed >= MAX_FAILED_LOGINS ? 0 : failed,
    lockedUntil,
    user.id,
  ]);
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await run("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?", [userId]);
}

export async function createApplicant(input: {
  orgName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<"created" | "exists"> {
  if (await findUserByEmail(input.email)) return "exists";
  await run(
    `INSERT INTO users (id, role, org_name, email_enc, email_index, phone_enc, password_hash, status, created_at)
     VALUES (?, 'organizer', ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      randomId("user"),
      input.orgName,
      encrypt(input.email),
      blindIndex(input.email),
      encrypt(input.phone),
      await hashPassword(input.password),
      new Date().toISOString(),
    ],
  );
  return "created";
}

export async function saveTotpSecret(userId: string, secret: string): Promise<void> {
  await run("UPDATE users SET totp_secret_enc = ?, totp_enabled = 0 WHERE id = ?", [encrypt(secret), userId]);
}

export async function enableTotp(userId: string, timeStep: number): Promise<void> {
  await run("UPDATE users SET totp_enabled = 1, totp_last_step = ? WHERE id = ?", [timeStep, userId]);
}

export async function rememberTotpStep(userId: string, timeStep: number): Promise<void> {
  await run("UPDATE users SET totp_last_step = ? WHERE id = ?", [timeStep, userId]);
}

export interface ApplicantView {
  id: string;
  orgName: string;
  email: string;
  phone: string | null;
  createdAt: string;
}

export async function listPendingApplicants(): Promise<ApplicantView[]> {
  const rows = await query<UserRow>("SELECT * FROM users WHERE status = 'pending' ORDER BY created_at ASC");
  return rows.map((r) => ({
    id: r.id,
    orgName: r.org_name,
    email: decrypt(r.email_enc),
    phone: r.phone_enc ? decrypt(r.phone_enc) : null,
    createdAt: r.created_at,
  }));
}

export async function setApplicantStatus(userId: string, status: "approved" | "rejected"): Promise<boolean> {
  const changed = await run("UPDATE users SET status = ? WHERE id = ? AND status = 'pending'", [status, userId]);
  return changed > 0;
}

export async function audit(actorId: string | null, action: string, target: string | null, detail: string | null = null): Promise<void> {
  await run("INSERT INTO audit_log (actor_id, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?)", [
    actorId,
    action,
    target,
    detail,
    new Date().toISOString(),
  ]);
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  target: string | null;
  detail: string | null;
  createdAt: string;
}

export async function recentAudit(limit = 15): Promise<AuditEntry[]> {
  const rows = await query<{
    id: number;
    org_name: string | null;
    action: string;
    target: string | null;
    detail: string | null;
    created_at: string;
  }>(
    `SELECT a.id, u.org_name, a.action, a.target, a.detail, a.created_at
     FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.id DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    actor: r.org_name ?? "System",
    action: r.action,
    target: r.target,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}
