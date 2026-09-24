/* Read-only per-client availability view.
 *
 * Every /availability/<slug>/index.html is a byte-identical stub — the slug
 * comes from the URL path, so onboarding a client is copy-folder-and-rename
 * with no per-file editing. This file is the whole page.
 *
 * View only: it reads ?action=client-availability and renders free time
 * ranges. It never writes anything. `mode` is read and branched on so that
 * when the clickable-booking branch lands (phase 2), flipping a client to
 * "book" in admin is a data change and nothing here has to move.
 */
(function () {
  'use strict';

  // config.js declares `const CONFIG`, which is a script-scope binding and
  // never lands on window — so read the binding, not window.CONFIG.
  var API = (typeof CONFIG !== 'undefined' && CONFIG.API_URL) ? CONFIG.API_URL : '';
  var DAYS = 28;
  var IST_OFFSET_MIN = -330; // getTimezoneOffset() for UTC+05:30

  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var app = document.getElementById('app');
  var errorState = document.getElementById('errorState');

  // ── slug from the path: /availability/<slug>/ ──────────
  function slugFromPath() {
    var parts = location.pathname.split('/').filter(Boolean);
    var i = parts.indexOf('availability');
    if (i === -1) return '';
    return (parts[i + 1] || '').toLowerCase();
  }

  // ── formatting ─────────────────────────────────────────
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  // 'YYYY-MM-DD' → 'Mon, 12 Oct'. Parsed as UTC and read with UTC getters so
  // the viewer's own timezone can never shift the label off by a day.
  function dateLabel(dateStr) {
    var d = new Date(dateStr + 'T00:00:00Z');
    return WEEKDAYS[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  }

  function hhmmToParts(hhmm) {
    var bits = String(hhmm).split(':');
    return { h: Number(bits[0]), m: Number(bits[1]) };
  }

  // IST wall-clock, formatted without any timezone maths — the backend has
  // already done that work and these strings are what Sarath's day looks like.
  function istLabel(hhmm) {
    var p = hhmmToParts(hhmm);
    var suffix = p.h >= 12 ? 'PM' : 'AM';
    var hour = p.h % 12 === 0 ? 12 : p.h % 12;
    return hour + ':' + pad2(p.m) + ' ' + suffix;
  }

  // The actual instant an IST wall-clock time refers to, so we can re-render
  // it in the viewer's timezone.
  function instant(dateStr, hhmm) {
    var p = hhmmToParts(hhmm);
    return new Date(dateStr + 'T' + pad2(p.h) + ':' + pad2(p.m) + ':00+05:30');
  }

  // Forced to en-US so the viewer's line reads in the same 12-hour style as
  // the IST line beside it, whatever their browser locale is.
  function localLabel(d) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // The viewer's own calendar date for an instant, as 'YYYY-MM-DD'.
  function localDateKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // 9:00 AM IST is the previous day in New York. Showing "11:30 PM" with no
  // date would send the client to the wrong day, so when the viewer's date
  // differs from the IST date we name theirs.
  function localDateSuffix(dateStr, startInstant) {
    var key = localDateKey(startInstant);
    if (key === dateStr) return '';
    var d = new Date(key + 'T00:00:00Z');
    return ' (' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ')';
  }

  // Only worth showing a second timezone if the viewer is actually in one.
  // Compares the real offset rather than the zone name, so Asia/Colombo (also
  // +05:30) doesn't get a redundant duplicate line.
  function viewerIsElsewhere(dateStr) {
    return new Date(dateStr + 'T12:00:00+05:30').getTimezoneOffset() !== IST_OFFSET_MIN;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ── rendering ──────────────────────────────────────────
  function renderDay(day, index) {
    var row = el('div', 'day-row');

    var label = el('div', 'day-label');
    var name = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : WEEKDAYS[new Date(day.date + 'T00:00:00Z').getUTCDay()];
    label.appendChild(el('span', 'day-name', name));
    label.appendChild(el('span', 'day-date', dateLabel(day.date)));
    row.appendChild(label);

    var times = el('div', 'day-times');
    var ranges = day.ranges || [];

    if (!ranges.length) {
      row.classList.add('is-empty');
      // "Unavailable" (no hours at all that day) and "No open time" (open, but
      // every hour is taken) are different facts and say different things to
      // someone trying to place a session.
      times.appendChild(el('span', 'day-empty', day.closed ? 'Unavailable' : 'No open time'));
    } else {
      var showLocal = viewerIsElsewhere(day.date);
      ranges.forEach(function (r) {
        var range = el('div', 'range');
        range.appendChild(el('span', 'range-ist', istLabel(r[0]) + ' – ' + istLabel(r[1]) + ' IST'));
        if (showLocal) {
          var from = instant(day.date, r[0]);
          var to = instant(day.date, r[1]);
          range.appendChild(el('span', 'range-local',
            localLabel(from) + ' – ' + localLabel(to) + ' your time' + localDateSuffix(day.date, from)));
        }
        times.appendChild(range);
      });
    }

    row.appendChild(times);
    return row;
  }

  function renderPage(data) {
    app.innerHTML = '';

    var head = el('div', 'head');
    head.appendChild(el('div', 'avatar', 'SG'));
    var titles = el('div');
    titles.appendChild(el('h1', null, 'Availability for ' + data.client.name));
    head.appendChild(titles);
    app.appendChild(head);

    app.appendChild(el('p', 'sub', 'Open time in Sarath G’s calendar over the next four weeks.'));

    var meta = el('div', 'meta');
    var asOf = el('span', null, 'Updated ' + (data.generatedAt || '') + ' IST');
    asOf.id = 'asOf';
    meta.appendChild(asOf);
    var refresh = el('button', null, 'Refresh');
    refresh.id = 'refreshBtn';
    refresh.type = 'button';
    refresh.addEventListener('click', function () { load(true); });
    meta.appendChild(refresh);
    meta.appendChild(el('span', 'muted', 'Times are live and can change.'));
    app.appendChild(meta);

    var days = el('div', 'days');
    (data.days || []).forEach(function (day, i) { days.appendChild(renderDay(day, i)); });
    app.appendChild(days);

    app.appendChild(el('p', 'foot', 'Sarath G · meet.sarathg.me'));

    document.title = 'Availability for ' + data.client.name + ' — Sarath G';
  }

  function showError() {
    app.innerHTML = '';
    errorState.innerHTML = '';
    errorState.appendChild(el('h2', null, 'This link isn’t active'));
    errorState.appendChild(el('p', null, 'Check the address, or ask Sarath for a current link.'));
    errorState.hidden = false;
  }

  // ── load ───────────────────────────────────────────────
  var loading = false;
  function load(isRefresh) {
    var slug = slugFromPath();
    if (!slug || !API) { showError(); return; }
    if (loading) return;
    loading = true;

    var btn = document.getElementById('refreshBtn');
    if (btn) btn.disabled = true;

    fetch(API + '?action=client-availability&c=' + encodeURIComponent(slug) + '&days=' + DAYS)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        loading = false;
        if (!data || data.error || !data.client) { showError(); return; }
        errorState.hidden = true;
        // mode 'book' is phase 2. Until that branch exists it renders exactly
        // like 'view', so flipping the toggle early is never a broken page.
        renderPage(data);
      })
      .catch(function () {
        loading = false;
        var btn2 = document.getElementById('refreshBtn');
        if (btn2) btn2.disabled = false;
        if (!isRefresh) showError();
      });
  }

  load(false);
})();
