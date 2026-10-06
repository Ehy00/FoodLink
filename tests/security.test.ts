import { describe, expect, it } from "vitest";
import { blindIndex, clientPseudonym, decrypt, encrypt, hashPassword, verifyPassword } from "@/lib/security/crypto";
import { checkSameOrigin, readJson } from "@/lib/security/http";
import { RateLimiter } from "@/lib/security/rate-limit";
import { checkTotp, currentTotp, newTotpSecret, totpUri } from "@/lib/security/totp";
import { applySchema, idParam, listingDraftSchema, parseSchema, reportSchema, searchSchema } from "@/lib/validation";

describe("encryption at rest (AES-256-GCM)", () => {
  it("round-trips and never stores the plaintext", () => {
    const box = encrypt("organizer@example.org");
    expect(box).not.toContain("organizer");
    expect(decrypt(box)).toBe("organizer@example.org");
  });

  it("uses a fresh nonce, so equal values encrypt differently", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("detects tampering", () => {
    const [v, iv, ct, tag] = encrypt("256-555-0100").split(".");
    const flipped = Buffer.from(ct, "base64url");
    flipped[0] ^= 1;
    expect(() => decrypt([v, iv, flipped.toString("base64url"), tag].join("."))).toThrow();
  });

  it("looks emails up by keyed hash, case-insensitively", () => {
    expect(blindIndex("Person@Example.org ")).toBe(blindIndex("person@example.org"));
    expect(blindIndex("a@example.org")).not.toBe(blindIndex("b@example.org"));
  });

  it("pseudonymizes client addresses with a salt that rotates daily", () => {
    const a = clientPseudonym("203.0.113.9", "2026-10-05");
    expect(a).not.toContain("203.0.113.9");
    expect(a).toBe(clientPseudonym("203.0.113.9", "2026-10-05"));
    expect(a).not.toBe(clientPseudonym("203.0.113.9", "2026-10-06"));
  });
});

describe("password hashing (scrypt)", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("correct horse battery stapl", hash)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same password 123")).not.toBe(await hashPassword("same password 123"));
  });
});

describe("two-factor codes (TOTP)", () => {
  it("accepts the current code once and rejects a replay of the same code", async () => {
    const secret = newTotpSecret();
    const code = await currentTotp(secret);
    const first = await checkTotp(secret, code, 0);
    expect(first.valid).toBe(true);
    const replay = await checkTotp(secret, code, first.timeStep);
    expect(replay.valid).toBe(false);
  });

  it("rejects wrong and malformed codes", async () => {
    const secret = newTotpSecret();
    const code = await currentTotp(secret);
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
    expect((await checkTotp(secret, wrong, 0)).valid).toBe(false);
    expect((await checkTotp(secret, "12345", 0)).valid).toBe(false);
    expect((await checkTotp(secret, "abcdef", 0)).valid).toBe(false);
    expect((await checkTotp(newTotpSecret(), code, 0)).valid).toBe(false);
  });

  it("builds a standard otpauth URI for authenticator apps", () => {
    const uri = totpUri("org@example.org", "JBSWY3DPEHPK3PXP");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("issuer=FoodLink");
  });
});

