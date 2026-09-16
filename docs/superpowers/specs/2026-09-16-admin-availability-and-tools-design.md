# Admin-controlled availability, bookings table fix, attended/stats/admin-booking/CSV — design

Date: 2026-09-16. Scope: `Code.gs` (local-only backend), `admin/index.html`,
`index.html`, `reschedule/index.html`, docs.

## 1. Availability model

Two new Sheet tabs, auto-created/migrated like the others (`getOrCreateSheet`).

**`Availability`** — `key, enabled, windows, note`
- `key` is `mon`..`sun` (weekly template) or `YYYY-MM-DD` (date override).
- `enabled` FALSE = day off / date blocked. TRUE + `windows` = bookable ranges.
- `windows` = comma-separated `HH:MM-HH:MM` (24h IST), e.g. `09:00-12:00, 14:00-20:00`.
- A date row always wins over its weekday row.
- Seeded: all seven weekdays enabled, `09:00-20:00` (today's behaviour).

**`Settings`** — `key, value`: `minNoticeHours` (4), `bufferMins` (10).
`MIN_NOTICE_HOURS` / `BUFFER_MINS` constants remain only as seed defaults.

`getAvailability()` / `getSettings()` are cached 60s (CacheService) like event
types; admin writes invalidate. `windowsForDate(dateStr)` resolves
override → weekday → `[]`. `buildSlots()` walks each window in
`SLOT_STEP_MINS` steps, slot must end inside the window; buffer and notice
rules unchanged but read from Settings.

Validation on write: each window matches `^\d{2}:\d{2}-\d{2}:\d{2}$`,
start < end, windows sorted and non-overlapping.

API (all admin actions require `adminToken`):
- `admin-get-availability` → `{ weekly: {mon:{enabled,windows,note}...}, overrides:[{date,enabled,windows,note}] }`
- `admin-save-weekly` `{ weekly }` — replaces all 7 weekday rows.
- `admin-upsert-date-override` `{ date, enabled, windows, note }`
- `admin-delete-date-override` `{ date }`
- `admin-get-settings` / `admin-save-settings` `{ settings: {minNoticeHours, bufferMins} }`
- public `GET ?action=availability` → `{ offWeekdays:[0..6], blockedDates:['YYYY-MM-DD'] }`
  (no hours exposed) — booking calendars grey those days out.
- `GET ?date=&eventType=&adminToken=` — with a valid admin token the
  minimum-notice window is bypassed (still respects availability windows,
  calendar busy blocks and buffer). Used by the admin reschedule/booking modals.

## 2. Admin panel

- **Availability tab**: weekly grid (on/off + N time-range rows per day, one
  Save), date overrides (list of upcoming + add form with "block whole day"),
  booking rules (min notice, buffer).
- **Bookings table**: 10 → 7 columns (Created under client, Duration under
  Type, Paid+Coupon merged), wrapping allowed, sticky right actions column,
  card layout under 760px. Same sticky/wrap treatment for the other tables.

## 3. Additional features

- **Mark attended** — `admin-mark-attended { eventId }`: past
  confirmed/rescheduled → status `completed`. Row menu item; status filter and
  badge. No email.
- **Overview stats** — `admin-stats { month: 'YYYY-MM' }` computed from the
  Bookings sheet: bookings (non-cancelled) in month, revenue (sum
  `pricePaidPaise`, non-cancelled), completed, no-shows, no-show rate
  (`no-show / (completed + no-show)`), most-booked type, upcoming (confirmed/
  rescheduled with start ≥ now, any month). Rendered as a stat strip at the top
  of the Bookings tab with a month picker.
- **Book on behalf of a client** — `admin-create-booking { eventType, date,
  time, name, email, topic, payment: 'waived'|'offline' }`. Reuses the
  new-booking path (lock, re-check, calendar event, confirmation email, sheet
  row) minus Razorpay. Row gets `source = admin` (new Bookings column; web
  bookings write `web`), `pricePaidPaise` = type price when `offline`, 0 when
  `waived`. Admin modal: type → date → slot (notice bypassed) → client details
  → payment choice → Book.
- **CSV export** — client-side from the currently filtered bookings list;
  filename `bookings-<from>-<to>.csv`, all sheet columns.

## Out of scope
Per-type availability, editable email templates, blocklist, Meet links.
