/* Read-only per-client availability view.
 *
 * Every /availability/<slug>/index.html is a byte-identical stub — the slug
 * comes from the URL path, so onboarding a client is copy-folder-and-rename
 * with no per-file editing. This file is the whole page.
 *
 * View only: it reads ?action=client-availability and renders a month
 * calendar of free time. It never writes anything. `mode` is read and
 * branched on so that when the clickable-booking branch lands (phase 2),
 * flipping a client to "book" in admin is a data change and nothing here
 * has to move.
 *
 * The calendar deliberately reuses the booking page's classes
 * (.cal-nav / .weekdays / .days / .day) so both pages look like one site.
 */
(function () {
  'use strict';

  // config.js declares `const CONFIG`, which is a script-scope binding and
  // never lands on window — so read the binding, not window.CONFIG.
  var API = (typeof CONFIG !== 'undefined' && CONFIG.API_URL) ? CONFIG.API_URL : '';
  var DAYS = 28;
  var IST_OFFSET_MIN = -330; // getTimezoneOffset() for UTC+05:30

  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var WD_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

  var app = document.getElementById('app');
  var errorState = document.getElementById('errorState');

  var state = { data: null, byDate: {}, months: [], monthIdx: 0, selected: null, today: null };

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

  function monthLabel(ym) {
    return MONTHS_FULL[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
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

  // ── page shell ─────────────────────────────────────────
  function buildShell(data) {
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

    var cal = el('div', 'cal');
    var nav = el('div', 'cal-nav');
    nav.appendChild(navButton('calPrev', '‹', 'Previous month', -1));
    var label = el('div', 'cal-month');
    label.id = 'calMonth';
    nav.appendChild(label);
    nav.appendChild(navButton('calNext', '›', 'Next month', 1));
    cal.appendChild(nav);

    var wd = el('div', 'weekdays');
    WD_SHORT.forEach(function (w) { wd.appendChild(el('div', 'wd', w)); });
    cal.appendChild(wd);

    var grid = el('div', 'days');
    grid.id = 'calDays';
    cal.appendChild(grid);
    app.appendChild(cal);

    app.appendChild(buildLegend());

    var detail = el('div', 'detail');
    detail.id = 'dayDetail';
    app.appendChild(detail);

    app.appendChild(el('p', 'foot', 'Sarath G · meet.sarathg.me'));
    document.title = 'Availability for ' + data.client.name + ' — Sarath G';
  }

  function navButton(id, glyph, label, delta) {
    var b = el('button', 'nav-btn', glyph);
    b.id = id;
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.addEventListener('click', function () {
      var next = state.monthIdx + delta;
      if (next < 0 || next >= state.months.length) return;
      state.monthIdx = next;
      renderMonth();
    });
    return b;
  }

  // Three greys need explaining, or an empty-looking month reads as a broken
  // page rather than a full one.
  function buildLegend() {
    var legend = el('div', 'legend');
    legend.id = 'calLegend';

    var a = el('span', 'lg');
    a.appendChild(el('span', 'day-dot'));
    a.appendChild(el('span', null, 'open time'));

    var b = el('span', 'lg');
    b.appendChild(el('span', 'lg-swatch closed'));
    b.appendChild(el('span', null, 'not working'));

    var c = el('span', 'lg');
    c.appendChild(el('span', 'lg-swatch full'));
    c.appendChild(el('span', null, 'no open time'));

    legend.appendChild(a);
    legend.appendChild(b);
    legend.appendChild(c);
    return legend;
  }

  // ── calendar ───────────────────────────────────────────
  function renderMonth() {
    var ym = state.months[state.monthIdx];
    document.getElementById('calMonth').textContent = monthLabel(ym);
    document.getElementById('calPrev').disabled = state.monthIdx <= 0;
    document.getElementById('calNext').disabled = state.monthIdx >= state.months.length - 1;

    var grid = document.getElementById('calDays');
    grid.innerHTML = '';

    var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
    var firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    var daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

    for (var i = 0; i < firstDow; i++) grid.appendChild(el('div', 'day empty'));
    for (var n = 1; n <= daysInMonth; n++) grid.appendChild(dayCell(ym + '-' + pad2(n), n));
  }

  function dayCell(key, n) {
    var day = state.byDate[key];

    // Outside the four-week window — earlier this month, or past the horizon.
    // Still drawn with its number, just dimmed: blanking these out leaves a
    // void at the top of the grid that reads as a broken page rather than a
    // month that has already partly gone by.
    if (!day) {
      var out = el('div', 'day out');
      out.appendChild(el('span', 'day-num', String(n)));
      return out;
    }

    var cell = el('div', 'day');
    cell.setAttribute('data-date', key);
    cell.appendChild(el('span', 'day-num', String(n)));
    if (key === state.today) cell.classList.add('today');

    if (day.closed) {
      cell.classList.add('closed');
      cell.title = 'Not working';
    } else if (!(day.ranges || []).length) {
      cell.classList.add('full');
      cell.title = 'No open time';
    } else {
      cell.classList.add('has-free');
      cell.appendChild(el('span', 'day-dot'));
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      cell.addEventListener('click', function () { select(key); });
      cell.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(key); }
      });
    }

    if (key === state.selected) cell.classList.add('selected');
    return cell;
  }

  function select(key) {
    state.selected = key;
    renderMonth();
    renderDetail();
  }

  // ── the selected day's times ───────────────────────────
  function renderDetail() {
    var box = document.getElementById('dayDetail');
    box.innerHTML = '';

    var day = state.selected ? state.byDate[state.selected] : null;
    if (!day) {
      box.appendChild(el('p', 'day-empty', 'No open time in the next four weeks.'));
      return;
    }

    box.appendChild(el('div', 'detail-date', dateLabel(day.date)));

    var ranges = day.ranges || [];
    if (!ranges.length) {
      box.appendChild(el('span', 'day-empty', day.closed ? 'Unavailable' : 'No open time'));
      return;
    }

    var showLocal = viewerIsElsewhere(day.date);
    var list = el('div', 'detail-ranges');
    ranges.forEach(function (r) {
      var range = el('div', 'range');
      range.appendChild(el('span', 'range-ist', istLabel(r[0]) + ' – ' + istLabel(r[1]) + ' IST'));
      if (showLocal) {
        var from = instant(day.date, r[0]);
        var to = instant(day.date, r[1]);
        range.appendChild(el('span', 'range-local',
          localLabel(from) + ' – ' + localLabel(to) + ' your time' + localDateSuffix(day.date, from)));
      }
      list.appendChild(range);
    });
    box.appendChild(list);
  }

  // ── render ─────────────────────────────────────────────
  function renderPage(data) {
    state.data = data;
    state.byDate = {};
    state.months = [];

    (data.days || []).forEach(function (day) {
      state.byDate[day.date] = day;
      var ym = day.date.slice(0, 7);
      if (state.months.indexOf(ym) === -1) state.months.push(ym);
    });
    state.months.sort();

    // The backend's first row IS today in IST — trust it rather than the
    // viewer's clock, which may be a day off in another timezone.
    state.today = (data.days && data.days.length) ? data.days[0].date : null;

    // Land on the first day that actually has open time, so the page never
    // opens on an empty detail strip.
    var firstFree = (data.days || []).filter(function (x) { return (x.ranges || []).length; })[0];
    state.selected = firstFree ? firstFree.date : null;
    state.monthIdx = state.selected ? Math.max(0, state.months.indexOf(state.selected.slice(0, 7))) : 0;

    buildShell(data);
    renderMonth();
    renderDetail();
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

    // The param is `client`, not `c` — Google's frontend 400s a `c` query
    // param on /exec before Apps Script ever sees the request.
    fetch(API + '?action=client-availability&client=' + encodeURIComponent(slug) + '&days=' + DAYS)
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