describe("rate limiter", () => {
  it("allows up to the limit, then blocks until the window slides", () => {
    const limiter = new RateLimiter();
    const rule = { limit: 3, windowMs: 1000 };
    expect([0, 1, 2].map((t) => limiter.check("a", rule, t).allowed)).toEqual([true, true, true]);
    const blocked = limiter.check("a", rule, 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(limiter.check("b", rule, 10).allowed).toBe(true); // other callers are unaffected
    expect(limiter.check("a", rule, 1001).allowed).toBe(true);
  });
});

describe("request guards", () => {
  const post = (headers: Record<string, string>, body = "{}") =>
    new Request("http://localhost:3000/api/search", { method: "POST", headers, body });

  it("blocks cross-site and origin-less POSTs (CSRF)", () => {
    expect(checkSameOrigin(post({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBeNull();
    expect(checkSameOrigin(post({ host: "localhost:3000", origin: "https://evil.example" }))?.status).toBe(403);
    expect(checkSameOrigin(post({ host: "localhost:3000" }))?.status).toBe(403);
  });

  it("accepts only JSON of a sane size that matches the schema", async () => {
    const json = { "content-type": "application/json" };
    expect((await readJson(post(json, '{"text":"groceries"}'), parseSchema)).data).toEqual({ text: "groceries" });
    expect((await readJson(post({ "content-type": "text/plain" }, "x"), parseSchema)).response?.status).toBe(415);
    expect((await readJson(post(json, "{not json"), parseSchema)).response?.status).toBe(400);
    expect((await readJson(post(json, JSON.stringify({ text: "a".repeat(20_000) })), parseSchema)).response?.status).toBe(413);
    expect((await readJson(post(json, '{"text":""}'), parseSchema)).response?.status).toBe(400);
  });
});

describe("input validation", () => {
  const tags = { needs: [], audiences: [], noId: false, wheelchair: false, when: "any", zip: null };

  it("rejects injection attempts in every free-text field", () => {
    expect(parseSchema.safeParse({ text: "<script>alert(1)</script>" }).success).toBe(false);
    expect(reportSchema.safeParse({ reason: "other", note: "<img src=x onerror=alert(1)>" }).success).toBe(false);
    expect(searchSchema.safeParse({ tags: { ...tags, zip: "35801' OR '1'='1" }, origin: null }).success).toBe(false);
    expect(searchSchema.safeParse({ tags: { ...tags, needs: ["groceries; DROP TABLE listings"] }, origin: null }).success).toBe(false);
    expect(idParam.safeParse("../../etc/passwd").success).toBe(false);
    expect(idParam.safeParse("manna-house").success).toBe(true);
  });

  it("accepts ordinary input, including Spanish", () => {
    expect(parseSchema.safeParse({ text: "comida para mis niños, sin identificación" }).success).toBe(true);
    expect(searchSchema.safeParse({ tags: { ...tags, zip: "35801" }, origin: { lat: 34.73, lng: -86.586 } }).success).toBe(true);
  });

  it("enforces the password policy for organizers", () => {
    const base = { orgName: "Test Pantry", email: "a@example.org", phone: "256-555-0100" };
    expect(applySchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(applySchema.safeParse({ ...base, password: "aaaaaaaaaaaaaa" }).success).toBe(false);
    expect(applySchema.safeParse({ ...base, password: "maple-river-otter-42" }).success).toBe(true);
  });

  it("validates listing submissions field by field", () => {
    const draft = {
      name: "Test Pantry",
      type: "pantry",
      address: "100 Main St",
      city: "Huntsville",
      zip: "35801",
      lat: 34.73,
      lng: -86.58,
      phone: "256-555-0100",
      website: null,
      hours: { weekly: [{ days: [1], open: "09:00", close: "12:00" }], monthly: [] },
      hoursNoteEn: null,
      eligibilityEn: "Anyone can come.",
      idRequired: "no",
      appointmentRequired: false,
      wheelchair: "unknown",
      offers: ["groceries"],
      audiences: ["anyone"],
      startsAt: null,
      endsAt: null,
    };
    expect(listingDraftSchema.safeParse(draft).success).toBe(true);
    expect(listingDraftSchema.safeParse({ ...draft, name: "<b>Pantry</b>" }).success).toBe(false);
    expect(listingDraftSchema.safeParse({ ...draft, website: "javascript:alert(1)" }).success).toBe(false);
    expect(listingDraftSchema.safeParse({ ...draft, hours: { weekly: [{ days: [1], open: "12:00", close: "09:00" }], monthly: [] } }).success).toBe(false);
    expect(listingDraftSchema.safeParse({ ...draft, type: "event" }).success).toBe(false); // event needs dates
    expect(listingDraftSchema.safeParse({ ...draft, status: "published", verifiedOrganizer: true }).data).not.toHaveProperty("status");
  });
});
