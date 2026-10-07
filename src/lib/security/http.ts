// Shared guards for every API route: same-origin check, rate limiting,
// strict JSON parsing and schema validation, and consistent safe responses.

import { createHmac, randomBytes } from "node:crypto";
import type { z } from "zod";
import { clientPseudonym } from "./crypto";
import { limiter, RULES, type RateLimitRule } from "./rate-limit";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

// Resident search should not crash just because staff-demo encryption has not
// been configured yet. When FOODLINK_DATA_KEY is absent, rate limiting uses a
// random in-memory HMAC key that disappears when the server restarts.
const EPHEMERAL_CLIENT_KEY = randomBytes(32);

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { ...NO_STORE, ...extraHeaders } });
}

export function fail(status: number, error: string, extraHeaders: Record<string, string> = {}): Response {
  return json({ error }, status, extraHeaders);
}

/**
 * A stable-for-one-day pseudonym for the caller. The raw address is used only
 * in memory to compute this value and is never stored or logged.
 */
export function clientKey(request: Request): string {
  // Forwarding headers can be forged by the caller, so they are only trusted
  // when the app is known to sit behind a proxy that overwrites them.
  const behindProxy = !!process.env.VERCEL || process.env.FOODLINK_TRUST_PROXY === "1";
  const forwarded = behindProxy ? request.headers.get("x-forwarded-for") : null;
  const address = forwarded?.split(",")[0]?.trim() || "local";
  const day = new Date().toISOString().slice(0, 10);
  if (process.env.FOODLINK_DATA_KEY) return clientPseudonym(address, day);
  return createHmac("sha256", EPHEMERAL_CLIENT_KEY)
    .update(`${day}|${address}`)
    .digest("hex")
    .slice(0, 32);
}

/** Returns a 429 response if the caller is over the limit, otherwise null. */
export function rateLimit(request: Request, rule: keyof typeof RULES | RateLimitRule, scope: string): Response | null {
  const r = typeof rule === "string" ? RULES[rule] : rule;
  const result = limiter.check(`${scope}:${clientKey(request)}`, r);
  if (result.allowed) return null;
  return fail(429, "Too many requests. Please wait a moment and try again.", {
    "Retry-After": String(result.retryAfterSeconds),
  });
}

/** Rate limit on something other than the caller's address, for example one account. */
export function rateLimitKey(key: string, rule: keyof typeof RULES): Response | null {
  const result = limiter.check(key, RULES[rule]);
  if (result.allowed) return null;
  return fail(429, "Too many requests. Please wait a moment and try again.", {
    "Retry-After": String(result.retryAfterSeconds),
  });
}

/**
 * CSRF defence for state-changing requests. Browsers always send an Origin
 * header on cross-site POSTs, so a request whose Origin is missing or does not
 * match this site is refused. Session cookies are also SameSite=Strict.
 */
export function checkSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return fail(403, "Request blocked: missing origin.");
  try {
    if (new URL(origin).host !== host) return fail(403, "Request blocked: cross-site request.");
  } catch {
    return fail(403, "Request blocked: bad origin.");
  }
  return null;
}

const MAX_BODY_BYTES = 16_000;

/**
 * Reads and validates a JSON body. Rejects anything that is not JSON, is too
 * large, or does not match the schema. Unknown fields are stripped by the schema.
 */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T>; response?: undefined } | { data?: undefined; response: Response }> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return { response: fail(415, "Send JSON.") };
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { response: fail(400, "Could not read the request.") };
  }
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    return { response: fail(413, "Request is too large.") };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { response: fail(400, "That is not valid JSON.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    return { response: fail(400, `${where}${first?.message ?? "Invalid input."}`) };
  }
  return { data: parsed.data };
}

/** Standard guard for a public write: same-origin, then rate limit. */
export function guardPublicWrite(request: Request, rule: keyof typeof RULES, scope: string): Response | null {
  return checkSameOrigin(request) ?? rateLimit(request, rule, scope);
}
