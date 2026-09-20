# Mentorship qualification gate (`/apply/`) — design

Date: 2026-09-21. Scope: `Code.gs` (local-only backend), new `apply/index.html`,
`index.html`, `admin/index.html`, docs.

## 1. Goal

A dedicated landing page for the 1:1 mentorship ad. The ad clicker answers four
screening questions before any calendar is shown. The answer to the last question
routes them:

| Q4 answer | Outcome | What happens |
|---|---|---|
| Option A — "I am ready to invest in 1:1 mentorship if we are a good fit." | `book-intake` | Calendar for the free 15-min **1:1 Career Diagnostic Call** opens; the booking sends **Email 2** |
| Option B — "I want to start with a ₹499 Job Readiness Check (30-min lab/resume assessment)." | `assess` | Sent to the existing paid **Job Readiness Check** focus landing (where the ₹499 is paid) |
| Option C — "I am currently looking for free self-study resources only." | `free-resources` | No calendar. **Email 1** is sent and the page becomes the free-resources page (Foundation Hub, Labs, GetHired) |

All four questions are single-select. Q1 background: certified / IT-SysAdmin-Dev
shifting / fresher-final-year / complete beginner. Q2 bottleneck: freezing on live
targets / unsure of end-to-end VAPT / can't write client-ready reports / rejected at
resume screening. Q3: yes (top priority) / no (casually exploring).

This is **not** a change to `meet.sarathg.me/` — the default booking page, the
public Scoping Call and the current JRC ad landing are untouched.

## 2. Pages and URLs

- `meet.sarathg.me/apply/` — the gate. `noindex`. This is the ad's destination.
  UTM parameters on it are captured and stored with the lead.
- Intake calendar = the existing focus landing for a new **unlisted, gated**
  session type: `/?type=mentorship-intake&focus=1`. Reusing the booking page means
  the Razorpay/coupon-free path, slot grid, timezone display, WhatsApp button and
  all existing tracking come for free.
- ₹499 branch = `/?type=job-readiness-check&focus=1` (already live).

## 3. Session type

`mentorship-intake` — "1:1 Career Diagnostic Call", 15 min, ₹0, Active, **Listed off**.
Created by running `ensureMentorshipIntakeType()` once from the Apps Script editor
(or by hand in admin → Event Types). Its id is in the backend constant
`GATED_EVENT_TYPES`; being in that list is what makes it gated. `GET
?action=event-types` returns `gated: true` for it.

## 4. Enforcement is server-side

A hidden URL is not access control. For any type in `GATED_EVENT_TYPES`,
`handleNewBooking` requires a valid **gate token** and rejects with
`code: 'GATE_REQUIRED'` otherwise. Admin-created bookings are unaffected.

