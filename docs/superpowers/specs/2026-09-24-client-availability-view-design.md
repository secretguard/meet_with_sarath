# Client availability view — design

**Date:** 2026-09-24 · **Status:** approved, phase 1 in implementation
**First client:** Brototype (training institution; runs student review sessions of 30–60 min)

---

## 1. Problem

Brototype schedules student review sessions with Sarath. They run their own
scheduling system — they do **not** need to book through meet.sarathg.me. They
only need to *see* when Sarath is free, so they can place reviews in their own
flow.

The requirement generalises: other clients will want the same view, and some of
them will later want to book directly. So this is not a one-off page for one
institution — it is a per-client view whose mode can be flipped.

## 2. Scope

**In (phase 1):** a read-only, per-client availability page; a `Clients` record
with a `mode` field; admin CRUD for clients; a single-call backend endpoint.

**In (phase 1, inert):** `mode: "book"` is storable and togglable in admin and
is returned by the endpoint. The page branches on it but falls back to
view-only rendering, so flipping the toggle early is never a broken state.

**Out (phase 2, deferred until a real client needs it):** the clickable-booking
rendering branch — day expands into start-time chips, compact confirm panel,
POST through the existing booking handler.

**Out (permanently):** per-client hour windows, client logins, any write path
from the client page in phase 1.

## 3. Decisions taken

| Decision | Choice | Why |
|---|---|---|
| What the client does after seeing a slot | Nothing here — they book in their own system | Operator's flow; no write path needed |
| What is displayed | Free **time ranges** per day, not a slot grid | Sessions vary 30–60 min; ranges are duration-agnostic |
| Access control | Readable per-client URL, no login, noindex + robots-excluded | Zero friction; operator accepted guessability |
| URL shape | `/availability/<slug>/` clean path | Operator preference over `?c=` query |
| Slug collisions | Append a short random suffix | Operator instruction |
| Onboarding | Admin panel creates the client; folder stub committed per slug | GitHub Pages needs a real folder |
| Hours source | Existing admin Availability tab — weekly hours, date overrides, horizon | One source of truth, nothing extra per client |
| Buffer | **Not applied** | Operator: "buffer not required as they are seeing my availability slots" |
| Minimum notice | Applied (existing `minNoticeHours` setting) | Matches the booking page |
| Window shown | 4 weeks ahead, capped by `maxDaysAhead` | Operator choice |
| Timezone | IST, plus viewer's local time when it differs | Future non-India clients |
| Booking mode behaviour | Same page, times become clickable | Operator choice; phase 2 |

## 4. Architecture

Nothing in the existing booking flow changes. `buildSlots()` is untouched, so
the public booking page cannot regress from this work.

```
/availability/<slug>/index.html   byte-identical stub per client
                                  – derives slug from location.pathname
                                  – <meta name="robots" content="noindex,nofollow">
                                  – loads /availability/app.js?v= + app.css?v=
/availability/index.html          same shell, no slug → "this link isn't active"
/availability/app.js, app.css     the whole page, shared by every client
/robots.txt                       new file; Disallow: /availability/
```

Because every stub is byte-identical, onboarding a client is copy-folder,
rename, commit — no per-file editing. When `app.js` changes, the `?v=` query
must be bumped in **every** stub in the same commit (`sed` across the folder);
this is the standing Cloudflare rule, and the stub count makes it easy to miss.

## 5. Backend (`Code.gs`)

### New GET action

`GET ?action=client-availability&client=<slug>&days=28`

The slug param is **`client`, not `c`**. Google's frontend rejects a `c` query
param on `script.google.com/macros/.../exec` with an HTTP 400 (`Server: ESF`)
before Apps Script runs at all, so a `c`-based URL fails for every client while
passing every local test. Found by probing the live deployment before going
live, 2026-09-24; both suites now carry a regression guard.

```json
{ "client": { "name": "Brototype", "mode": "view" },
  "timezone": "Asia/Kolkata",
  "generatedAt": "2026-09-24 16:05",
  "days": [
    { "date": "2026-09-24", "ranges": [["09:00","11:30"],["14:00","18:00"]] },
    { "date": "2026-09-25", "ranges": [], "closed": true }
  ] }
```

One `CalendarApp.getEvents()` call spanning the whole window (not one per day),
one Sheets read for availability + settings. Unknown, inactive or missing slug
→ `{ "error": "not-found" }` and the page says the link isn't active, so
deactivating a client in admin kills their link immediately.

