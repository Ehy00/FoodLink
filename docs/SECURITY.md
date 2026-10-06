# Security and privacy notes

FoodLink's users are people looking for free food. Many are in a vulnerable position, and some have good reasons not to want a record of the search. The design rule is: **collect as little as possible, and protect what must be kept.**

This file lists each control, the threat it answers, and where it lives in the code, so every claim can be checked.

## 1. What data exists

| Data | Stored? | Where | Notes |
| --- | --- | --- | --- |
| Resident search text | No | | Sent in a POST body, used once, discarded. Never in a URL, a log or a database |
| Resident ZIP code | No | | Same. The Alerts tab keeps it in the phone's own storage only if the resident chooses |
| Resident location | No | | Rounded to 3 decimals (about 110 m) on the device, used once to sort |
| Resident identity, account, device ID | No | | There is no resident account system |
| "Yes, I got food" | Yes | `confirmations` | Listing id and calendar day. No user, device or time of day |
| "Report a problem" | Yes | `reports` | Listing id, reason, day, optional note with phone numbers and emails stripped |
| Organizer email, phone | Yes, encrypted | `users` | AES-256-GCM |
| Organizer password | Yes, hashed | `users` | scrypt, per-user salt |
| Organizer 2FA secret | Yes, encrypted | `users` | AES-256-GCM |
| Staff sessions | Yes, hashed | `sessions` | SHA-256 of a random token |
| Staff actions | Yes | `audit_log` | Sign-ins, submissions, review decisions |

A test asserts that the database has exactly these tables and that `confirmations` has only those three columns (`tests/database.test.ts`).

## 2. Controls

### Privacy by design

| Control | Threat | Code |
| --- | --- | --- |
| No search logs | A leak or subpoena exposes who looked for food | API routes never log bodies. `next.config.ts` turns off request logging |
| POST for every search | Queries in URLs end up in access logs, history and referrers | `src/lib/client-api.ts`, `src/app/api/search/route.ts` |
| Search state in memory only | A shared family phone reveals earlier searches | `src/components/SearchProvider.tsx` |
| Location coarsened on the device | Precise home location leaves the phone | `coarsen()` in `src/lib/geo.ts` |
| PII stripped before any model call | Personal details reach an AI provider | `src/lib/ai/redact.ts` |
| No third-party scripts, fonts or analytics | Trackers build a profile of the visitor | Fonts are bundled. CSP allows only this site plus map tiles |
| `Referrer-Policy: no-referrer` | The maps site learns which listing was viewed | `src/proxy.ts` |
| Rate-limit keys are daily-rotating pseudonyms | Stored IP addresses identify residents | `clientPseudonym()` in `src/lib/security/crypto.ts` |

### Authentication (organizers and reviewers)

| Control | Threat | Code |
| --- | --- | --- |
| Reviewer approves each organization | Fake organizers post scam listings | `src/app/api/auth/apply/route.ts`, `src/app/review/` |
| Two-factor (TOTP) required to post | A stolen password is enough to post | `src/lib/security/totp.ts`, `src/app/api/auth/` |
| Each 2FA code works once | A code seen over a shoulder is replayed | `afterTimeStep` check in `checkTotp()` |
| scrypt password hashing | A database leak reveals passwords | `hashPassword()` in `src/lib/security/crypto.ts` |
| 12-character minimum password | Guessable passwords | `applySchema` in `src/lib/validation.ts` |
| Lockout after 5 failed attempts, 15 minutes | Online guessing | `recordFailedLogin()` in `src/lib/db/users.ts` |
| Same error for unknown email and wrong password, constant-time work | Attacker learns which emails are registered | `src/app/api/auth/login/route.ts` |
| Session cookie is HttpOnly, SameSite=Strict, `__Host-` and Secure in production | Script theft, cross-site use | `src/lib/security/session.ts` |
| Only a hash of the session token is stored | A database leak yields live sessions | same |
| New token at each sign-in step, 30-minute idle timeout, 8-hour maximum | Session fixation, abandoned sessions | same |
| Role checks on every staff page and endpoint | An organizer reaches the review queue | `getUser(role)` |
| Organizers can only touch their own listings | One organizer edits another's listing | `submitRevision()`, `confirmStillAccurate()` |

### Input handling