Token = `base64url(JSON{ l: leadId, e: email(lowercase), t: typeId, x: expiryMs })
+ '.' + hex(HMAC-SHA256(payload, ADMIN_TOKEN + '|gate'))`. Stateless, 72-hour life,
bound to the email and the session type. The booking's email must equal the token's
email (the booking form's email field is read-only on a gated booking). No new
Script Property is needed.

## 5. Backend

New tab `Leads` (auto-created): `leadId, createdAt, name, email, background, bottleneck,
goal, commit, outcome, utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
referrer, bookedEventId, bookedType, bookedAt`.

New public action `POST { action:'submit-qualification', name, email, background,
bottleneck, goal, commit, utm{}, referrer, website }`:

- Validates every answer against fixed code sets (below); `website` is a honeypot
  (filled = silently accepted, nothing stored or sent).
- Throttles: max 5 submissions per email per hour (CacheService).
- Appends the lead row, derives `outcome` from `commit`.
- `book-intake` → returns `{ outcome, leadId, gateToken, expiresAt }`.
- `assess` → returns `{ outcome, leadId }`.
- `free-resources` → sends the templated email **at most once per address per 24 h
  and at most 50 per day overall** (so the form can't be used to mail-bomb a third
  party or burn the MailApp quota), returns `{ outcome, emailed }` — `emailed` is
  false when the throttle skipped the send, so the page never claims an email that
  wasn't sent.

Answer codes — background: `certified, it-shift, fresher, beginner`; bottleneck:
`freezing-labs, no-workflow, reports, rejected-screening`; goal: `yes, no`; commit:
`invest, free, assess`.

**Email 1 (free-resources)** — subject "Your Cybersecurity Self-Study Kit & Free
Hands-On Labs"; links `sarathg.me/start`, `labs.sarathg.me`, `gethired.sarathg.me`
and `/apply/` to apply again. **Email 2 (qualified booking)** — subject "Confirmed:
Your 1:1 Cybersecurity Career Diagnostic with Sarath G": date/time, prep asks (resume
or LinkedIn; where they're stuck), laptop/quiet-room note, plus the standard
reschedule/cancel links. Both are chosen in one place (`confirmationEmail()`), so the
admin's "Resend confirmation" sends the same email. Session length in the email
follows the length set in admin.

Booking side effects: on a gated booking the answers are appended to the booking's
`topic` (so they appear in the calendar event, the owner's notification email and
the Bookings row) as a `[Screening] …` line. Whenever a booking carries a `leadId`
whose lead email matches the booking email, that Leads row gets `bookedEventId /
bookedType / bookedAt` (first booking wins) — this is the lead→booking join.

New admin action `admin-list-leads` (newest first). Admin gets a **Leads** tab:
date, name/email, background, stuck-on, goal, outcome badge, campaign, booked?

`emailShell` gains an optional footer argument (the default "Sent because you
booked a session" would be wrong for the free-resources email).

## 6. Front end

`apply/index.html`: same visual system as the other pages (theme toggle, serif/sans,
gold accent). One card, four single-select questions as real radio controls styled as
option tiles, then name + email, then submit. On success it stores
`localStorage.meetLead = { leadId, name, email, outcome }` (and `meetGate = { token,
exp }` for `book-intake`) and navigates same-origin — **no personal data or token in
any URL**.

`index.html` (small changes, only active for gated types / a stored lead):

- Gated type with no valid `meetGate` → `location.replace('/apply/')`.
- Prefills name/email from `meetLead`; email read-only when gated.
- Booking payload carries `gateToken` (gated) and `leadId` (whenever a lead is
  stored) — the latter is how a ₹499 purchase is attributed to its lead.
- `GATE_REQUIRED` from the server clears the stored gate and sends them back.

## 7. Tracking (every step of an ad clicker's journey)

Same three tags as `index.html` are on `/apply/`: GA4 (`G-ML4GP9590F`), Microsoft
Clarity (`yet1lzjxmr`), Meta Pixel (`1131377436123001`, `PageView` on load, automatic
advanced matching picks up the email/name fields). Events fired, in order:

| Moment | Meta Pixel | GA4 | Clarity |
|---|---|---|---|
| Gate loads | `ViewContent` (content_name `Mentorship application`) | `qualification_view` | — |
| First field touched | `QualificationStart` (custom) | `qualification_start` | event |
| Each answer changes | `QualificationAnswer` {question, answer} | `qualification_answer` {question, answer} | — |
| Submit clicked / server rejects | — | `qualification_error` {reason} | — |
| Submit accepted | `SubmitApplication` (standard) + one of below | `qualification_submit` {outcome, lead_id} | tag `lead_outcome`, event |
| Q4 = invest | `QualifiedLead` (custom) | `qualified_lead` | — |
| Q4 = assess | `AssessmentIntent` (custom) | `assessment_intent` | — |
| Q4 = free | `UnqualifiedLead` (custom) | `unqualified_lead` | — |
| Free-resources link clicked | `ResourceClick` (custom) | `resource_click` {resource} | — |

Downstream, the existing `index.html` events continue unchanged (`ViewContent →
InitiateCheckout → Lead / Purchase`; GA4 `view_item → begin_checkout →
generate_lead / purchase`), and the intake booking's `Lead` event is tagged
`content_category: 'qualified-intake'`. Q1–Q3 answers are logged per step so audiences
and reports can be cut by background/bottleneck without touching the Sheet.

Use in Ads Manager: optimise the campaign on `QualifiedLead` (custom conversion), and
build audiences — `QualifiedLead 30d` (lookalike seed), `UnqualifiedLead 90d`
(exclusion), `AssessmentIntent 30d` (retarget with the JRC creative).

## 8. Rollout order

1. Back up `Code.gs`, edit, syntax-check, paste into Apps Script, **new deployment
   version**, run `ensureMentorshipIntakeType()` once.
2. Push the front end to `main` (backend first — `submit-qualification` and
   `admin-list-leads` fall through to `handleNewBooking` on an old backend).
3. Verify the three outcomes on live with a throwaway email, then point the ad at
   `https://meet.sarathg.me/apply/?utm_source=ig&utm_medium=paid&utm_campaign=…`.

## Out of scope

Bot challenge (Turnstile) on the form — add if abuse shows up; automated follow-up
for leads that qualify but never book; A/B variants of the questions; scoring.
