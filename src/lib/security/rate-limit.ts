// Sliding-window rate limiter.
//
// Keys are daily-rotating pseudonyms (see clientPseudonym), never raw IP
// addresses, and nothing is written to disk. State lives in memory, which is
// right for a single-server prototype; a multi-server deployment would move
// this to a shared store such as Redis.

export interface RateLimitRule {
  /** Max requests allowed in the window */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the caller may try again (0 when allowed) */
  retryAfterSeconds: number;
}

export const RULES = {
  /** AI parsing and search: generous for a person, tight for a scraper. */
  search: { limit: 30, windowMs: 60_000 },
  /** "Yes, I got food" and "Report a problem" */
  feedback: { limit: 6, windowMs: 60_000 },
  /** One confirmation or report per listing per client per 12 hours */
  feedbackPerListing: { limit: 1, windowMs: 12 * 60 * 60_000 },
  /** Password and 2FA attempts */
  auth: { limit: 10, windowMs: 5 * 60_000 },
  /** Organizer applications */
  apply: { limit: 3, windowMs: 60 * 60_000 },
  /** Organizer and reviewer writes */
  write: { limit: 30, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

const MAX_KEYS = 20_000;

export class RateLimiter {
  private hits = new Map<string, number[]>();

  check(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitResult {
    const cutoff = now - rule.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= rule.limit) {
      this.hits.set(key, recent);
      const retryAfterMs = recent[0] + rule.windowMs - now;
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }

    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > MAX_KEYS) this.prune(now);
    return { allowed: true, remaining: rule.limit - recent.length, retryAfterSeconds: 0 };
  }

  /** Drop the oldest keys so memory cannot grow without bound under a flood. */
  private prune(now: number): void {
    for (const [key, times] of this.hits) {
      if (times.length === 0 || times[times.length - 1] < now - 24 * 60 * 60_000) this.hits.delete(key);
    }
    while (this.hits.size > MAX_KEYS) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
  }

  reset(): void {
    this.hits.clear();
  }
}

// One limiter per server process. Stored on globalThis so hot reload in
// development does not hand out a fresh, empty limiter on every edit.
const globalStore = globalThis as unknown as { __foodlinkLimiter?: RateLimiter };
export const limiter: RateLimiter = (globalStore.__foodlinkLimiter ??= new RateLimiter());