The response carries no email, no booking, no topic, no price — only the client's
display name, the mode, and free ranges.

### New function `buildFreeRanges(dateStr, busy, opts)`

Sits beside `buildSlots()`, does not replace it.

1. Resolve the day's windows: date override if present, else the weekday's
   weekly windows. No windows → `{ closed: true, ranges: [] }`.
2. Subtract busy intervals (main calendar + Outlook import, same source as
   `getBusyIntervals`).
3. **No buffer padding.**
4. Clamp the day's start to now + `minNoticeHours`.
5. Drop remaining fragments shorter than `clientMinRangeMins` (new setting,
   default 30).
6. Emit `HH:MM` pairs in IST.

Days beyond `min(days, maxDaysAhead)` are not returned at all.

### New admin POST actions

`admin-list-clients`, `admin-upsert-client` — same `adminToken` body pattern as
every existing admin action. Slug is auto-slugged from the name; a collision
appends a short random suffix. Formula-injection guard applied to client name
and note, as on Leads.

### New Sheet tab `Clients`

`slug, name, mode, eventTypeId, active, createdAt, note`

`mode` ∈ `view` | `book`. `eventTypeId` is unused in phase 1 and read by phase 2.

### New setting

`clientMinRangeMins`, default 30, editable in admin → Availability → Booking rules.

## 6. Admin panel

Sixth tab, **Clients**, built on the same card pattern as Event Types:

- Card per client: name, slug (mono), mode pill (View only / Full booking),
  Active / Inactive pill, **Copy link**, **Edit**.
- Edit form: Name, Slug, Mode toggle, session-type selector (phase 2 use,
  labelled as such), Active toggle, Note, Save / Cancel.
- "+ Add client" opens the same form and, on save, shows the exact folder stub
  that must be committed for the new slug.
- Inactive clients collapse into an "Inactive (N)" group at the bottom.

Hours, overrides and horizon stay in the existing Availability tab — no
per-client hours anywhere.

## 7. The page

- Header: "Availability for <client name>", an "as of <time>" line with a
  refresh control, and a short note that times are live and can change.
- Day rows for 4 weeks. Each row: weekday + date, then the free ranges. IST
  always; the viewer's local equivalent shown alongside only when their UTC
  offset actually differs (compared by offset, not zone name, so Asia/Colombo
  gets no redundant second line). Both lines are forced to the same 12-hour
  format regardless of browser locale.
- When an IST time falls on a different calendar date for the viewer — 9:00 AM
  IST is the previous day in New York — the local line names that date, e.g.
  "11:30 PM – 1:30 AM your time (23 Sep)". Without it the client would be
  pointed at the wrong day.
- Closed days render as "Unavailable" rather than being hidden, so absence
  reads as deliberate rather than as a loading failure.
- Mobile first, matching the site's existing type scale and mint palette.
- No CTA, no WhatsApp button, no analytics.

## 8. Testing

- `smoke_free_ranges.js` — Node, Sheets layer stubbed: windows, date overrides,
  busy subtraction, no-buffer assertion, minimum fragment length, notice
  clamp, horizon cap, closed days.
- `e2e_client_availability.py` — Playwright against a mocked backend: day rows,
  range formatting, dual timezone, closed days, unknown slug, `noindex`
  present, 390 px layout, mode:"book" falls back to view rendering.
- `extract_scripts.py` plus the four existing suites re-run green.

## 9. Deploy order

Backend first, front end second — the standing rule. An unknown admin action
falls through to `handleNewBooking` and errors, so the admin Clients tab must
not reach `main` before `Code.gs` is deployed.

1. Back up `Code.gs` → `Code.gs.bak13`.
2. Operator pastes `Code.gs` into Apps Script → Deploy → New version.
3. Push the front end.
4. Commit the `availability/brototype/` stub.
5. Verify the live link, then send it to Brototype.

## 10. Known limitation — accepted

Brototype books in their own system, so Sarath's Google Calendar does not know
about a review until he adds it. Until he does, that time keeps showing as free
on this page **and** stays bookable on the public booking page — a paying
visitor could take a slot Brototype has planned around. Nothing in this build
prevents that; blocking the time as soon as they confirm is the fix. The page's
"times are live and can change" line is worded with this in mind.
