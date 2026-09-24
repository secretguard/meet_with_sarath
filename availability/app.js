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

  var state = {
    data: null, byDate: {}, months: [], monthIdx: 0, selected: null, today: null,
    // Booking mode (phase 2). `form` survives re-renders so switching days
    // doesn't wipe what the client already typed. `done` holds the last
    // confirmed booking so the success panel survives a refresh.
    book: {
      durationMins: 60, unit: 'minutes', startMins: null, busy: false, error: '',
      form: { name: '', email: '', topic: '', guests: [] },
      done: null
    }
  };

  var BOOK_MIN = 15, BOOK_MAX = 120, BOOK_STEP = 15, BOOK_MAX_GUESTS = 10;

  // `bookingEnabled` is sent only by a backend that actually implements
  // client-book. Requiring it means this page can ship before the backend is
  // deployed without ever showing a client a form that would fail: an older
  // backend still returns mode:'book', so mode alone is not proof.
  function isBookMode() {
    var c = state.data && state.data.client;
    return !!(c && c.mode === 'book' && c.bookingEnabled === true);
  }
  // A session type assigned in admin fixes the length; the client is then not
  // asked to choose one.
  function fixedDuration() {
    var d = state.data && state.data.client && state.data.client.durationMins;
    return d ? Number(d) : 0;
  }
  function activeDuration() {
    return fixedDuration() || state.book.durationMins;
  }

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

    if (isBookMode()) box.appendChild(buildBookPanel(day));
  }

  // ── booking mode (phase 2) ─────────────────────────────
  function hhmmToMins(hhmm) {
    var p = hhmmToParts(hhmm);
    return p.h * 60 + p.m;
  }
  function minsLabel(mins) {
    return istLabel(pad2(Math.floor(mins / 60)) + ':' + pad2(mins % 60));
  }

  // Every quarter-hour start at which the whole session still fits inside one
  // of the day's free ranges. A range that begins at 11:07 starts offering
  // 11:15 — the grid is rounded up, never into the busy block before it.
  function startOptions(day, durationMins) {
    var starts = [];
    (day.ranges || []).forEach(function (r) {
      var rs = hhmmToMins(r[0]), re = hhmmToMins(r[1]);
      var first = Math.ceil(rs / BOOK_STEP) * BOOK_STEP;
      for (var s = first; s + durationMins <= re; s += BOOK_STEP) starts.push(s);
    });
    return starts;
  }

  function field(labelText, id, type, value, placeholder) {
    var wrap = el('div', 'field');
    var lab = el('label', null, labelText);
    lab.setAttribute('for', id);
    var input = el('input');
    input.id = id;
    input.type = type;
    input.value = value || '';
    if (placeholder) input.placeholder = placeholder;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  function buildBookPanel(day) {
    var panel = el('div', 'book-panel');
    panel.id = 'bookPanel';

    // Already booked this day in this session — show the receipt, not the form.
    var done = state.book.done;
    if (done && done.date === day.date) {
      var ok = el('div', 'book-success');
      ok.id = 'bookSuccess';
      ok.appendChild(el('div', 'book-success-title', 'Booked'));
      ok.appendChild(el('p', null,
        dateLabel(done.date) + ' at ' + minsLabel(done.startMins) +
        ' IST · ' + done.durationMins + ' min. A calendar invite is on its way.'));
      var again = el('button', 'ghost-btn', 'Book another');
      again.type = 'button';
      again.addEventListener('click', function () { state.book.done = null; renderDetail(); });
      ok.appendChild(again);
      panel.appendChild(ok);
      return panel;
    }

    panel.appendChild(el('div', 'book-title', 'Book this day'));

    // ── duration ──
    if (!fixedDuration()) {
      var durRow = el('div', 'dur-row');
      var durField = el('div', 'field');
      durField.appendChild(el('label', null, 'Length'));

      var stepper = el('div', 'stepper');
      var minus = el('button', 'step-btn', '−');
      minus.type = 'button';
      minus.setAttribute('aria-label', 'Shorter');
      var input = el('input');
      input.id = 'durValue';
      input.type = 'number';
      var hours = state.book.unit === 'hours';
      input.min = hours ? 0.25 : BOOK_MIN;
      input.max = hours ? BOOK_MAX / 60 : BOOK_MAX;
      input.step = hours ? 0.25 : BOOK_STEP;
      input.value = hours ? String(state.book.durationMins / 60) : String(state.book.durationMins);
      var plus = el('button', 'step-btn', '+');
      plus.type = 'button';
      plus.setAttribute('aria-label', 'Longer');

      minus.addEventListener('click', function () { nudgeDuration(-BOOK_STEP); });
      plus.addEventListener('click', function () { nudgeDuration(BOOK_STEP); });
      input.addEventListener('input', function () {
        var raw = Number(input.value);
        if (isNaN(raw)) return;
        setDuration(state.book.unit === 'hours' ? Math.round(raw * 60) : Math.round(raw));
      });

      stepper.appendChild(minus);
      stepper.appendChild(input);
      stepper.appendChild(plus);
      durField.appendChild(stepper);
      durRow.appendChild(durField);

      // minutes / hours — the operator's ask: let them work in whichever unit suits
      var units = el('div', 'unit-toggle');
      ['minutes', 'hours'].forEach(function (u) {
        var lab = el('label', 'unit-opt');
        var radio = el('input');
        radio.type = 'radio';
        radio.name = 'durUnit';
        radio.value = u;
        radio.checked = state.book.unit === u;
        radio.addEventListener('change', function () {
          if (!radio.checked) return;
          state.book.unit = u;
          renderDetail();
        });
        lab.appendChild(radio);
        lab.appendChild(el('span', null, u));
        units.appendChild(lab);
      });
      durRow.appendChild(units);
      panel.appendChild(durRow);
    }

    // ── start times ──
    var starts = startOptions(day, activeDuration());
    if (!starts.length) {
      panel.appendChild(el('p', 'book-note',
        'No ' + activeDuration() + '-minute session fits in this day’s open time. Try a shorter length or another day.'));
      return panel;
    }

    if (state.book.startMins === null || starts.indexOf(state.book.startMins) === -1) {
      state.book.startMins = null;
    }

    var grid = el('div', 'slots-grid');
    starts.forEach(function (s) {
      var chip = el('button', 'slot' + (state.book.startMins === s ? ' selected' : ''), minsLabel(s));
      chip.type = 'button';
      chip.addEventListener('click', function () {
        state.book.startMins = s;
        state.book.error = '';
        renderDetail();
      });
      grid.appendChild(chip);
    });
    panel.appendChild(grid);

    // ── who ──
    var form = el('div', 'book-form');
    form.appendChild(field('Your name', 'bkName', 'text', state.book.form.name, 'Arjun M'));
    form.appendChild(field('Your email', 'bkEmail', 'email', state.book.form.email, 'you@example.com'));

    var guestsWrap = el('div', 'field span-all');
    guestsWrap.appendChild(el('label', null, 'Add guests (optional)'));
    var guestList = el('div');
    guestList.id = 'guestList';
    state.book.form.guests.forEach(function (g, i) { guestList.appendChild(guestRow(g, i)); });
    guestsWrap.appendChild(guestList);
    var addGuest = el('button', 'ghost-btn', '+ Add guest');
    addGuest.id = 'addGuestBtn';
    addGuest.type = 'button';
    addGuest.addEventListener('click', function () {
      readForm();
      if (state.book.form.guests.length >= BOOK_MAX_GUESTS) return;
      state.book.form.guests.push('');
      renderDetail();
    });
    guestsWrap.appendChild(addGuest);
    form.appendChild(guestsWrap);

    form.appendChild(field('What’s this about? (optional)', 'bkTopic', 'text', state.book.form.topic, 'Batch 14 review'));
    panel.appendChild(form);

    var err = el('p', 'book-error', state.book.error);
    err.id = 'bookError';
    if (!state.book.error) err.hidden = true;
    panel.appendChild(err);

    var submit = el('button', 'book-submit', state.book.busy ? 'Booking…' : 'Confirm booking');
    submit.id = 'bookSubmit';
    submit.type = 'button';
    submit.disabled = !!state.book.busy;
    submit.addEventListener('click', function () { submitBooking(day); });
    panel.appendChild(submit);

    return panel;
  }

  function guestRow(value, index) {
    var row = el('div', 'guest-row');
    var input = el('input');
    input.type = 'email';
    input.value = value || '';
    input.placeholder = 'guest@example.com';
    var rm = el('button', 'guest-remove', '×');
    rm.type = 'button';
    rm.setAttribute('aria-label', 'Remove guest');
    rm.addEventListener('click', function () {
      readForm();
      state.book.form.guests.splice(index, 1);
      renderDetail();
    });
    row.appendChild(input);
    row.appendChild(rm);
    return row;
  }

  function setDuration(mins) {
    var snapped = Math.round(mins / BOOK_STEP) * BOOK_STEP;
    if (snapped < BOOK_MIN) snapped = BOOK_MIN;
    if (snapped > BOOK_MAX) snapped = BOOK_MAX;
    if (snapped === state.book.durationMins) return;
    state.book.durationMins = snapped;
    state.book.startMins = null; // the old start may no longer fit
    readForm();
    renderDetail();
  }
  function nudgeDuration(delta) {
    readForm();
    setDuration(state.book.durationMins + delta);
  }

  // Pull whatever is currently typed into state before any re-render.
  function readForm() {
    var n = document.getElementById('bkName');
    var e2 = document.getElementById('bkEmail');
    var t = document.getElementById('bkTopic');
    if (n) state.book.form.name = n.value;
    if (e2) state.book.form.email = e2.value;
    if (t) state.book.form.topic = t.value;
    var list = document.getElementById('guestList');
    if (list) {
      state.book.form.guests = Array.prototype.map.call(
        list.querySelectorAll('input'), function (i) { return i.value; });
    }
  }

  function looksLikeEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
  }

  function submitBooking(day) {
    readForm();
    var f = state.book.form;
    var fail = function (msg) { state.book.error = msg; renderDetail(); };

    if (state.book.startMins === null) return fail('Please pick a start time.');
    if (!f.name.trim()) return fail('Please enter your name.');
    if (!looksLikeEmail(f.email)) return fail('Please enter a valid email address.');

    var guests = [];
    for (var i = 0; i < f.guests.length; i++) {
      var g = String(f.guests[i] || '').trim();
      if (!g) continue;
      if (!looksLikeEmail(g)) return fail('“' + g + '” is not a valid email address.');
      guests.push(g);
    }

    state.book.error = '';
    state.book.busy = true;
    renderDetail();

    var startMins = state.book.startMins;
    var durationMins = activeDuration();

    fetch(API, {
      method: 'POST',
      body: JSON.stringify({
        action: 'client-book',
        client: slugFromPath(),
        date: day.date,
        time: pad2(Math.floor(startMins / 60)) + ':' + pad2(startMins % 60),
        durationMins: durationMins,
        name: f.name.trim(),
        email: f.email.trim(),
        guests: guests,
        topic: f.topic.trim(),
        clientTimezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || '')
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        state.book.busy = false;
        if (!res || res.error) { return fail(res && res.error ? res.error : 'Could not book that time. Please try again.'); }
        state.book.done = { date: day.date, startMins: startMins, durationMins: durationMins };
        state.book.startMins = null;
        state.book.form = { name: f.name, email: f.email, topic: '', guests: [] };
        load(true); // the booked time must disappear from the calendar
      })
      .catch(function () {
        state.book.busy = false;
        fail('Could not reach the server. Please try again.');
      });
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

    // Keep whatever day the client is looking at across a refresh — otherwise
    // the post-booking reload would jump them off the day they just booked and
    // take the confirmation with it. Only choose a day on the first load.
    var keep = state.selected && state.byDate[state.selected] ? state.selected : null;

    // Otherwise land on the first day that actually has open time, so the page
    // never opens on an empty detail strip.
    var firstFree = (data.days || []).filter(function (x) { return (x.ranges || []).length; })[0];
    state.selected = keep || (firstFree ? firstFree.date : null);
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
