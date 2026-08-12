# SETUP.md — manual steps to take this live

Nothing in this repo has been deployed, pushed, or configured against any
live service. Everything below is a manual step for you to run yourself,
in order.

---

## 1. Deploy `gas/Code.gs` as an Apps Script Web App

1. Go to [script.google.com](https://script.google.com), create a new
   project (or reuse an existing one), and paste the contents of
   `gas/Code.gs` in as `Code.gs`.
2. **Script Properties** — Project Settings (gear icon) → Script Properties →
   add:
   - `RAZORPAY_KEY_ID` = your Razorpay key id (`rzp_test_...` while testing,
     `rzp_live_...` for real charges)
   - `RAZORPAY_KEY_SECRET` = your Razorpay key secret

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

## 2. Add the two time-driven triggers

Apps Script editor → **Triggers** (clock icon in the left sidebar) → **Add
Trigger**, twice:

1. Function: `sendDayBeforeReminders`
   Event source: Time-driven → Day timer → 7am–8am (or your preferred window)
2. Function: `sendHourBeforeReminders`
   Event source: Time-driven → Minutes timer → Every 15 minutes

Both functions already exist in `Code.gs` — this step just wires them up to
run automatically. Without this, bookings still work, but no reminder emails
go out.

## 3. GitHub Pages for this repo

This repo is currently local-only (`git init`, no remote). When you're ready:

1. Create a **new, empty** GitHub repository (e.g. `meet-with-sarath`) —
   do not reuse the `sarathg.me` repo.
2. From this folder:
   ```bash
   git remote add origin https://github.com/<your-username>/meet-with-sarath.git
   git branch -M main
   git push -u origin main
   ```
3. In the new repo's GitHub settings → **Pages** → set source to the `main`
   branch, root folder.
4. Add a `CNAME` file at the repo root containing exactly:
   ```
   meet.sarathg.me
   ```
   (GitHub Pages reads this file to know which custom domain to serve.)

## 4. DNS (Cloudflare)

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

## 5. Cutover — LATER, NOT NOW

Do not do any of this until you've personally tested the new
`meet.sarathg.me` site end-to-end (a real free booking, a real cancel, and
ideally a real ₹1 test-mode paid booking) and are happy with it.

- [ ] Replace "Book a consultation" / booking links in the `sarathg.me` nav
      and footer (across all pages that link to the old booking flow) to
      point at `https://meet.sarathg.me` instead of `sarathg.me/booking.html`.
- [ ] Decide what happens to the old `sarathg.me/booking.html`: leave it as
      a dead page, replace its content with a redirect/forwarding notice
      pointing to `meet.sarathg.me`, or remove it outright.
- [ ] Double check any old confirmation emails already sent (from the old
      backend, if it's a different Apps Script deployment) don't contain
      cancel/reschedule links that silently break — either keep that old
      deployment alive read-only for existing bookings, or migrate/honor
      those links.
- [ ] Once traffic has fully moved, consider updating `buildCancelUrl` /
      `buildRescheduleUrl` in `gas/Code.gs` (currently pointed at
      `sarathg.me/cancel.html` and `sarathg.me/reschedule.html`) to point at
      `meet.sarathg.me` instead, and redeploy.

None of this is done automatically — it's a checklist for you to work
through once you've verified the new site yourself.
