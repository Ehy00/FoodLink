# 5-minute demo walkthrough

Follows the numbered callouts on the "How it looks" slide: purple for AI (3, 4, 6, 8), red for security and privacy (1, 2, 5, 7, 9).

## Before class

```bash
npm install
npm run setup -- --reset   # fresh database, same demo accounts
npm run dev
```

- Open `http://localhost:3000` in Chrome. Press F12, switch on the phone view, or just leave it: the app frames itself as a phone on a wide screen.
- Open `.env.local` in an editor on a second screen (demo emails and passwords). Do not project it.
- In a terminal, have `npm run demo:codes` ready.
- If the room has no wifi the map background will be grey, but pins, search and everything else still work.
- Timing: "Open today" and "Open now" depend on the real clock. Check what they return at your class time.

## Part 1. A resident finds food (about 2 minutes)

| Step | Do | Say |
| --- | --- | --- |
| 1 | Show the home screen | No download, no account. **(1)** "Private by design" |
| 2 | Point at "Use my location once · not stored" | **(2)** The phone rounds the location to about a block before sending it. Nothing is kept |
| 3 | Type `free groceries for my kids, no ID 35801` in Ask FoodLink and press Enter | **(3)** Plain words, English or Spanish |
| 4 | Point at the purple card | **(4)** The AI shows what it understood as tags. **(5)** "Your question is not saved" |
| 5 | Tap the `×` on **No ID** | The AI can misread a request, so the person is always in control. The list grows |
| 6 | Point at a green "Verified" badge, then an amber one | **(6)** The freshness score. **(7)** "Verified organizer" |
| 7 | Type `necesito comida caliente para mis hijos, sin papeles` | Same parser, Spanish. Then tap **ES** on the home screen to show the Spanish interface |
| 8 | Open **Freedom House Church** | Hours, who can come, ID policy, one-tap Directions and Call |
| 9 | Scroll down, tap **Yes, I got food** | **(8)** This feeds the freshness score. It stores the listing and the date, nothing about the person |
| 10 | Refresh the page, go back to Search | The search is gone. It only ever lived in memory |

Optional: show the **Map**, **Events** and **Alerts** tabs. Events are generated from real monthly schedules ("2nd Saturday"). Alerts work with no subscriber list.

## Part 2. An organizer posts, AI screens, a human approves (about 2 minutes)

| Step | Do | Say |
| --- | --- | --- |
| 1 | Go to `/organizer/login`. Sign in as the **new organizer** | Only verified organizations get this far |
| 2 | The QR code appears. Scan it with an authenticator app on your phone and type the 6-digit code. No phone handy? Sign in as the regular demo organizer instead and use `npm run demo:codes` | **Two-factor is mandatory** before posting |
| 3 | **Add a listing**. Fill in a name, an address in New Hope, ZIP `35760`, add weekly hours, a line of eligibility text. Submit | "Submitted for review": nothing is public yet |
| 4 | Point at the purple AI screening panel | Low risk, and it still goes to a person |
| 5 | Sign out. Sign in as the **reviewer** with a code from `npm run demo:codes` | Password plus code |
| 6 | Show **Free Grocery Giveaway Huntsville** in the queue | The AI flagged nine things: P.O. box, Georgia ZIP code, a fee, Cash App, asks for a Social Security number, premium-rate phone, shortened link. **The AI only advises** |
| 7 | **Reject** it with a note. **Approve** the organizer's listing | A human decides |
| 8 | Back on the resident site, search `groceries 35760` | The approved listing is live, with "Verified today" and "Verified organizer" |
| 9 | Scroll to **Recent activity** on the review page | Every staff action is in the audit log. Resident searches never are |

## Part 3. Security, live (about 1 minute)

Run these in a terminal while the app is running. Each one is a real attack being refused.

```bash
# 1. Cross-site request forgery: a POST from another website is blocked
curl -s -X POST localhost:3000/api/parse -H "Content-Type: application/json" \
  -H "Origin: https://evil.example" -d '{"text":"groceries"}'

# 2. Script injection is rejected by input validation
curl -s -X POST localhost:3000/api/parse -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" -d '{"text":"<script>alert(1)</script>"}'

# 3. SQL injection in the ZIP field is rejected
curl -s -X POST localhost:3000/api/search -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"tags":{"needs":[],"audiences":[],"noId":false,"wheelchair":false,"when":"any","zip":"35801 OR 1=1"},"origin":null}'

# 4. Rate limiting: the 31st request in a minute gets HTTP 429
for i in $(seq 1 32); do curl -s -o /dev/null -w "%{http_code} " -X POST localhost:3000/api/parse \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3000" -d '{"text":"groceries"}'; done; echo

# 5. Staff endpoints refuse anyone who is not signed in
curl -s -X POST localhost:3000/api/review/revisions/rev_demo_scam -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" -d '{"decision":"approve"}'
```

After step 4, wait a minute before searching again in the browser, or restart `npm run dev`.

On Windows, run these in Git Bash or WSL.

Other things worth showing if asked:

- **Encrypted at rest.** Open `data/foodlink.db` in any SQLite viewer. The `users` table shows `email_enc` as ciphertext and `password_hash` as a scrypt hash.
- **No resident data.** The same viewer shows there is no table for searches or locations. `confirmations` has three columns: id, listing, day.
- **Browser dev tools → Application → Cookies.** A resident has one cookie, `fl_lang`, holding `en` or `es`.
- **Browser dev tools → Network.** Search text is in the request body. The address bar never changes to include it.
- **Replay.** Sign in as the reviewer, sign out, and try the same 6-digit code again within 30 seconds. It is refused.

## Likely questions

**"Is this really AI?"** The request parser is hybrid. With an API key it uses a large language model, with a rule-based fallback. Without a key it runs on rules alone, and the screen says which one answered. Listing screening works the same way. The freshness score is a transparent formula, on purpose, so a reviewer can explain any flag.

**"Are these listings verified?"** Not yet. They are real organizations from public directories, with sample verification dates so the demo shows every state. Verifying 20 to 30 listings by phone is the month 1 task on the Next Steps slide.

**"What if the AI gets it wrong?"** The tags are shown and editable, the filters work without AI, and the AI never decides who qualifies.

**"What stops a fake pantry?"** Organizer verification, two-factor sign-in, AI screening and human approval, in that order. Residents can also report a listing, and a report of being asked for money flags the listing immediately.
