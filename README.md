# Meet with Sarath

A standalone, multi-event-type booking scheduler for Sarath G, intended to be
hosted at `meet.sarathg.me` (GitHub Pages, separate repo from the main
`sarathg.me` site).

This replaces the old single-event `sarathg.me/booking.html` with a scheduler
at the clean root URL `meet.sarathg.me/`. Session types, durations, prices, and
coupons all live in a Google Sheet now (not hardcoded) and are manageable from
a password-gated admin dashboard at `meet.sarathg.me/admin/` — no redeploy
needed to change a price, add a session type, or create a discount code. The
site ships with four seed session types (Scoping Call, Basic Career Advice,
Mentorship Session, Resume Review & Career Advice); see the Sheet or the admin
dashboard for current pricing.

## How the pieces fit together

- **Front end** (this repo, static HTML/CSS/JS) — `index.html` (the booking
  scheduler, served at the site root), `cancel/index.html`, `reschedule/index.html`,
  `admin/index.html` (password-gated dashboard). Every page is reachable
  without a `.html` extension (`/`, `/cancel/`, `/reschedule/`, `/admin/`)
  using plain folders with `index.html` inside — no Jekyll, no build step, no
  framework, no dependencies beyond Google Fonts and (for paid bookings)
  Razorpay's `checkout.js`. `.nojekyll` at the repo root tells GitHub Pages
  not to run these through Jekyll's Liquid processor.
- **Backend** — `Code.gs`, a Google Apps Script Web App. It owns calendar
  availability, booking creation/cancellation/reschedule, Razorpay order
  creation + payment signature verification + coupon logic, confirmation
  emails, reminder emails, and every admin action. **It is intentionally NOT
  part of this repo** — this is a public repo, and `Code.gs` references a
  personal calendar email address, an Outlook calendar ID, and business logic
  that has no reason to be public. Keep your own copy of it locally (outside
  this repo) and deploy it from there — see [SETUP.md](SETUP.md).
- **Data store** — a Google Sheet (see [SETUP.md](SETUP.md) for the ID and
  one-time setup). Five tabs: `Bookings` (a log of every booking, updated on
  cancel/reschedule/no-show/attended), `EventTypes` (the live session-type
  catalogue — what the booking page and backend both read), `Coupons`,
  `Availability` (weekly hours + date overrides) and `Settings` (minimum
  notice, buffer). This is the actual source of truth for pricing and hours
  now, not `Code.gs`'s source code — admin dashboard changes take effect
  within about a minute (short cache TTL on the hot path), no redeploy.
- **Config** — `config.js` (gitignored, holds your real deployment URL and
  Razorpay public key) and `config.example.js` (committed, shows the shape).
  Every HTML page loads `config.js` before its own script and reads
  `CONFIG.API_URL` / `CONFIG.RAZORPAY_KEY_ID`.

## API contract (front end ↔ Apps Script)

The front end talks to `CONFIG.API_URL` exactly as follows — this must stay
in sync with your local `Code.gs`:

**Public actions:**

- `GET ?action=event-types` → `{ eventTypes: [{ id, label, duration, price, active, description, listed }, ...] }`
  — read live from the `EventTypes` sheet (active types only, including
  unlisted ones with `listed: false`); `index.html` fetches this on load
  instead of hardcoding the catalogue, so a price/label change made in the
  admin dashboard shows up on the booking page without a redeploy.
- `GET ?action=availability` → `{ offWeekdays: [0..6], blockedDates: ['YYYY-MM-DD'], maxDaysAhead, hoursSummary }`
  — the on/off shape plus the horizon (calendars grey those days out) and a
  one-line hours summary such as `"Mon – Sat, 9 AM – 8 PM IST"` for the
  booking page's sidebar (derived from the weekly template; `''` if every
  day is off).
- `GET ?date=YYYY-MM-DD&eventType={id}[&adminToken=…]` → `{ date, eventType, slots: [...] }`
  — with a valid admin token the minimum-notice window is skipped (used by
  the admin reschedule / book-for-client modals); hours, calendar clashes
  and the buffer still apply.
- `POST { action: 'validate-coupon', code, eventType }` → `{ valid, code, discountType, discountValue, originalPrice, discountedPrice }` or `{ valid: false, error }`
  — read-only check, does **not** consume the coupon's usage
- `POST { action: 'create-order', eventType, couponCode? }` → `{ orderId, amount, currency, keyId }`
  (paid event types only, called before opening Razorpay Checkout; amount is
  always recomputed server-side from the Sheet, coupon included — never
  trust a client-supplied discounted amount)
- `POST { date, time, name, email, topic, eventType, couponCode?, [razorpayOrderId, razorpayPaymentId, razorpaySignature] }`
  → `{ success: true, eventId, message }` or `{ error }`
  (payment fields are required unless the *effective* price — after any
  coupon — is 0; a coupon's usage is only consumed here, on a completed
  booking, never on validate-coupon or create-order)
