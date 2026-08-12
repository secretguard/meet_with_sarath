# Meet with Sarath

A standalone, multi-event-type booking scheduler for Sarath G, intended to be
hosted at `meet.sarathg.me` (GitHub Pages, separate repo from the main
`sarathg.me` site).

This replaces the old single-event `sarathg.me/booking.html` with a scheduler
that supports four session types, each with its own duration and price:

| Session | Duration | Price |
|---|---|---|
| Scoping Call | 30 min | Free |
| Basic Career Advice | 15 min | Free |
| Mentorship Session | 60 min | ₹2,500 (placeholder) |
| Resume Review & Career Advice | 45 min | ₹1,500 (placeholder) |

## How the pieces fit together

- **Front end** (this repo, static HTML/CSS/JS) — `booking.html`, `cancel.html`,
  `reschedule.html`, `index.html`. No build step, no framework, no dependencies
  beyond Google Fonts and (for paid bookings) Razorpay's `checkout.js`.
- **Backend** — `gas/Code.gs`, a Google Apps Script Web App. It owns calendar
  availability, booking creation/cancellation/reschedule, Razorpay order
  creation + payment signature verification, confirmation emails, and
  reminder emails. It is kept here for version control only — see
  [SETUP.md](SETUP.md) for how to actually deploy it.
- **Config** — `config.js` (gitignored, holds your real deployment URL and
  Razorpay public key) and `config.example.js` (committed, shows the shape).
  Every HTML page loads `config.js` before its own script and reads
  `CONFIG.API_URL` / `CONFIG.RAZORPAY_KEY_ID`.

## API contract (front end ↔ Apps Script)

The front end talks to `CONFIG.API_URL` exactly as follows — this must stay
in sync with `gas/Code.gs`:

- `GET  ?date=YYYY-MM-DD&eventType={id}` → `{ date, eventType, slots: [...] }`
- `POST { action: 'create-order', eventType }` → `{ orderId, amount, currency, keyId }`
  (paid event types only, called before opening Razorpay Checkout)
- `POST { date, time, name, email, topic, eventType, [razorpayOrderId, razorpayPaymentId, razorpaySignature] }`
  → `{ success: true, eventId, message }` or `{ error }`
  (the payment fields are only included/required for paid event types)
- `POST { action: 'cancel', eventId, email }` → `{ success: true }` or `{ error }`
- `POST { action: 'reschedule', eventId, email, newDate, newTime }` → `{ success: true, eventId }` or `{ error }`

Note: POST requests are sent **without** an explicit `Content-Type` header on
purpose. Setting one triggers a CORS preflight (`OPTIONS`) request, which
Apps Script Web Apps don't handle — the request silently fails. `e.postData.contents`
on the Apps Script side parses the raw body regardless of content type, so
this is safe.

## Event type catalogue — keep two copies in sync

Session names, durations, and prices are defined in **two places** that must
match:

- `gas/Code.gs` → `EVENT_TYPES` (price in **paise**, used for real charges)
- `booking.html` → `EVENT_TYPES` (price in **rupees**, display only)

If you change a price or add a session type, update both.

## Visual system

Near-black background, dark panel cards, warm gold accent, a serif display
font (Playfair Display) for headings/names and a clean sans-serif (Inter)
for body/UI text — matching the tone of the existing `sarathg.me` site and
its confirmation emails. All four pages (`booking`, `cancel`, `reschedule`,
`index`) share the same CSS variables so the product feels like one thing as
you move between them.

## Local development

Everything is static — open `booking.html` directly in a browser, or serve
the folder with any static file server. You'll need a real `config.js` (see
`config.example.js`) pointing at a deployed Apps Script backend for the
scheduling flow to actually work end-to-end; without it, the UI renders but
network calls will fail.

## Repo layout

```
meet-with-sarath/
  booking.html         Main scheduler (4 session types → date → time → details → [payment] → confirmed)
  cancel.html           Cancel a booking via link from the confirmation email
  reschedule.html        Move a booking to a new date/time
  index.html            Redirects to booking.html (subdomain root)
  config.js              Your real deployment values — gitignored, not committed
  config.example.js      Placeholder shape of config.js, committed
  gas/Code.gs            Backend reference copy (deploy manually — see SETUP.md)
  SETUP.md                Manual deployment steps (Apps Script, GitHub Pages, DNS, cutover)
```

See [SETUP.md](SETUP.md) for everything that still needs to happen outside
this repo before the site is live.
