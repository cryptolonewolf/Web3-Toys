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

  // The rule, shared with the tests and middleware.js. override is a row
  // from release_overrides or null.
  function decide(toy, nowMs, override, newDays) {
    var at = Date.parse(toy.date);
    var o = override || null;
    if (o && o.action === 'delay') at = o.until ? Date.parse(o.until) : NaN;
    var released;
    if (!toy.ready) released = false;
    else if (o && o.action === 'release') released = true;
    else if (o && o.action === 'delay') released = !isNaN(at) && nowMs >= at;
    else released = toy.playableNow || nowMs >= at;
    // When did it go live, for the New sticker.
    var liveAt = o && o.action === 'release' ? Math.min(Date.parse(o.updated_at || toy.date) || at, at) : at;
    var status = released ? 'live'
      : (o && o.action === 'delay') || !toy.ready && nowMs >= Date.parse(toy.date) ? 'delayed' : 'locked';
    return {
      status: status,
      at: isNaN(at) ? null : new Date(at),
      isNew: released && !toy.playableNow && nowMs >= liveAt && nowMs - liveAt < (newDays || 7) * DAY,
      toy: toy,
    };
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { decide: decide };
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
      data = d;
      var clock = sb('rpc/server_now', {}).then(function (t) {
        var ms = Date.parse(t);
        if (!isNaN(ms)) offset = ms - Date.now();
      }).catch(function () { /* keep the website server's time */ });
      var over = sb('release_overrides?select=toy_id,action,until,updated_at').then(function (rows) {
        (rows || []).forEach(function (o) { overrides[o.toy_id] = o; });
      }).catch(function () {});
      return Promise.all([clock, over]);
    }).then(function () { return api; });
    loading.catch(function () { loading = null; });
    return loading;
  }

  function now() { return new Date(Date.now() + offset); }

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
    decide: decide,
  };
  root.Web3Releases = api;
})(typeof window !== 'undefined' ? window : globalThis);
