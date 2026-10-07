# Alabama FoodLink

**Team 2 · SDG 2: Zero Hunger · CS 410 prototype**

A free, no-sign-up website that uses AI to find verified food help near you, without tracking who you are. This is the working prototype for the Huntsville / Madison County pilot described in the team's slides.

| Open FoodLink | Ask in plain words | Get food |
| --- | --- | --- |
| ![Home screen](docs/screenshots/home.png) | ![Results screen](docs/screenshots/results.png) | ![Listing screen](docs/screenshots/detail.png) |

> **Prototype, not a live service.** The listings are real organizations collected from public directories, but nobody on the team has phoned them yet, and the "verified" dates are sample values. Read [What is real and what is not](#what-is-real-and-what-is-not) before showing this to anyone who needs food.

## Run it

You need [Node.js](https://nodejs.org) 20.9 or newer.

```bash
npm install
npm run setup     # creates .env.local with a fresh encryption key and demo accounts
npm run dev       # http://localhost:3000
```

The database is created and filled with the pilot listings the first time a page loads.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app for development and for the class demo |
| `npm test` | Run the 69 automated tests |
| `npm run demo:codes` | Print the current 6-digit sign-in codes for the demo accounts |
| `npm run setup -- --reset` | Wipe the local database so it is re-seeded on next start |
| `npm run build` then `npm start` | Production build (strict security headers, no dev tooling) |
| `npm run lint`, `npm run typecheck` | Code checks |

**Demo accounts.** `npm run setup` writes three accounts into `.env.local`: an organizer, a reviewer, and a new organizer who has not set up two-step sign-in yet. Their emails and passwords are in that file, which is never committed. For the 6-digit code, run `npm run demo:codes`, or scan the QR code during enrollment with any authenticator app.

**Turning on the language model (optional).** Put an Anthropic API key in `.env.local` as `ANTHROPIC_API_KEY`. Without a key the app uses its built-in rule-based parser, so the demo works with no key, no cost and no wifi.

See [docs/DEMO.md](docs/DEMO.md) for a 5-minute walkthrough that follows the slides.

## What it does

### Residents: find food (no account)

| Feature in the slides | In the prototype |
| --- | --- |
| ZIP or location search, closest first | ZIP box, or "Use my location once", which the phone rounds to about a city block before sending |
| Ask FoodLink: private AI search, English or Spanish | Plain-words box. The AI turns the request into editable tags, and result cards explain why a place matched. The question is never stored |
| Responsive map and list view | Desktop shows results beside a live map; mobile switches between List and Map. ZIP searches center the map around the resident's area, and pins are coloured by freshness |
| Filters | Open today, open now, free meals, groceries, no ID, wheelchair access, and more |
| Verified listing details | Hours, eligibility, what is offered, ID policy, "Verified N days ago" badge |
| Act and confirm | One-tap Directions and Call, then "Did you get food here?" |
| Privacy and security center | Search storage, rounded location, AI redaction and organizer protections are explained visibly in the resident interface |
| Report incorrect info | "Report a problem" goes to a human reviewer. One-time events expire on their own |
| Events and Alerts tabs | Upcoming distributions built from real monthly schedules. Alerts with no subscriber list |
| Spanish | EN / ES switch for the whole resident interface |

### Organizers: post listings (verified accounts only)

Apply for an account → a reviewer verifies the organization → sign in with password **and** a 6-digit authenticator code → submit a listing → **AI screening** → **human review** → published.

Nothing an organizer types reaches residents until a person approves it.

## How it works

```
RESIDENTS                                                      ┌──────────────────────┐
Web app ──► AI request parser ──► Search API ─────────────────►│                      │
(ZIP, location,  (words → editable   (filter, sort by          │  Verified listings   │
 plain words)     filter tags)        distance)                │  database            │
                                                               │  hours, eligibility, │
ORGANIZERS                                                     │  last-verified date, │
2FA login ──► AI screening ──► Human review ──────────────────►│  freshness score     │
(verified     (duplicates, fake   (approves before             └──────────────────────┘
 accounts)     addresses, scams)   anything is published)

Security layer: HTTPS · encrypted storage · rate limiting · input validation · no search logs
```

| Box in the diagram | Code |
| --- | --- |
| Responsive web app | `src/app/(resident)/`, `src/components/` |
| AI request parser | `src/lib/ai/parse.ts`, `rules-parser.ts`, `llm.ts`, `redact.ts` · `POST /api/parse` |
| Search API | `src/lib/db/listings.ts` · `POST /api/search` |
| 2FA login | `src/lib/security/totp.ts`, `session.ts` · `src/app/api/auth/` |
| AI screening | `src/lib/ai/screening.ts` |
| Human review | `src/lib/db/moderation.ts` · `src/app/review/` |
| Verified listings database | `src/lib/db/schema.ts`, `src/data/seed-listings.ts` |
| Freshness score | `src/lib/freshness.ts` |
| Security layer | `src/proxy.ts`, `src/lib/security/`, `src/lib/validation.ts` |

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, SQLite through libSQL, Leaflet with OpenStreetMap tiles, Zod, otplib, Vitest.

## The AI

FoodLink uses AI in three places. In each one the AI **suggests** and a person **decides**.

**1. Request parser ("Ask FoodLink").** Hybrid: if an API key is configured the request goes to a language model, which must fill in a fixed form of tags. If there is no key, or the model is slow, or its answer does not match the form, a built-in rule-based parser for English and Spanish takes over. The interface says which one produced the tags. Safeguards:

- Phone numbers, emails, street addresses and long numbers are removed before any text is sent to a model.
- The model can only return the fixed set of tags. It has no tools and no access to data, so a prompt-injection attempt can at worst produce a wrong tag, which the resident sees and can remove.
- The ZIP code is always extracted by plain code. A model never chooses a location.
- The AI never decides who qualifies for food. Audience tags only nudge the ranking.

**2. Listing screening.** Every organizer submission is checked for duplicates (similar name, same address, pins within about 500 feet), addresses that do not hold up (P.O. boxes, non-Alabama ZIP codes, a pin outside Madison County or far from its ZIP) and scam language (fees, payment apps, requests for a Social Security number, pressure wording, shortened links, premium-rate phone numbers). With an API key, a language model adds a second opinion. The result is a risk level and a list of reasons for the reviewer. It cannot publish or reject.

**3. Freshness score.** A transparent 0 to 100 score: it decays with time since the last verification, rises with recent "Yes, I got food" confirmations (capped so it cannot be stuffed), and drops with each open report. It drives the badge on every listing and the pin colours on the map. This is a scoring formula, not machine learning, and the code says so.

## Security and privacy

Full details, with the file that implements each control, are in [docs/SECURITY.md](docs/SECURITY.md).

| Promise in the slides | How it is kept |
| --- | --- |
| No account; searches and location never saved | No resident tables exist. Searches travel in POST bodies, never in URLs, and are not logged. Search state lives in page memory and is gone on refresh |
| Only verified organizers with two-factor login can post | Applications are approved by a reviewer. TOTP codes (RFC 6238), each usable once. Lockout after 5 failures |
| HTTPS and encrypted storage for any personal data | HTTP is redirected and HSTS is set when deployed. Organizer email, phone and 2FA secret are encrypted with AES-256-GCM. Passwords are hashed with scrypt |
| Rate limits and input checks stop bots and injection attacks | Sliding-window limits on every endpoint. Every request body is validated against a schema. Every SQL query is parameterized. Strict Content Security Policy |
| Reports go to a human reviewer | Reports and submissions land in the review queue. Every decision is written to an audit log |

## What is real and what is not

| | Status |
| --- | --- |
| Listing names, addresses, phones, hours, ID notes | Real, from public directories on 5 Oct 2026 (sources in `src/data/seed-listings.ts`). **Not yet confirmed by phone.** |
| "Verified N days ago" dates on seeded listings | **Sample values**, spread out to show every freshness state |
| "Verified organizer" badge on three seeded listings | **Sample.** Attached to the demo organizer account |
| "Mobile Food Pantry (sample event)" | **Not a real event.** Labelled as a sample in the app |
| Wheelchair access | "Not confirmed" for every seeded listing. No source stated it and the app does not guess |
| Map pin positions | US Census geocoder, except six pins placed by hand and marked "approximate location" |
| ZIP code centre points | Approximate |

Before a real pilot, replace `src/data/seed-listings.ts` with the team's verified dataset and remove the sample event.

## Known limitations

- **The language-model path has not been run against the live API.** No API key was available while building. It is covered by tests with a stand-in model, and the rule-based path is tested end to end.
- **Rate limits live in server memory.** Fine for one server. Several servers would need a shared store such as Redis.
- **Deploying to a serverless host (Vercel) uses a temporary database** in `/tmp` unless `DATABASE_URL` points at a hosted libSQL / Turso database. Organizer and reviewer actions may not persist between requests there. For the class demo, run locally.
- **Staff screens are English only.** Listings submitted by organizers are not translated into Spanish.
- **No password reset and no 2FA backup codes yet.** A locked-out organizer needs a reviewer's help.
- **Directions open Google Maps** with the destination only. Map tiles come from OpenStreetMap. Both are other companies' services.
- **Needs a phone or computer and an internet connection**, as the slides note.

## Project layout

```
src/
  app/(resident)/     Home, search results, listing, map, events, alerts, privacy
  app/organizer/      Sign-in, 2FA setup, apply, dashboard, listing form
  app/review/         Human review queue and audit log
  app/api/            JSON endpoints (all POST except 2FA setup)
  components/         Screens and shared pieces
  lib/ai/             Request parser, PII redaction, listing screening, model client
  lib/db/             Schema, seed, queries
  lib/security/       Encryption, passwords, sessions, 2FA, rate limiting, request guards
  lib/i18n/           English and Spanish text
  data/               Pilot seed listings
  proxy.ts            Security headers and HTTPS redirect
tests/                Unit and integration tests
scripts/              Setup and demo helpers
docs/                 Demo walkthrough and security notes
```

## Team

Femi (facilitator) · Amarachi (researcher) · Ayomide (technical lead) · Isegun (ethics and constraints lead) · Tosin (recorder and presenter)
