// Database connection (SQLite via libSQL).
//
// Local development uses a file in ./data. Set DATABASE_URL (and
// DATABASE_AUTH_TOKEN) to point at a hosted libSQL / Turso database instead.
// Every query in this codebase is parameterized: user input is never
// concatenated into SQL.

import { createClient, type Client, type InArgs, type Row } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
import { seedDatabase } from "./seed";

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Serverless hosts only allow writes under /tmp. Data there is temporary,
  // which is acceptable for a demo but not for a pilot.
  if (process.env.VERCEL) return "file:/tmp/foodlink.db";
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, "foodlink.db")}`;
}

interface Store {
  client?: Client;
  ready?: Promise<void>;
}

// Kept on globalThis so development hot reload reuses one connection.
const store = (globalThis as unknown as { __foodlinkDb?: Store }).__foodlinkDb ??= {};

function client(): Client {
  store.client ??= createClient({ url: databaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });
  return store.client;
}

async function init(): Promise<void> {
  const c = client();
  await c.execute("PRAGMA foreign_keys = ON");
  for (const statement of SCHEMA) await c.execute(statement);
  await seedDatabase(c);
}

/** Resolves once the schema exists and seed data is loaded. Safe to call on every request. */
export function ready(): Promise<void> {
  store.ready ??= init().catch((err) => {
    store.ready = undefined; // allow a retry on the next request
    throw err;
  });
  return store.ready;
}

export async function query<T = Row>(sql: string, args: InArgs = []): Promise<T[]> {
  await ready();
  const result = await client().execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function queryOne<T = Row>(sql: string, args: InArgs = []): Promise<T | null> {
  const rows = await query<T>(sql, args);
  return rows[0] ?? null;
}

export async function run(sql: string, args: InArgs = []): Promise<number> {
  await ready();
  const result = await client().execute({ sql, args });
  return result.rowsAffected;
}

/** Runs several writes atomically: all succeed or none do. */
export async function transaction(statements: Array<{ sql: string; args: InArgs }>): Promise<void> {
  await ready();
  await client().batch(statements, "write");
}

/** Test hook: point at a throwaway database file and build it from scratch. */
export async function useDatabaseForTests(url: string): Promise<void> {
  store.client?.close();
  store.client = createClient({ url });
  store.ready = undefined;
  await ready();
}
