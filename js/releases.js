// Scheduled toy releases (data/releases.json). Works out whether each toy is
// live, locked or delayed using the server's clock (Supabase server_now, or
// the website server's Date header), never the visitor's own clock, plus
// any Release now / Delay buttons pressed in the admin dashboard.
//
//   Web3Releases.load() -> Promise of the schedule, then:
//   Web3Releases.status(id)  'live' | 'locked' | 'delayed' | null (not scheduled)
//   Web3Releases.info(id)    { status, at (Date or null), isNew, toy }
//   Web3Releases.now()       the server time as a Date
//   Web3Releases.dayLabel(at)  "Tue 17 Nov" (India time)
//   Web3Releases.countdown(at) "2d 4h 10m" or "" when 7 days or more away
//   Web3Releases.notify(id, email) saves a Notify me (Promise)

(function (root) {
  var DAY = 864e5;

  // Fills in each item's date from the schedule in data/releases.json (10:00
  // India time) and its onlyIfReady flag. Items not in the schedule get no
  // date: Coming soon, unless openNow. Shared with middleware.js and the
  // launch-emails function (the checks compare the copies).
  function expand(rel) {
    var when = {};
    (rel.schedule || []).forEach(function (s) {
      (s.items || []).forEach(function (n) { when[n] = { date: s.date + 'T10:00:00+05:30', only: s.onlyIfReady === true }; });
    });
    (rel.toys || []).forEach(function (t) {
      var w = when[t.name || t.id];
      if (rel.schedule) t.date = w ? w.date : null;
      t.onlyIfReady = Boolean(w && w.only);
      t.playableNow = t.openNow === true || (!rel.schedule && t.playableNow === true);
    });
    return rel;
  }

  // The rule, shared with the tests and middleware.js. override is a row
  // from release_overrides or null (action: release / delay / null, ready:
  // switched on in admin for onlyIfReady items).
  function decide(toy, nowMs, override, newDays) {
    var at = toy.date ? Date.parse(toy.date) : NaN;
    var o = override || null;
    if (o && o.action === 'delay') at = o.until ? Date.parse(o.until) : NaN;
    var on = Boolean(toy.ready) && (!toy.onlyIfReady || Boolean(o && (o.ready === true || o.action === 'release')));
    var released;
    if (!on) released = false;
    else if (o && o.action === 'release') released = true;
    else if (o && o.action === 'delay') released = !isNaN(at) && nowMs >= at;
    else released = Boolean(toy.playableNow) || (!isNaN(at) && nowMs >= at);
    // When did it go live, for the New sticker.
    var liveAt = o && o.action === 'release' ? Math.min(Date.parse(o.updated_at || '') || at, isNaN(at) ? Infinity : at) : at;
    var status = released ? 'live'
      : (o && o.action === 'delay') || (!on && !isNaN(at) && nowMs >= at) ? 'delayed' : 'locked';
    return {
      status: status,
      at: isNaN(at) ? null : new Date(at),
      isNew: released && !toy.playableNow && nowMs >= liveAt && nowMs - liveAt < (newDays || 7) * DAY,
      toy: toy,
    };
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { decide: decide, expand: expand };
    return;
  }

  var site = root.WEB3TOYS || {};
  var cfg = (root.WEB3TOYS_CONFIG || {}).supabase || {};
  var data = null, overrides = {}, offset = 0, loading = null;

  function sb(path, body) {
    if (!cfg.url || !cfg.anonKey) return Promise.reject(new Error('no supabase'));
    return fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + (session() || cfg.anonKey), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) throw new Error((j && (j.message || j.hint)) || 'Something went wrong. Try again.');
        return j;
      });
    });
  }

  // The visitor's login, so Notify me can use the account's email.
  function session() {
    var A = root.Web3Auth;
    return A && A.token ? A.token() : '';
  }

  function load() {
    if (loading) return loading;
    var t0 = Date.now();
    loading = fetch((site.root || '/') + 'data/releases.json', { cache: 'no-cache' }).then(function (r) {
      var hdr = Date.parse(r.headers.get('date') || '');
      if (!isNaN(hdr)) offset = hdr - (t0 + Date.now()) / 2;
      return r.json();
    }).then(function (d) {
      data = expand(d);
      var clock = sb('rpc/server_now', {}).then(function (t) {
        var ms = Date.parse(t);
        if (!isNaN(ms)) offset = ms - Date.now();
      }).catch(function () { /* keep the website server's time */ });
      var over = sb('release_overrides?select=*').then(function (rows) {
        (rows || []).forEach(function (o) { overrides[o.toy_id] = o; });
      }).catch(function () {});
      return Promise.all([clock, over]).then(previewCheck);
    }).then(function () { return api; });
    loading.catch(function () { loading = null; });
    return loading;
  }

  function now() { return new Date(Date.now() + offset + shift); }

  // ---------- Your preview of a future date (admin only) ----------
  // Admin, Releases tab, Preview date sets it. The site in this browser then
  // shows how it will look on that date (cards, stickers, order, teasers).
  // It only works for a logged-in admin; the server lock (middleware.js)
  // follows it only in a browser that also has your preview key.
  var PREVIEW = 'web3toys.previewAt';
  var shift = 0, previewAt = null;
  function previewCheck() {
    var want = NaN;
    try { want = Number(localStorage.getItem(PREVIEW)); } catch (e) { /* private mode */ }
    if (!(want > 0)) return null;
    // The login loads after this file: wait for it (up to 6 seconds; only
    // a browser where you pressed Preview has a preview date, so visitors
    // never wait).
    var waited = 0;
    var login = new Promise(function (done) {
      (function poll() { if (session() || waited >= 6000) done(); else { waited += 150; setTimeout(poll, 150); } })();
    });
    return login.then(function () { return session() ? sb('rpc/is_admin', {}) : false; }).then(function (yes) {
      if (yes !== true) return;
      previewAt = new Date(want);
      shift = want - (Date.now() + offset);
      banner();
    }).catch(function () {});
  }
  function setPreview(ms) {
    try {
      if (ms) localStorage.setItem(PREVIEW, String(ms)); else localStorage.removeItem(PREVIEW);
    } catch (e) { /* private mode */ }
    document.cookie = 'w3previewAt=' + (ms ? String(ms) : '') + '; Path=/; SameSite=Lax' + (ms ? '; Max-Age=86400' : '; Max-Age=0') + (location.protocol === 'https:' ? '; Secure' : '');
  }
  function banner() {
    if (!root.document || document.querySelector('.rel-preview')) return;
    var b = document.createElement('div');
    b.className = 'rel-preview';
    b.setAttribute('role', 'status');
    b.innerHTML = '👀 Preview: ' + previewAt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' India time <button type="button">Exit preview</button>';
    b.querySelector('button').addEventListener('click', function () { setPreview(null); location.reload(); });
    var add = function () { document.body.appendChild(b); };
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  }

  function toy(id) {
    return data ? data.toys.filter(function (t) { return t.id === id; })[0] : null;
  }

  function info(id) {
    var t = toy(id);
    return t ? decide(t, now().getTime(), overrides[id], data.newDays) : null;
  }

  function dayLabel(at) {
    if (!at) return '';
    return at.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '');
  }

  function countdown(at) {
    if (!at) return '';
    var ms = at.getTime() - now().getTime();
    if (ms <= 0 || ms >= 7 * DAY) return '';
    var d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
    return d ? d + 'd ' + h + 'h ' + m + 'm' : h ? h + 'h ' + m + 'm ' + s + 's' : m + 'm ' + s + 's';
  }

  function notify(id, email) {
    return sb('rpc/notify_me', { p_toy: id, p_email: email || '', p_consent: true }).then(function () {
      try {
        var k = 'web3toys.notify.v1';
        var l = JSON.parse(localStorage.getItem(k) || '[]');
        if (l.indexOf(id) < 0) l.push(id);
        localStorage.setItem(k, JSON.stringify(l));
      } catch (e) { /* private mode */ }
    });
  }

  function asked(id) {
    try { return JSON.parse(localStorage.getItem('web3toys.notify.v1') || '[]').indexOf(id) >= 0; } catch (e) { return false; }
  }

  var api = {
    load: load, now: now,
    reload: function () { loading = null; overrides = {}; return load(); }, info: info, toy: toy, dayLabel: dayLabel, countdown: countdown, notify: notify, asked: asked,
    status: function (id) { var i = info(id); return i ? i.status : null; },
    list: function () { return data ? data.toys : []; },
    loggedIn: function () { return Boolean(session()); },
    decide: decide, expand: expand,
    setPreview: setPreview, previewAt: function () { return previewAt; },
  };
  root.Web3Releases = api;
})(typeof window !== 'undefined' ? window : globalThis);
