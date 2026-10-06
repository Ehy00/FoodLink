#!/usr/bin/env node
// Prints the current two-factor codes for the seeded demo accounts, so a live
// demo does not depend on anyone's phone. For local demos only: in a real
// deployment the secret lives in the organizer's authenticator app and
// nowhere else that a person can read.

import { existsSync, readFileSync } from "node:fs";
import { generate } from "otplib";

if (!existsSync(".env.local")) {
  console.error("No .env.local found. Run `npm run setup` first.");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).trim()];
    }),
);

const accounts = [
  ["Organizer", env.DEMO_ORGANIZER_EMAIL, env.DEMO_ORGANIZER_TOTP_SECRET],
  ["Reviewer", env.DEMO_REVIEWER_EMAIL, env.DEMO_REVIEWER_TOTP_SECRET],
];

const secondsLeft = 30 - (Math.floor(Date.now() / 1000) % 30);
for (const [label, email, secret] of accounts) {
  if (!email || !secret) continue;
  console.log(`${label.padEnd(10)} ${email.padEnd(28)} code ${await generate({ secret })}`);
}
console.log(`\nCodes change in ${secondsLeft}s. Each code works once. Passwords are in .env.local.`);