- `POST { action: 'cancel', eventId, email }` → `{ success: true }` or `{ error }`
- `POST { action: 'reschedule', eventId, email, newDate, newTime }` → `{ success: true, eventId }` or `{ error }`

**Admin actions** (all require `adminToken` — see below): `admin-list-bookings`
(optional `dateFrom`/`dateTo`/`eventType`/`status` filters), `admin-cancel`
(`eventId`), `admin-reschedule` (`eventId`, `newDate`, `newTime`),
`admin-resend-reminder` (`eventId`, `kind`: `'confirmation'` or `'reminder'`),
`admin-mark-no-show` (`eventId` — only for a past `confirmed`/`rescheduled`
booking; sets status `no-show`, emails the client a "we missed you" note
with their reschedule link, and starts the automated nudge sequence),
`admin-mark-attended` (`eventId` — past booking → status `completed`; no
email), `admin-stats` (`month: 'YYYY-MM'` → bookings, revenue, completed,
no-shows, no-show rate, most-booked type, upcoming), `admin-create-booking`
(`eventType`, `date`, `time`, `name`, `email`, `topic?`, `payment:
'offline'|'waived'` — books on the client's behalf through the same commit
path as a web booking minus Razorpay; row gets `source = admin`),
`admin-get-availability`, `admin-save-weekly` (`weekly: { mon..sun: {
enabled, windows } }`), `admin-upsert-date-override` (`date`, `enabled`,
`windows`, `note`), `admin-delete-date-override` (`date`),
`admin-get-settings`, `admin-save-settings` (`settings: { minNoticeHours,
bufferMins, maxDaysAhead }`),
`admin-list-event-types`, `admin-upsert-event-type` (`id`, `label`,
`durationMins`, `pricePaise`, `active` — matches on `id`, so this both edits
and creates), `admin-list-coupons`, `admin-upsert-coupon` (`code`,
`discountType`, `discountValue`, `usageType`, `maxUses`, `active`, `expiry` —
matches on `code`), `admin-deactivate-coupon` (`code`).

**Why the admin token is a body field, not a header:** Apps Script Web Apps
don't expose custom HTTP request headers to `doGet`/`doPost` at all — only
query params and the POST body are readable. So `admin/index.html` sends
`adminToken` as a plain field in the same JSON body as everything else,
and every `admin-*` handler checks it against the `ADMIN_TOKEN` Script
Property before doing anything.

Note: POST requests are sent **without** an explicit `Content-Type` header on
purpose. Setting one triggers a CORS preflight (`OPTIONS`) request, which
Apps Script Web Apps don't handle — the request silently fails. `e.postData.contents`
on the Apps Script side parses the raw body regardless of content type, so
this is safe.

## Deep links, focused landing pages, and unlisted sessions

For ads and direct links, the booking page accepts two query parameters:

- `/?type=<id>` — pre-selects that session and opens on the date step; the
  rest of the menu stays available via "Change".
- `/?type=<id>&focus=1` — **focused landing**: the session-type picker is
  removed and a hero (name, duration, price, what-you-get bullets) sits
  directly above the date picker. Nothing else — in particular no free
  session — is visible. Use this as the destination for any paid ad.

