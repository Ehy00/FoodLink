// Cryptography helpers. Only Node's built-in, audited primitives are used:
//   - AES-256-GCM for encrypting personal data at rest
//   - HMAC-SHA-256 for look-up indexes and for hashing client addresses
//   - scrypt for password hashing
// Nothing here is home-made crypto; it is just careful use of node:crypto.

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

// ---------- Keys ----------

let masterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (masterKey) return masterKey;
  const raw = process.env.FOODLINK_DATA_KEY;
  if (!raw) {
    throw new Error(
      "FOODLINK_DATA_KEY is not set. Run `npm run setup` to generate one, or set it in your host's environment.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("FOODLINK_DATA_KEY must be 32 bytes, base64 encoded.");
  masterKey = key;
  return key;
}

const subkeys = new Map<string, Buffer>();

/** Derive a separate key for each purpose so one leak does not expose the others. */
function subkey(purpose: "encrypt" | "index" | "client"): Buffer {
  const hit = subkeys.get(purpose);
  if (hit) return hit;
  const derived = Buffer.from(hkdfSync("sha256", getMasterKey(), Buffer.alloc(0), `foodlink:${purpose}:v1`, 32));
  subkeys.set(purpose, derived);
  return derived;
}

/** Test hook. */
export function resetKeysForTests(): void {
  masterKey = null;
  subkeys.clear();
}

// ---------- Encryption at rest ----------

const b64 = (b: Buffer) => b.toString("base64url");

/** Encrypts a string. Output format: v1.<iv>.<ciphertext>.<auth tag> */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", subkey("encrypt"), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1.${b64(iv)}.${b64(ciphertext)}.${b64(cipher.getAuthTag())}`;
}

export function decrypt(payload: string): string {
  const [version, iv, ciphertext, tag] = payload.split(".");
  if (version !== "v1" || !iv || ciphertext === undefined || !tag) throw new Error("Unrecognized ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", subkey("encrypt"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

/**
 * Deterministic keyed hash used to look a user up by email without storing the
 * email in the clear. Not reversible without the key.
 */
export function blindIndex(value: string): string {
  return createHmac("sha256", subkey("index")).update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Turns a client address into a short-lived pseudonym for rate limiting. The
 * salt changes every day, the raw address is never stored, and the result
 * cannot be linked across days.
 */
export function clientPseudonym(address: string, day: string): string {
  return createHmac("sha256", subkey("client")).update(`${day}|${address}`).digest("hex").slice(0, 32);
}

// ---------- Passwords ----------

const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 32 };

function scrypt(password: string, salt: Buffer, N: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password.normalize("NFKC"), salt, keylen, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keylen);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), Number(N), Number(r), Number(p), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A fixed hash to compare against when the account does not exist, so timing does not reveal which emails are registered. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(18).toString("base64url"));
  return dummyHash;
}

// ---------- Tokens ----------

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}
