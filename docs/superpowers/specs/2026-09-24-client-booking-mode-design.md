# Client booking mode (phase 2) — design

**Date:** 2026-09-24 · **Status:** approved, in implementation
**Builds on:** `2026-09-24-client-availability-view-design.md` (phase 1, live)

---

## 1. What changes

Phase 1 shipped a read-only month calendar plus a `mode` field that was
storable but inert. This turns `mode: "book"` into a real booking flow on the
same page and the same URL. View mode is untouched.

The operator's brief: *"the client can book at their names and add guest using
email and choose the time in minutes if I do not mention in the admin panel.
they would have an option choose either in minutes or in hours."*

## 2. Decisions taken

| Decision | Choice |
|---|---|
| Who books | Their own name + email (gets the invite and confirmation), plus optional guest emails |
| Duration when no session type is assigned | Client chooses: 15–120 min, multiples of 15 |
| Unit | Toggle — minutes (15–120, step 15) or hours (0.25–2, step 0.25); both resolve to the same minutes |
| Duration when a session type IS assigned | Fixed by that type; no control shown |
| Payment | Always free. No price, no coupon, no Razorpay |
| Abuse cap | **None, by the operator's explicit choice.** See §7 |
| Buffer | **Not applied** — see §5, this is the one real trade-off |

## 3. The flow

Selecting a day in `book` mode adds a panel under that day's times:

1. **Duration** — stepper plus a minutes/hours unit toggle. Hidden entirely
   when a session type is assigned in admin.
2. **Start times** — derived from that day's free ranges and the chosen
   duration, on a 15-minute grid, offered only where the whole session fits
   inside a range. Rendered as chips in the booking page's `.slot` style.
   Changing the duration recomputes them. If nothing fits, the panel says so
   rather than showing an empty grid.
3. **Details** — name, email, optional guest emails (add/remove rows),
   optional "What's this about?".
4. **Confirm** → success panel naming the date, time and duration.

## 4. Backend

New POST action `client-book`:

```
{ action: "client-book", client: "<slug>", date: "YYYY-MM-DD",
  time: "HH:MM", durationMins: 45,
  name, email, guests: ["a@b.com"], topic }
```

Order of validation — each returns a plain message the panel can show:

1. Client exists and is **active** → else `not-found`.
2. Client is in **`book` mode** → else "This link is view only." A view-mode
   client cannot book even by crafting the request by hand.
3. `name` and `email` present, email well-formed.
4. `guests`: each well-formed, de-duplicated, the booker's own address dropped,
   **max 10** — a sanity bound on the invite, not a policy limit.
5. Duration: the assigned session type's duration if one is set, otherwise
   `durationMins` must be 15–120 and a multiple of 15.
6. The requested start + duration must sit **wholly inside a real free range**
   for that date (§5), which also enforces minimum notice and the horizon.
7. Hand off to the existing `commitBooking`.

`commitBooking` is reused rather than reimplemented — it already holds the
script lock, re-checks availability inside it, creates the calendar event with
invites, emails the operator, emails the attendee, and writes the Bookings row.
Two small seams are added to it:

- `b.extraGuests` — comma-joined into the existing `guests` option, so every
  guest gets the same invite (`sendInvites: true` already set).
- `b.rangeCheck` — makes the in-lock re-check use `isFreeRangeAvailable()`
  instead of `isSlotAvailable()`. Existing callers pass neither and are
  bit-for-bit unaffected.

The booking is recorded with `typeId` = the assigned type, or `client-<slug>`
when the client chose the duration; `source` = `client-<slug>`; price 0.
The calendar event is titled `<Client name> — <booker name>`.

**Cancel and reschedule come free** — `commitBooking` already emails those
links to the booker.

## 5. The buffer trade-off

The view shows ranges with **no buffer** (phase 1, the operator's explicit
choice). `isSlotAvailable()` — used by every existing booking path — applies
the 10-minute buffer and only accepts start times on a grid anchored at the
window start.

Reusing it here would reject times the page just displayed as free: a free
range beginning at 11:07 (a meeting ended then) has no grid slot at 11:07, and
a booking flush against an existing meeting fails the buffer. That is the worst
class of bug on a client-facing page — being told "no" about something you were
just shown.

So client bookings validate with `isFreeRangeAvailable()`: recompute busy
intervals, recompute `buildFreeRanges()` (no buffer), require containment.
**Displayed and accepted therefore agree.** The cost is that a client can book
flush against an existing meeting with no gap. If the operator later wants a
gap, the correct fix is to show *buffered* ranges in book mode so display and
validation still agree — never to validate more strictly than the page shows.

## 6. Side effect worth recording

A client booking creates a real Calendar event, so that time immediately
disappears from this page **and** from the public booking page. This closes the
double-booking gap recorded as the known limitation of phase 1 — but only for
sessions booked through this flow, not for ones the client schedules in their
own system.

## 7. No abuse cap — deliberate

The client URL is guessable by design (it is the client's name), and in `book`
mode it writes to the operator's calendar. A per-client daily cap was offered
and **declined** ("no limit for now").

What still bounds the damage, from existing mechanics rather than new policy:
the 120-minute maximum per booking, the booking horizon, minimum notice, and
the fact that each booking only consumes real free time. A stranger who guesses
a slug could still fill open time and trigger real calendar invites in the
operator's name. Adding a cap later is one field on the `Clients` row plus one
count query — noted here so the option is not lost.

## 8. Tests

`smoke_client_book.js` — mode and active enforcement, duration bounds and step,
assigned-type override, range containment, **a booking flush against an
existing meeting being accepted** (the buffer decision, asserted), notice and
horizon rejection, guest validation/dedup/cap, view-mode rejection, and that
the Bookings row and calendar event carry the right fields.

`e2e_client_book.py` — duration stepper, unit toggle, chips recomputing when
duration changes, "nothing fits" state, guest add/remove, client-side
validation, the posted payload, the success panel, 390 px, and that **view mode
renders none of it**.

Phase 1's suites must keep passing unchanged.

## 9. Deploy order — matters more than last time

Brototype is already in `book` mode on a live link. If the front end merges
first, the panel appears and posts an action the deployed backend does not
know, which falls through to `handleNewBooking` and errors in front of a real
client.

1. Back up `Code.gs` → `Code.gs.bak14`.
2. Operator pastes `Code.gs` → Deploy → New version.
3. **Probe the live `/exec` for `client-book` before merging** — the `c`
   parameter incident proved local tests do not cross Google's frontend.
4. Merge, bump `?v=` in every stub in the same commit, verify live.