Session descriptions are plain text; lines starting with `- ` render as
bullets (on the booking page's left panel and in the focus hero). Write a
one-line intro followed by three bullets for anything you'll advertise.

Each event type has a **Listed** flag (admin → Event Types). Unlisted
sessions are hidden from the home-page menu but work through their direct
link — for ad-only, coupon-priced, or audience-specific offers. The admin
form shows both links after you add a type.

## Analytics

`index.html` carries GA4, Microsoft Clarity and the **Meta Pixel**
(`1131377436123001`). The Pixel fires standard events so Meta ads can be
measured and optimised: `PageView`; `ViewContent` when a session is
selected (or a focus landing opens); `InitiateCheckout` on submit;
`Purchase` (value in INR) when a paid booking is confirmed; `Lead` when a
free booking is confirmed. The pixel is a no-op when blocked. The same
four moments are sent to GA4 in ecommerce vocabulary — `view_item`,
`begin_checkout`, `purchase` (with `transaction_id` = calendar event id and
value in INR) and `generate_lead` — so the booking funnel and conversions
show up in GA4 reports; mark `purchase` and `generate_lead` as key events in
GA4 admin. Ad links carry UTM parameters, which is how GA4 attributes paid
traffic to a campaign.

## Availability and booking rules — edited in the admin panel

Working hours no longer live in code. The **Availability** tab of the
dashboard edits two Sheet tabs:

- `Availability` — one row per weekday (`mon`..`sun`: on/off + one or more
  `HH:MM-HH:MM` IST ranges, so a day can have a lunch gap) and one row per
  date override (`YYYY-MM-DD`: blocked, or custom hours for that date). A
  date row always wins over its weekday row.
- `Settings` — `minNoticeHours` (default 4: no slot may start sooner than
  this from "now"), `bufferMins` (default 10: padding before/after every
  calendar event) and `maxDaysAhead` (default 45: the booking horizon — no
  public slot further out than this many calendar days).

`buildSlots()` walks the day's ranges in 15-minute steps, requires the whole
session to fit inside a range, clears the buffered calendar busy blocks, and
applies the notice window and the booking horizon. Because the booking-time
re-check reuses the same function, what the picker shows is exactly what can
be booked. Admin-initiated bookings and reschedules skip the notice window
and the horizon. All three are cached 60s, so edits go live within a minute —
no redeploy.

The constants left in `Code.gs` (`DEFAULT_WINDOWS`, `MIN_NOTICE_HOURS`,
`BUFFER_MINS`) are seed values used once by `initializeSheet()`.

## Admin dashboard tools

- **Overview** strip on the Bookings tab — bookings, revenue, no-show rate,
  most-booked type and upcoming count for a chosen month.
- **Mark attended / Mark no-show** in each past booking's row menu; together
  they make the no-show rate meaningful.
- **Book for a client** — for sessions agreed over phone/WhatsApp; records
  payment as offline (full price) or waived, sends the normal confirmation.
- **Export CSV** — the currently filtered bookings, every column.

## No-show follow-up

No-shows are marked by hand from the admin dashboard (Bookings tab → row
menu → **Mark no-show**, shown only for past confirmed bookings). Marking
one:

1. Sets the `Bookings` row to status `no-show` and stamps `noShowMarkedAt`.
2. Immediately emails the client a "we missed you" note with their existing
   reschedule link (paid or free — the session is still theirs, no new
   payment is asked).
3. Leaves the Calendar event in place so that reschedule link keeps working.

A daily `sendNoShowNudges` trigger (see [SETUP.md](SETUP.md)) then sends one
nudge per entry in `NO_SHOW_NUDGE_DAYS` (`[3, 7]`) days after marking,
tracked in `noShowNudgesSent`. Rescheduling or cancelling flips the row's
status, which is what ends the sequence — nothing else to unsubscribe.

## Event type catalogue — the Sheet is the source of truth

Session names, durations, and prices used to be hardcoded in two files; they
now live in the `EventTypes` tab of the Sheet (see [SETUP.md](SETUP.md)) and
are edited via the admin dashboard, not by editing code. `Code.gs` reads it
on every request (short `CacheService` TTL — 60s — so a price change is live
almost immediately, no redeploy). `index.html` fetches the same catalogue via
`GET ?action=event-types` instead of hardcoding a copy.

## Visual system

Near-black background, dark panel cards, warm gold accent, a serif display
font (Playfair Display) for headings/names and a clean sans-serif (Inter)
for body/UI text — matching the tone of the existing `sarathg.me` site and
its confirmation emails. All four pages (root, `cancel/`, `reschedule/`,
`admin/`) share the same CSS variables so the product feels like one thing as
you move between them.

## Local development

Everything is static — open `index.html` directly in a browser, or serve
the folder with any static file server. You'll need a real `config.js` (see
`config.example.js`) pointing at a deployed Apps Script backend (your local
`Code.gs`, deployed per SETUP.md) for the scheduling flow to actually work
end-to-end; without it, the UI renders but network calls will fail.

Note: `config.js` is referenced from every page as an absolute path
(`/config.js`), since `cancel/`, `reschedule/`, and `admin/` sit one
directory level below the root. If you serve this locally with a static
file server (rather than opening the files directly), serve it rooted at
the repo folder so `/config.js` resolves.

## Repo layout

```
meet-with-sarath/
  index.html             Main scheduler, served at the site root (4 session types → date → time → details → [payment] → confirmed)
  cancel/index.html       Cancel a booking via link from the confirmation email — served at /cancel/
  reschedule/index.html    Move a booking to a new date/time — served at /reschedule/
  admin/index.html         Password-gated dashboard — bookings, event types, coupons — served at /admin/
  config.js               Your real deployment values — gitignored, not committed
  config.example.js       Placeholder shape of config.js, committed
  .nojekyll                Empty file — tells GitHub Pages to skip Jekyll processing
  SETUP.md                  Manual deployment steps (Apps Script, Sheet setup, GitHub Pages, DNS, cutover)
```

`Code.gs` (the Apps Script backend) is deliberately **not** in this tree —
this is a public repo and that file contains a personal calendar email
address, an Outlook calendar ID, and pricing/business logic. Keep it in a
local-only folder outside this repo (e.g. a sibling `gas-backend-local-only/`
folder) and deploy from there — see [SETUP.md](SETUP.md).

See [SETUP.md](SETUP.md) for everything that still needs to happen outside
this repo before the site is live.