| Control | Threat | Code |
| --- | --- | --- |
| Schema validation on every request body | Malformed or hostile input | `src/lib/validation.ts`, `readJson()` |
| Angle brackets and control characters rejected in free text | Stored cross-site scripting | `text()` in `src/lib/validation.ts` |
| Parameterized SQL everywhere | SQL injection | `src/lib/db/*.ts` (no string-built queries) |
| Only `http(s)` links accepted | `javascript:` links | `listingDraftSchema.website` |
| 16 KB body limit, JSON only | Resource exhaustion, content-type confusion | `readJson()` |
| Map popups built with `textContent` | Listing names injecting markup | `src/components/MapView.tsx` |
| Content Security Policy with per-request nonce | Any injected script that slips through | `src/proxy.ts` |

### Abuse and availability

| Control | Threat | Code |
| --- | --- | --- |
| Sliding-window rate limits per endpoint group | Scraping, flooding, guessing | `src/lib/security/rate-limit.ts` |
| One confirmation or report per listing per client per 12 hours | Stuffing the freshness score, burying a pantry in reports | `feedbackPerListing` rule |
| Confirmation boost is capped | Same | `src/lib/freshness.ts` |
| Origin check on every state-changing request | Cross-site request forgery | `checkSameOrigin()` |
| Forwarded-IP headers trusted only behind a known proxy | Rate-limit bypass by forging `X-Forwarded-For` | `clientKey()` |
| Reports only flag a listing. A human takes it down | A malicious reporter hides a real pantry | `addReport()`, `decideReport()` |

### Transport and headers

HTTPS redirect, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` (location for this site only), `Cross-Origin-Opener-Policy`, no `X-Powered-By`. All in `src/proxy.ts` and `next.config.ts`.

### AI-specific

| Control | Threat | Code |
| --- | --- | --- |
| Model output is a fixed form, validated | Prompt injection makes the model do something else | `llmTagsSchema`, `llmOpinionSchema` |
| The model has no tools and no data access | Injection exfiltrates or changes data | `src/lib/ai/llm.ts` |
| Untrusted text is wrapped and labelled as data | Listing text instructs the screening model | `SYSTEM_PROMPT`, `SCREEN_SYSTEM` |
| Rule checks always run alongside the model | A fooled model waves a scam through | `screenListing()` |
| Screening can only return `needs_human_review` | AI publishes or rejects on its own | `ScreeningResult.decision` |
| AI never decides eligibility | Automated gatekeeping of food | Audience tags affect ranking only, in `filterAndRank()` |
| Fallback to rules on any model failure | Outage blocks people from finding food | `parseRequest()` |

## 3. Tested

`npm test` covers: encryption round-trip and tamper detection, password hashing, 2FA acceptance and replay rejection, rate limiting, origin checks, body validation, injection strings in every free-text field, SQL injection through listing ids, the full submit → screen → review → publish pipeline, ownership checks, report handling, and account lockout.

Checked by hand against a production build: requests without an Origin header (403), cross-site Origin (403), non-JSON bodies (415), script tags in input (400), SQL in a ZIP field (400), staff endpoints without a session (401 and 403), 30 requests a minute then 429 with `Retry-After`, a forged `X-Forwarded-For` not resetting the limit, a reused 2FA code refused, and no cookies set for residents other than the language choice.

## 4. Not done yet

Be straightforward about these if asked.

- **No independent security review or penetration test.** "Security testing" is planned for month 2 in the slides.
- **Encryption key management is basic.** One key in an environment variable. No rotation procedure.
- **No password reset, no 2FA backup codes, no email verification.** Organizer verification is a manual phone call.
- **Rate limiting is per server process** and resets on restart.
- **The hosting company can still see connection metadata** (IP address, time), as with any website. FoodLink keeps search content out of that metadata but cannot remove the metadata itself.
- **With the language model on, request text (after redaction) goes to the model provider.** The privacy page says so. With no API key, nothing leaves FoodLink.
- **Redaction is pattern-based.** It catches phone numbers, emails, street addresses and long numbers. It does not catch names.
- **Map tiles and Directions involve other companies** (OpenStreetMap, Google Maps).
- **Demo accounts keep their 2FA secret in `.env.local`** so `npm run demo:codes` works without a phone. A real deployment would not seed accounts this way.
