# SETUP.md — manual steps to take this live

Nothing in this repo has been deployed or configured against any live
Google/Razorpay service yet (the repo itself is already pushed to GitHub —
see Step 4). Everything below is a manual step for you to run yourself, in
order.

> **⚠️ Pricing note if you were mid-way through a ₹1 live payment test:**
> Session prices used to live in `Code.gs`'s source code, where Mentorship
> and Resume Review were temporarily set to ₹1 for a live test transaction.
> Pricing now lives entirely in the `EventTypes` Google Sheet tab instead
> (see Step 1), and that tab has been seeded with the **real** prices
> (₹2,500 / ₹1,500) — not the ₹1 test values. If you haven't run your ₹1
> test yet, do it via the admin dashboard (`/admin/` → Event Types tab):
> edit the price down to ₹1, run the test, then edit it back — no code
> changes or redeploys needed either way, that's the whole point of this
> update.

---

## 1. Set up the Google Sheet

This app now stores bookings, event types, and coupons in a Google Sheet
instead of hardcoding them in `Code.gs`. The Sheet ID is already hardcoded
in `Code.gs` (`SHEET_ID`), pointing at a sheet you created —
[open it here](https://docs.google.com/spreadsheets/d/1WDA3ZM-uC1nnPPtbrcYKfx9fFO0Gs20xkkzj8YASyB4/edit)
to keep it handy.

1. Paste `Code.gs` into the Apps Script editor (see Step 2 below if you
   haven't created the project yet — steps 1 and 2 both need the code pasted
   in first, do that part now if it's not already there).
2. In the Apps Script editor's function dropdown (top toolbar, next to
   **Run**), select **`initializeSheet`**, then click **Run**.
3. The first run will prompt you to **authorize additional scopes** (Sheets
   access) — approve it.
4. Check the **Execution log** (View → Logs, or `Ctrl+Enter`) for a line
   like `Sheet initialized. Tabs: Bookings, EventTypes, Coupons` confirming
   it worked. Open the Sheet itself to see the three tabs with headers, and
   `EventTypes` pre-filled with the four seed session types.

**This is safe to re-run** — it only creates tabs/headers that don't already
exist, and only seeds `EventTypes` if that tab has zero data rows. Re-running
it after you've started editing prices via the dashboard will not touch your
edits.

Final schema, for reference:

| Tab | Columns |
|---|---|
| `Bookings` | `eventId, type, name, email, date, time, durationMins, pricePaidPaise, couponCode, status, createdAt, topic` |
| `EventTypes` | `id, label, durationMins, pricePaise, active` |
| `Coupons` | `code, discountType, discountValue, usageType, maxUses, usedCount, active, expiry` |

A few notes on units and blanks: all prices are in **paise** (₹1 = 100),
matching Razorpay's own unit — including a flat-discount coupon's
`discountValue` (a percent-discount coupon's `discountValue` is just a plain
0–100 number). `maxUses` blank = unlimited for a reusable coupon. `expiry`
blank = never expires. `active` is a real boolean (TRUE/FALSE) — the admin
dashboard writes proper booleans, but the sheet also tolerates the text
`"TRUE"`/`"FALSE"` if you ever edit a cell by hand.

You generally shouldn't need to hand-edit these tabs — the admin dashboard
(Step 6 below, once deployed) does all of this through the UI. `Bookings`
in particular is written to automatically by the backend on every booking/
cancel/reschedule; treat it as a log, not something to type into directly.

## 2. Deploy `Code.gs` as an Apps Script Web App

`Code.gs` is **not** part of this repo — this repo is public, and that file
references a personal calendar email address, an Outlook calendar ID, and
pricing/business logic that shouldn't be public. Keep your own copy of it in
a local-only location outside this repo (e.g. a sibling `gas-backend-local-only/`
folder next to this repo folder) and deploy from there.

1. Go to [script.google.com](https://script.google.com), create a new
   project (or reuse an existing one), and paste the contents of your local
   `Code.gs` copy in as `Code.gs`.
2. **Script Properties** — Project Settings (gear icon) → Script Properties →
   add:
   - `RAZORPAY_KEY_ID` = your Razorpay key id (`rzp_test_...` while testing,
     `rzp_live_...` for real charges)
   - `RAZORPAY_KEY_SECRET` = your Razorpay key secret
   - `ADMIN_TOKEN` = a long random string you make up (this is the password
     for `/admin/` — treat it like one; there's no username, just this token)

   These never go in any file in this repo — they only live here, server-side.
3. **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me** (your Google account — so it can read/write your
     calendar and send mail as you)
   - Who has access: **Anyone** (needed so the public booking page can call it)
4. Copy the resulting `/exec` URL. Open `config.js` in this repo (create it
   from `config.example.js` if it doesn't exist locally) and set:
   ```js
   const CONFIG = {
     API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
     RAZORPAY_KEY_ID: 'rzp_live_XXXXXXXX'   // the same public key id, safe client-side
   };
   ```
5. `config.js` is gitignored — it will not be committed. That's intentional.

**On re-deploying later:** every time you edit `Code.gs` and want the change
live, use **Deploy → Manage deployments → Edit → New version**. Editing the
script alone does not update the live `/exec` URL's behavior until you cut a
new version.

> **⚠️ If you already deployed an earlier version of `Code.gs`:** your local
> copy should build cancel/reschedule links as `https://meet.sarathg.me/cancel/`
> and `https://meet.sarathg.me/reschedule/` (clean URLs, no `.html`, correct
> subdomain) instead of the old `sarathg.me/cancel.html` /
> `sarathg.me/reschedule.html`. If it doesn't yet, update `buildCancelUrl` /
> `buildRescheduleUrl` in your local copy, then **re-paste it into the live
> Apps Script project and cut a new deployment version** (see above) for
> future confirmation/cancellation/reminder emails to actually use the
> corrected links. This repo cannot deploy that for you.

## 3. Add the two time-driven triggers

Apps Script editor → **Triggers** (clock icon in the left sidebar) → **Add
Trigger**, twice:

1. Function: `sendDayBeforeReminders`
   Event source: Time-driven → Day timer → 7am–8am (or your preferred window)
2. Function: `sendHourBeforeReminders`
   Event source: Time-driven → Minutes timer → Every 15 minutes

Both functions already exist in `Code.gs` — this step just wires them up to
run automatically. Without this, bookings still work, but no reminder emails
go out.

## 4. GitHub Pages for this repo

This repo is already pushed to GitHub. If Pages isn't enabled yet:

1. In the repo's GitHub settings → **Pages** → set source to the `main`
   branch, root folder.
2. Confirm a `CNAME` file exists at the repo root containing exactly:
   ```
   meet.sarathg.me
   ```
   (GitHub Pages reads this file to know which custom domain to serve.)

This repo already ships a `.nojekyll` file at the root. GitHub Pages runs
every repo through Jekyll by default, even with no `_config.yml` — `.nojekyll`
disables that, so the plain HTML/CSS/JS here is served byte-for-byte as
committed (nothing tries to Liquid-process the `{{ }}`-free but still
plain-text JS in these pages). No build step, no Jekyll config — this repo
stays a pure static site.

Because every page lives at `path/index.html` (`/`, `/cancel/`,
`/reschedule/`, `/admin/`), GitHub Pages serves clean extension-less URLs
automatically — no extra rewrite rules needed.

## 5. DNS (Cloudflare)

This is a dashboard step — nothing to script. In your Cloudflare DNS
settings for `sarathg.me`, add:

- Type: `CNAME`
- Name: `meet`
- Target: `<your-github-username>.github.io`
- Proxy status: your call (DNS-only avoids some GitHub Pages/Cloudflare SSL
  edge cases; proxied gets you Cloudflare's CDN/WAF — either works, DNS-only
  is simpler to reason about while you're first setting this up)

Give DNS a few minutes to propagate, then confirm `meet.sarathg.me` resolves
and GitHub Pages shows the custom domain as verified (Settings → Pages) with
HTTPS enforced.

## 6. Log into the admin dashboard

Visit `https://meet.sarathg.me/admin/`. First visit shows a token prompt —
enter the `ADMIN_TOKEN` value you set in Script Properties (Step 2). It's
stored in `localStorage` after that (no expiry — see the note on this in the
project's build summary; a "Log out" button in the dashboard clears it if you
ever need to). From here you can review/edit event types and prices, create
coupons, and manage bookings without touching code.

## 7. Cutover — LATER, NOT NOW

Do not do any of this until you've personally tested the new
`meet.sarathg.me` site end-to-end (a real free booking, a real cancel, and
ideally a real ₹1 test-mode paid booking) and are happy with it.

- [ ] Replace "Book a consultation" / booking links in the `sarathg.me` nav
      and footer (across all pages that link to the old booking flow) to
      point at `https://meet.sarathg.me/` instead of `sarathg.me/booking.html`.
- [ ] Decide what happens to the old `sarathg.me/booking.html`: leave it as
      a dead page, replace its content with a redirect/forwarding notice
      pointing to `meet.sarathg.me`, or remove it outright.
- [ ] Double check any old confirmation emails already sent (from the old
      backend, if it's a different Apps Script deployment) don't contain
      cancel/reschedule links that silently break — either keep that old
      deployment alive read-only for existing bookings, or migrate/honor
      those links.
- [ ] Your local `Code.gs`'s `buildCancelUrl` / `buildRescheduleUrl` should
      point at `meet.sarathg.me/cancel/` and `meet.sarathg.me/reschedule/` —
      the remaining step is the re-deploy called out in Step 2 above
      (re-paste + new deployment version) so the *live* Apps Script project
      actually uses these corrected links.

None of this is done automatically — it's a checklist for you to work
through once you've verified the new site yourself.
