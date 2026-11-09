// The admin dashboard (admin/). Only works for accounts in the admins table:
// every number comes from the database, which refuses anyone else. Tabs:
// Users, Leads, Purchases, Bookings, Project requests, Review queue,
// Referrals, Releases and Toy stats, each with Export CSV. Settings: data/admin.json.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var TABS = [['ops', '🏠 Operations'], ['inbox', 'Inbox'], ['users', 'Users'], ['leads', 'Leads'], ['purchases', 'Purchases'], ['bookings', 'Bookings'], ['toyreq', 'Toy requests'], ['testreq', 'Test requests'], ['tests', 'Tests & payouts'], ['sponsors', 'Sponsor bookings'], ['requests', 'Project requests'], ['review', 'Review queue'], ['growth', 'Referrals & posts'], ['releases', 'Releases'], ['stats', 'Toy stats'], ['revenue', 'Revenue'], ['audit', 'Audit log']];
  var hash = location.hash.replace('#', '').split(':');
  var tab = hash[0] || 'ops';
  var sub = hash[1] || '';
  var days = 30;
  var settings = null;
  var home = null;
  var ranks = null;
  var cache = {};
  var table = null;

  if (!TABS.some(function (t) { return t[0] === tab; })) tab = 'ops';

  function db() { return window.Web3Auth.client; }

  function must(r) {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }

  function say(html) {
    app.innerHTML = '<section class="card stack stack--tight"><h1 class="title-lg">Admin</h1>' + html + '</section>';
  }

  // ---------- Who may see this ----------

  function start() {
    if (!((window.WEB3TOYS_CONFIG || {}).supabase || {}).url) return say('<p class="text">Accounts are not switched on.</p>');
    var A = window.Web3Auth;
    if (!A) return document.addEventListener('web3auth:ready', start, { once: true });
    A.onChange(function (user) {
      if (!user) {
        say('<p class="text">Log in with your admin account.</p><button type="button" class="btn btn--ink" data-login>Log in</button>');
        app.querySelector('[data-login]').addEventListener('click', function () { A.open(); });
        return;
      }
      db().rpc('am_i_admin').then(must).then(function (ok) {
        if (!ok) return say('<p class="text">This account is not an admin. (Admins are added in Supabase: see docs/setup/part-1-accounts.md, step 8.)</p>');
        Promise.all([C.loadJson('../data/admin.json'), C.loadJson('../data/home.json'), C.loadJson('../data/ranks.json')]).then(function (r) {
          settings = r[0];
          home = r[1];
          ranks = r[2].ranks;
          render();
        });
      }).catch(function (err) { say('<p class="text">Could not check: ' + esc(err.message) + '. Has supabase/006_admin.sql been run?</p>'); });
    });
  }

  // ---------- Layout ----------

  function render() {
    app.innerHTML =
      '<div class="adm-head"><h1 class="title-lg">Admin</h1>' +
      '<label class="adm-days">Counts for <select class="field" data-days>' + [7, 30, 90, 365].map(function (d) {
        return '<option value="' + d + '"' + (d === days ? ' selected' : '') + '>last ' + d + ' days</option>';
      }).join('') + '</select></label></div>' +
      '<div class="adm-tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" role="tab" class="pf-tab' + (t[0] === tab ? ' is-on' : '') + '" aria-selected="' + (t[0] === tab) + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<section class="adm-panel" data-panel><p class="small-print">Loading…</p></section>';
    app.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        go(b.getAttribute('data-tab'));
      });
    });
    app.querySelector('[data-days]').addEventListener('change', function (e) {
      days = Number(e.target.value);
      delete cache.events;
      render();
    });
    var panel = app.querySelector('[data-panel]');
    var ctx = { db: db, load: load, cache: cache, esc: esc, must: must, tiles: tiles, grid: grid, bindCsv: bindCsv, render: render, go: go, refundOrder: refundOrder, date: date };
    var O = window.Web3AdminOps;
    ({ ops: function (p) { return O.home(p, ctx); }, inbox: function (p) { return O.inbox(p, ctx, sub); }, audit: function (p) { delete cache.audit; return O.audit(p, ctx); }, revenue: function (p) { return O.revenue(p, ctx); }, users: users, leads: leads, purchases: purchases, bookings: bookings, requests: requests, review: review, growth: growth, releases: releases, stats: stats, toyreq: function (p) { return bizRequests(p, 'toy'); }, testreq: function (p) { return bizRequests(p, 'test'); }, tests: productTests, sponsors: sponsorBookings })[tab](panel)
      .catch(function (err) { panel.innerHTML = '<p class="tk-warn is-bad">Could not load: ' + esc(err.message) + '</p>'; });
  }

  // Open a tab (and an Inbox section, 'inbox:refunds').
  function go(where) {
    var parts = String(where).split(':');
    tab = parts[0];
    sub = parts[1] || '';
    if (history.replaceState) history.replaceState(null, '', '#' + where);
    render();
    window.scrollTo(0, 0);
  }

  function load(key, fn) {
    if (!cache[key]) cache[key] = fn().catch(function (e) { delete cache[key]; throw e; });
    return cache[key];
  }

  function date(t) { return t ? String(t).slice(0, 10) : ''; }

  function money(cents, cur) {
    if (cur === 'COINS') return cents.toLocaleString('en-US') + ' coins';
    var n = cents / 100;
    return cur === 'INR' ? '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '$' + n.toFixed(2);
  }

  function tiles(list) {
    return '<ul class="adm-tiles">' + list.map(function (t) { return '<li><b>' + esc(String(t[1])) + '</b><span>' + esc(t[0]) + '</span></li>'; }).join('') + '</ul>';
  }

  // A table plus its Export CSV button. head: column names; rows: arrays.
  function grid(name, head, rows, htmlRows) {
    table = { name: name, head: head, rows: rows };
    return '<div class="btn-row"><button type="button" class="btn btn--small" data-csv>Export CSV</button><span class="small-print">' + rows.length + ' rows</span></div>' +
      '<div class="adm-scroll"><table class="tk-table adm-table"><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (htmlRows || rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c == null ? '' : String(c)) + '</td>'; }).join('') + '</tr>'; })).join('') +
      '</tbody></table></div>';
  }

  function bindCsv(panel) {
    var b = panel.querySelector('[data-csv]');
    if (!b) return;
    var t = table;
    b.addEventListener('click', function () {
      var cell = function (v) { var s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      var csv = [t.head].concat(t.rows).map(function (r) { return r.map(cell).join(','); }).join('\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
      a.download = 'web3toys-' + t.name + '-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  function show(panel, html) {
    panel.innerHTML = html;
    bindCsv(panel);
  }

  // ---------- Users ----------

  function users(panel) {
    return load('users', function () { return db().rpc('admin_users').then(must); }).then(function (rows) {
      var week = Date.now() - 7 * 86400000;
      var by = {};
      rows.forEach(function (u) { by[u.provider || 'email'] = (by[u.provider || 'email'] || 0) + 1; });
      show(panel, tiles([['Players', rows.length], ['New this week', rows.filter(function (u) { return Date.parse(u.created_at) > week; }).length],
        ['X logins', (by.x || 0) + (by.twitter || 0)], ['Google logins', by.google || 0], ['Email logins', by.email || 0]]) +
        grid('users', ['Name', 'Login', 'Email', 'Rank', 'Certificates', 'Coins', 'Toys finished', 'Joined', 'Last seen'], rows.map(function (u) {
          return [u.display_name, u.provider, u.email, Web3Progress.rankFor(u.certificates, ranks).name, u.certificates, u.coins, u.finished, date(u.created_at), date(u.last_seen_at)];
        })));
    });
  }

  // ---------- Leads ----------

  function leads(panel) {
    return load('leads', function () { return db().from('leads').select('*').order('created_at', { ascending: false }).limit(5000).then(must); }).then(function (rows) {
      var by = {};
      rows.forEach(function (l) { by[l.source || '?'] = (by[l.source || '?'] || 0) + 1; });
      var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).slice(0, 3);
      show(panel, tiles([['Email signups', rows.length]].concat(top.map(function (k) { return ['From ' + k, by[k]]; }))) +
        grid('leads', ['Email', 'Came from (toy or page)', 'Page', 'First signup', 'Last signup', 'Times'], rows.map(function (l) {
          return [l.email, l.source, l.page, date(l.created_at), date(l.last_seen_at), l.times];
        })));
    });
  }

  // ---------- Purchases ----------

  function purchases(panel) {
    return load('orders', function () { return db().from('orders').select('*').order('created_at', { ascending: false }).limit(5000).then(must); }).then(function (rows) {
      var withCoins = rows.filter(function (o) { return o.status === 'paid' && o.currency === 'COINS'; });
      var paid = rows.filter(function (o) { return o.status === 'paid' && o.currency !== 'COINS'; });
      var sum = function (cur) { return paid.filter(function (o) { return o.currency === cur; }).reduce(function (s, o) { return s + o.amount; }, 0); };
      var month = paid.filter(function (o) { return Date.parse(o.paid_at) > Date.now() - days * 86400000; });
      show(panel, tiles([['Paid orders', paid.length], ['Revenue in rupees', money(sum('INR'), 'INR')], ['Revenue in dollars', money(sum('USD'), 'USD')],
        ['Paid in last ' + days + ' days', month.length], ['Unlocked with coins', withCoins.length], ['Unfinished or failed', rows.filter(function (o) { return o.status !== 'paid'; }).length]]) +
        '<p class="small-print">Totals are before Razorpay and Paymento fees and taxes. Test-mode payments count here too until you go live.</p>' +
        grid('purchases', ['Date', 'What', 'Amount', 'Paid with', 'Status', 'Buyer email', 'Payment ref'], rows.map(function (o) {
          return [date(o.paid_at || o.created_at), o.title, money(o.amount, o.currency), o.provider || 'razorpay', o.status, o.email, o.razorpay_payment_id || o.provider_token || ''];
        })));
    });
  }

  // ---------- Events (shared by Bookings and Toy stats) ----------

  function events() {
    return load('events', function () { return db().rpc('admin_event_counts', { p_days: days }).then(must); });
  }

  function bookings(panel) {
    return Promise.all([
      events(),
      load('orders', function () { return db().from('orders').select('*').order('created_at', { ascending: false }).limit(5000).then(must); }),
      load('bookings', function () { return db().from('bookings').select('*').order('start_time', { ascending: false }).limit(2000).then(must).catch(function () { return []; }); }),
    ]).then(function (r) {
      var clicks = {};
      r[0].filter(function (e) { return e.name === 'call_click'; }).forEach(function (e) { clicks[e.item || e.page] = (clicks[e.item || e.page] || 0) + Number(e.total); });
      var paidOrders = r[1].filter(function (o) { return o.status === 'paid' && /^call/.test(o.product_id); });
      var cal = r[2];
      var upcoming = cal.filter(function (b) { return b.status !== 'cancelled' && Date.parse(b.start_time) > Date.now(); });
      var clickRows = Object.keys(clicks).sort(function (a, b) { return clicks[b] - clicks[a]; }).map(function (k) { return [k, clicks[k]]; });
      var rows = cal.map(function (b) {
        return [date(b.start_time) + ' ' + String(b.start_time || '').slice(11, 16), b.name, b.email, b.title, b.status, b.paid ? 'yes' : 'no', b.price != null ? (b.price / 100) + ' ' + (b.currency || '') : '', 'Cal.com'];
      }).concat(paidOrders.map(function (o) {
        return [date(o.paid_at), '', o.email, o.title, 'paid, time not picked yet?', 'yes', money(o.amount, o.currency), (o.provider || 'razorpay') + ' (pay first)'];
      }));
      show(panel, tiles([['Book a Call clicks', clickRows.reduce(function (s, x) { return s + x[1]; }, 0)], ['Upcoming calls', upcoming.length],
        ['Paid calls', cal.filter(function (b) { return b.paid; }).length + paidOrders.length], ['Cancelled', cal.filter(function (b) { return b.status === 'cancelled'; }).length]]) +
        '<p class="small-print">Calls come from Cal.com (booked, paid, rescheduled, cancelled) and from calls paid on the site first. Clicks are for the last ' + days + ' days.</p>' +
        grid('bookings', ['When', 'Name', 'Email', 'Call', 'Status', 'Paid', 'Price', 'Source'], rows) +
        '<h3 class="pf-h">Book a Call clicks by page</h3>' +
        '<div class="adm-scroll"><table class="tk-table adm-table"><thead><tr><th>Page</th><th>Clicks</th></tr></thead><tbody>' +
        clickRows.map(function (c) { return '<tr><td>' + esc(c[0]) + '</td><td>' + c[1] + '</td></tr>'; }).join('') + '</tbody></table></div>');
    });
  }

  // ---------- Referrals and X posts (spot checks) ----------

  function growth(panel) {
    return Promise.all([
      load('referrals', function () { return db().rpc('admin_referrals').then(must); }),
      load('proofs', function () { return db().rpc('admin_proofs').then(must); }),
    ]).then(function (r) {
      var refs = r[0];
      var proofs = r[1];
      var by = {};
      refs.forEach(function (x) { by[x.referrer_name || '?'] = (by[x.referrer_name || '?'] || 0) + 1; });
      var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).slice(0, 5);
      show(panel, tiles([['Invites', refs.length], ['Qualified (paid)', refs.filter(function (x) { return x.status === 'paid'; }).length],
        ['Still playing', refs.filter(function (x) { return x.status === 'pending'; }).length], ['Over the monthly cap', refs.filter(function (x) { return x.status === 'capped'; }).length], ['X posts claimed', proofs.length]]) +
        '<p class="small-print">Top inviters: ' + (top.length ? top.map(function (k) { return esc(k) + ' (' + by[k] + ')'; }).join(', ') : 'none yet') + '. Spot-check the posts below; if one is fake, tell me and I will show you how to remove the coins.</p>' +
        '<h3 class="pf-h">X posts for the post task</h3><div class="adm-scroll"><table class="tk-table adm-table"><thead><tr><th>Player</th><th>Post</th><th>Date</th></tr></thead><tbody>' +
        proofs.map(function (p) { return '<tr><td>' + esc(p.display_name || '') + '</td><td><a href="' + esc(p.proof) + '" target="_blank" rel="noopener">' + esc(p.proof) + '</a></td><td>' + esc(date(p.created_at)) + '</td></tr>'; }).join('') +
        '</tbody></table></div><h3 class="pf-h">Invites</h3>' +
        grid('referrals', ['Inviter', 'New player', 'Status', 'Joined', 'Qualified'], refs.map(function (x) { return [x.referrer_name, x.referee_name, x.status, date(x.created_at), date(x.qualified_at)]; })));
    });
  }

  // ---------- Toy stats ----------

  function stats(panel) {
    return Promise.all([events(), load('orders', function () { return db().from('orders').select('*').order('created_at', { ascending: false }).limit(5000).then(must); })]).then(function (r) {
      var ev = r[0];
      var toys = [];
      home.shelves.forEach(function (s) { s.cards.forEach(function (c) { if (c.status === 'live' && c.path) toys.push(c); }); });
      var count = function (name, test) { return ev.filter(function (e) { return e.name === name && test(e); }).reduce(function (s, e) { return s + Number(e.total); }, 0); };
      var rows = toys.map(function (c) {
        var key = c.path.replace(/\/$/, '').split('/').pop();
        var onPage = function (e) { return String(e.page || '').replace(/index\.html$/, '').replace(/\/$/, '').split('/').pop() === key; };
        var mine = function (e) { return e.item === c.id || e.item === key || String(e.item || '').indexOf(c.id + ':') === 0 || String(e.item || '').split(':')[1] === c.id; };
        var plays = count('page_view', onPage);
        var finishes = count('finish', function (e) { return e.item === c.id || e.item === key; });
        var shares = count('share', function (e) { return e.item === c.id || e.item === key; });
        var buys = count('buy_click', onPage);
        var paid = count('purchase', function (e) { return onPage(e) || mine(e); });
        return [c.title, c.kind || 'toy', plays, finishes, plays ? Math.round((finishes / plays) * 100) + '%' : '', shares, buys, paid, plays ? (Math.round((paid / plays) * 1000) / 10) + '%' : ''];
      }).sort(function (a, b) { return b[2] - a[2]; });
      var total = function (n) { return ev.filter(function (e) { return e.name === n; }).reduce(function (s, e) { return s + Number(e.total); }, 0); };
      show(panel, tiles([['Page views', total('page_view')], ['Finishes', total('finish')], ['Shares', total('share')], ['Buy clicks', total('buy_click')], ['Purchases', total('purchase')]]) +
        '<p class="small-print">Last ' + days + ' days. Plays = visits to the toy page. Conversion = purchases started from that toy divided by plays.</p>' +
        grid('toy-stats', ['Toy or tool', 'Kind', 'Plays', 'Finishes', 'Finish rate', 'Shares', 'Buy clicks', 'Purchases', 'Conversion to paid'], rows));
    });
  }

  // ---------- Releases (data/releases.json) ----------
  // Each scheduled toy: its date, status and Notify me count, with Release
  // now, Delay and Back to schedule buttons (release_overrides, 010_releases.sql).

  function releases(panel) {
    var R = window.Web3Releases;
    var cards = {};
    home.shelves.forEach(function (s) { s.cards.forEach(function (c) { cards[c.id] = c; }); });
    // Numbers since launch day (the events table keeps a count per page).
    var launch = Date.parse((R.list()[0] || {}).date || '') || Date.now();
    var sinceDays = Math.max(1, Math.ceil((Date.now() - launch) / 864e5));
    return Promise.all([
      R.reload(),
      db().from('release_overrides').select('*').then(must),
      load('notify', function () { return db().from('release_notify').select('toy_id').limit(100000).then(must); }),
      load('relEvents', function () { return db().rpc('admin_event_counts', { p_days: sinceDays }).then(must); }),
      load('relCerts', function () { return db().from('certificates').select('toy').limit(100000).then(must); }),
      load('relBirds', function () { return db().rpc('early_bird_counts').then(must).catch(function () { return []; }); }),
    ]).then(function (r) {
      var ev = r[3];
      var certs = {};
      r[4].forEach(function (c) { certs[c.toy] = (certs[c.toy] || 0) + 1; });
      var birds = {};
      (r[5] || []).forEach(function (b) { birds[b.toy] = b; });
      var count = function (name, test) { return ev.filter(function (e) { return e.name === name && test(e); }).reduce(function (n, e) { return n + Number(e.total); }, 0); };
      var over = {};
      r[1].forEach(function (o) { over[o.toy_id] = o; });
      var asked = {};
      r[2].forEach(function (n) { asked[n.toy_id] = (asked[n.toy_id] || 0) + 1; });
      var when = function (d) { return d ? R.dayLabel(d) + ' ' + d.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'Asia/Kolkata' }) : ''; };
      var rows = R.list().map(function (t) {
        var i = R.info(t.id);
        var o = over[t.id];
        var key = String((cards[t.id] || {}).path || t.path || t.id).replace(/\/$/, '').split('/').pop();
        var onPage = function (e) { return String(e.page || '').replace(/index\.html$/, '').replace(/\/$/, '').split('/').pop() === key; };
        var mine = function (e) { return e.item === t.id || e.item === key; };
        var b = birds[t.id];
        return { t: t, i: i, o: o, row: [(cards[t.id] || {}).title || t.id, when(new Date(Date.parse(t.date))), i.status + (i.isNew ? ' (new)' : ''),
          o ? (o.action === 'release' ? 'Released early' : 'Delayed' + (o.until ? ' to ' + when(new Date(o.until)) : '')) : '', t.ready ? 'yes' : 'not built yet', asked[t.id] || 0,
          count('page_view', onPage), count('finish', mine), certs[t.id] || 0, b ? b.used + ' / ' + b.spots : '', count('share', mine)] };
      });
      var head = ['Toy', 'Date in releases.json', 'Status now', 'Your override', 'Built', 'Notify me', 'Plays', 'Finishes', 'Certificates', 'Early Bird used', 'Shares'];
      panel.innerHTML = '<p class="small-print">Server time: ' + esc(R.now().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })) + ' India time. Plays, finishes and shares are counted over the last ' + sinceDays + ' day' + (sinceDays === 1 ? '' : 's') + ' (since launch day). Change dates in data/releases.json; use these buttons to release early or delay without editing it.</p>' +
        grid('releases', head, rows.map(function (x) { return x.row; }), rows.map(function (x) {
          return '<tr>' + x.row.map(function (c) { return '<td>' + esc(String(c)) + '</td>'; }).join('') +
            '<td><div class="btn-row">' +
            (x.i.status !== 'live' && x.t.ready ? '<button type="button" class="btn btn--small btn--yellow" data-rel="release" data-toy="' + esc(x.t.id) + '">Release now</button>' : '') +
            (!x.t.playableNow ? '<button type="button" class="btn btn--small" data-rel="delay" data-toy="' + esc(x.t.id) + '">Delay…</button>' : '') +
            (x.o ? '<button type="button" class="btn btn--small" data-rel="clear" data-toy="' + esc(x.t.id) + '">Back to schedule</button>' : '') +
            '</div></td></tr>';
        }));
      panel.querySelector('thead tr').insertAdjacentHTML('beforeend', '<th>Change</th>');
      bindCsv(panel);
      panel.querySelectorAll('[data-rel]').forEach(function (b) {
        b.addEventListener('click', function () {
          var act = b.getAttribute('data-rel');
          var toy = b.getAttribute('data-toy');
          var until = null;
          if (act === 'release' && !window.confirm('Release ' + toy + ' now? Everyone can play it straight away.')) return;
          if (act === 'delay') {
            var v = window.prompt('Delay until which day? (YYYY-MM-DD, unlocks at 10:00 India time). Leave empty to keep it locked until you release it.', '');
            if (v === null) return;
            v = v.trim();
            if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { window.alert('Please write the date like 2026-12-01.'); return; }
            until = v ? v + 'T10:00:00+05:30' : null;
          }
          b.disabled = true;
          db().rpc('admin_set_release', { p_toy: toy, p_action: act === 'clear' ? null : act, p_until: until }).then(must)
            .then(function () { render(); }, function (err) { b.disabled = false; window.alert('Could not save: ' + err.message); });
        });
      });
    });
  }

  // ---------- For Projects requests (biz_requests, 014_business.sql) ----------
  // Toy requests now; Test requests use the same list. Deposit status from
  // orders; the vetting checklist from data/admin.json; Refund in full calls
  // the admin-refund function.

  var BIZ_STATUS = { submitted: 'Submitted', paid: 'Deposit paid', in_review: 'In review', approved: 'Approved', building: 'Building', live: 'Live', declined: 'Declined', refunded: 'Refunded' };

  function refundOrder(orderId, mark) {
    var A = window.Web3Auth;
    return db().functions.invoke('admin-refund', { body: { orderId: orderId, action: mark ? 'mark' : 'refund' }, headers: { Authorization: 'Bearer ' + (A.token ? A.token() : '') } })
      .then(function (r) {
        if (r.error) {
          return (r.error.context && r.error.context.json ? r.error.context.json() : Promise.resolve({})).then(function (j) { var e = new Error(j.error || r.error.message); e.crypto = j.crypto; throw e; });
        }
        return r.data;
      });
  }

  function bizRequests(panel, kind) {
    return Promise.all([
      load('biz-' + kind, function () { return db().from('biz_requests').select('*').eq('kind', kind).order('created_at', { ascending: false }).then(must); }),
      load('orders', function () { return db().from('orders').select('*').order('created_at', { ascending: false }).limit(5000).then(must); }),
      load('bizTiers-' + kind, function () { return C.loadJson('../data/business/' + (kind === 'toy' ? 'toy' : 'test') + '_tiers.json'); }),
    ]).then(function (r) {
      var rows = r[0];
      var orders = {};
      r[1].forEach(function (o) { orders[o.id] = o; });
      var tiers = {};
      r[2].tiers.forEach(function (t) { tiers[t.id] = t; });
      table = { name: kind + '-requests', head: ['Date', 'Project', 'Tier', 'Email', 'Website', 'X', 'Launch date', 'Status', 'Deposit', 'Note'],
        rows: rows.map(function (q) { var o = orders[q.order_id]; return [date(q.created_at), q.project, (tiers[q.tier] || {}).name || q.tier, q.email, q.website, q.x_handle, q.launch_date, BIZ_STATUS[q.status] || q.status, o ? o.status + ' ' + money(o.amount, o.currency) : 'not paid', q.admin_note]; }) };
      panel.innerHTML = '<div class="btn-row"><button type="button" class="btn btn--small" data-csv>Export CSV</button><span class="small-print">' + rows.length + ' requests</span></div>' +
        (rows.length ? rows.map(function (q) {
          var o = orders[q.order_id];
          var t = tiers[q.tier] || { name: q.tier };
          return '<article class="card stack stack--tight adm-req" data-biz="' + q.id + '"><div class="cap-row"><h3 class="title-sm">' + esc(q.project) + ' · ' + esc(t.name) + (t.price ? ' ($' + Number(t.price).toLocaleString('en-US') + ')' : '') + '</h3>' +
            '<span class="chip ' + (q.status === 'declined' || q.status === 'refunded' ? 'is-white' : 'is-yellow') + '">' + esc(BIZ_STATUS[q.status] || q.status) + '</span></div>' +
            '<p class="small-print">' + esc(date(q.created_at)) + ' · ' + esc(q.email) + (q.website ? ' · <a href="' + esc(q.website) + '" target="_blank" rel="noopener">' + esc(q.website) + '</a>' : '') + (q.x_handle ? ' · ' + esc(q.x_handle) : '') +
            (q.launch_date ? ' · launch ' + esc(q.launch_date) : '') + ' · Deposit: ' + (o ? esc(o.status) + ' ' + money(o.amount, o.currency) : 'not paid yet') + '</p>' +
            (q.product ? '<p class="text"><b>Product:</b> ' + esc(q.product) + '</p>' : '') + (q.idea ? '<p class="text"><b>Idea:</b> ' + esc(q.idea) + '</p>' : '') +
            (kind === 'test' && q.details ? '<p class="text"><b>Test link:</b> ' + (q.details.testLink ? '<a href="' + esc(q.details.testLink) + '" target="_blank" rel="noopener">' + esc(q.details.testLink) + '</a>' : '-') + (q.details.network ? ' · ' + esc(q.details.network) : '') + '</p>' +
              (q.details.tasks ? '<p class="text"><b>Tasks they want tested:</b></p><pre class="adm-tasks">' + esc(q.details.tasks) + '</pre>' : '') : '') +
            '<fieldset class="adm-check"><legend class="label">Vetting checklist</legend>' + settings.vetting.map(function (v) {
              return '<label class="mk-check"><input type="checkbox" data-v="' + v.id + '"' + ((q.checklist || {})[v.id] ? ' checked' : '') + ' /> <span>' + esc(v.text) + '</span></label>';
            }).join('') + '</fieldset>' +
            '<label class="label">Note (only you see it)<textarea class="field" rows="2" data-note>' + esc(q.admin_note || '') + '</textarea></label>' +
            '<div class="btn-row"><select class="field" data-status>' + Object.keys(BIZ_STATUS).map(function (st) {
              return '<option value="' + st + '"' + (st === q.status ? ' selected' : '') + '>' + esc(BIZ_STATUS[st]) + '</option>';
            }).join('') + '</select><button type="button" class="btn btn--small" data-save>Save</button>' +
            '<button type="button" class="btn btn--small btn--yellow" data-set="approved">Approve</button>' +
            '<button type="button" class="btn btn--small acct-danger" data-set="declined">Decline</button>' +
            (o && o.status === 'paid' ? '<button type="button" class="btn btn--small acct-danger" data-refund="' + esc(o.id) + '">Refund deposit in full</button>' : '') + '</div>' +
            '<p class="small-print" data-msg aria-live="polite"></p></article>';
        }).join('') : '<p class="text">No requests yet. They arrive from the ' + (kind === 'toy' ? 'Launch Your Own Toy' : 'Test Your Product') + ' page.</p>');
      bindCsv(panel);
      panel.querySelectorAll('[data-biz]').forEach(function (card) {
        var msg = card.querySelector('[data-msg]');
        var save = function (status) {
          var checklist = {};
          card.querySelectorAll('[data-v]').forEach(function (c) { if (c.checked) checklist[c.getAttribute('data-v')] = true; });
          if (status === 'declined' && !window.confirm('Decline this project? If they paid a deposit, refund it with the Refund button.')) return;
          msg.textContent = 'Saving…';
          db().rpc('admin_update_biz', { p_id: card.getAttribute('data-biz'), p_status: status || card.querySelector('[data-status]').value, p_checklist: checklist, p_note: card.querySelector('[data-note]').value })
            .then(must).then(function () { delete cache['biz-' + kind]; render(); }, function (err) { msg.textContent = 'Could not save: ' + err.message; });
        };
        card.querySelector('[data-save]').addEventListener('click', function () { save(null); });
        card.querySelectorAll('[data-set]').forEach(function (b) { b.addEventListener('click', function () { save(b.getAttribute('data-set')); }); });
        var rf = card.querySelector('[data-refund]');
        if (rf) rf.addEventListener('click', function () {
          if (!window.confirm('Refund this deposit in full? The money goes back to the card or UPI they paid with.')) return;
          rf.disabled = true;
          msg.textContent = 'Refunding…';
          refundOrder(rf.getAttribute('data-refund')).then(function () {
            delete cache['biz-' + kind]; delete cache.orders; render();
          }, function (err) {
            if (err.crypto && window.confirm(err.message + '\n\nHave you refunded it in Paymento? Press OK to mark it refunded.')) {
              return refundOrder(rf.getAttribute('data-refund'), true).then(function () { delete cache['biz-' + kind]; delete cache.orders; render(); });
            }
            rf.disabled = false;
            msg.textContent = err.message;
          });
        });
      });
    });
  }

  // ---------- Sponsor bookings (015_sponsors.sql) ----------
  // Logo preview, the card as it will look, approve, reject and refund, and
  // views and clicks from our own counter.

  var BOOK_STATUS = { pending_payment: 'Not paid', pending: 'Paid, needs review', approved: 'Approved', rejected: 'Rejected', refunded: 'Refunded', cancelled: 'Cancelled' };

  // ---------- Tests & payouts (Test Your Product, supabase/016_tests.sql) ----------
  var TEST_STATUS = { draft: 'Draft (hidden)', open: 'Open to testers', closed: 'Closed', reported: 'Report sent' };
  function productTests(panel) {
    return Promise.all([
      load('tests', function () { return db().from('product_tests').select('*').order('created_at', { ascending: false }).then(must); }),
      load('testRuns', function () { return db().from('test_runs').select('*').order('started_at', { ascending: false }).limit(5000).then(must); }),
      load('testers', function () { return db().rpc('admin_testers').then(must); }),
      load('biz-test', function () { return db().from('biz_requests').select('*').eq('kind', 'test').order('created_at', { ascending: false }).then(must); }),
      load('bizTiers-test', function () { return C.loadJson('../data/business/test_tiers.json'); }),
    ]).then(function (r) {
      var tests = r[0], runs = r[1], T = r[4];
      var who = {};
      r[2].forEach(function (t) { who[t.user_id] = t; });
      var reqs = r[3].filter(function (q) { return ['paid', 'in_review', 'approved', 'building', 'live'].indexOf(q.status) >= 0; });
      var tierOf = function (q) { return T.tiers.filter(function (t) { return t.id === q.tier; })[0] || T.tiers[0]; };
      var reward = function (t) { return Math.floor(t.price * T.testerShare / t.testers * 100) / 100; };
      var owed = runs.filter(function (x) { return x.status === 'approved' && !x.paid_at; });
      var testName = {};
      tests.forEach(function (t) { testName[t.id] = t.project + ': ' + t.title; });
      var payRows = owed.map(function (x) { var p = who[x.user_id] || {}; return [testName[x.test_id], p.display_name, x.owed_usd, p.token, p.network, p.wallet]; });
      table = { name: 'tester-payouts', head: ['Test', 'Tester', 'Owed (USD)', 'Token', 'Network', 'Wallet'], rows: payRows };

      panel.innerHTML = tiles([['Tests', tests.length], ['Open now', tests.filter(function (t) { return t.status === 'open'; }).length],
        ['Waiting for review', runs.filter(function (x) { return x.status === 'submitted'; }).length], ['Payouts owed', '$' + owed.reduce(function (s, x) { return s + Number(x.owed_usd || 0); }, 0).toFixed(2)], ['Testers', r[2].length]]) +
        '<details class="card stack stack--tight"><summary><b>➕ New test</b></summary><div data-new></div></details>' +
        tests.map(function (t) {
          var mine = runs.filter(function (x) { return x.test_id === t.id; });
          var sent = mine.filter(function (x) { return x.status === 'submitted'; });
          return '<article class="card stack stack--tight adm-req" data-test="' + t.id + '"><div class="cap-row"><h3 class="title-sm">' + esc(t.project) + ': ' + esc(t.title) + '</h3><span class="chip is-yellow">' + esc(TEST_STATUS[t.status]) + '</span></div>' +
            '<p class="small-print">' + (t.tasks || []).length + ' tasks · ' + mine.filter(function (x) { return x.status !== 'rejected'; }).length + ' of ' + t.spots + ' spots taken · $' + Number(t.reward_usd).toFixed(2) + ' + ' + t.coins + ' coins per approved test · ' +
            mine.filter(function (x) { return x.status === 'approved'; }).length + ' approved, ' + sent.length + ' to review</p>' +
            '<div class="btn-row"><button type="button" class="btn btn--small" data-edit>Edit</button>' +
            (t.status !== 'open' ? '<button type="button" class="btn btn--small btn--yellow" data-st="open">Open to testers</button>' : '<button type="button" class="btn btn--small" data-st="closed">Close</button>') +
            '<button type="button" class="btn btn--small" data-report>Report</button><button type="button" class="btn btn--small btn--ink" data-pdf>Export branded PDF</button></div>' +
            '<div data-editbox></div>' +
            (sent.length ? '<h4 class="label">To review</h4>' + sent.map(function (x) {
              var p = who[x.user_id] || {};
              return '<div class="card stack stack--tight" data-run="' + x.id + '"><b>' + esc(p.display_name || 'Tester') + '</b><span class="small-print">sent ' + esc(date(x.submitted_at)) + '</span><ol class="tst-review">' +
                (x.results || []).map(function (res, i) {
                  return '<li><b>' + esc(((t.tasks || [])[i] || {}).title || res.task) + '</b><span class="small-print">' + esc(res.outcome) + ' · ' + Math.round(res.seconds || 0) + ' s · ' + res.rating + '/5' + (res.shot ? ' · <a href="#" data-shot="' + esc(res.shot) + '">screenshot</a>' : '') + '</span>' + (res.comment ? '<span class="small-print">"' + esc(res.comment) + '"</span>' : '') + '</li>';
                }).join('') + '</ol><input class="field" data-note placeholder="Note (optional, why it was rejected)" maxlength="300" />' +
                '<div class="btn-row"><button type="button" class="btn btn--small btn--yellow" data-review="approved">Approve (coins + $' + Number(t.reward_usd).toFixed(2) + ' owed)</button><button type="button" class="btn btn--small acct-danger" data-review="rejected">Reject</button></div><p class="small-print" data-msg></p></div>';
            }).join('') : '') +
            '<div data-reportbox></div><p class="small-print" data-msg aria-live="polite"></p></article>';
        }).join('') +
        '<section class="stack stack--tight"><h3 class="title-sm">Payouts owed</h3><p class="small-print">Send each one from your own wallet, then paste the transaction link (https://… from the block explorer) and press Mark paid. Check the network before you send.</p>' +
        (owed.length ? '<div class="btn-row"><button type="button" class="btn btn--small" data-csv>Export CSV</button></div>' + owed.map(function (x) {
          var p = who[x.user_id] || {};
          return '<div class="card stack stack--tight" data-pay="' + x.id + '"><b>' + esc(p.display_name || 'Tester') + ' · $' + Number(x.owed_usd).toFixed(2) + ' in ' + esc(p.token || '?') + ' on ' + esc(p.network || '?') + '</b>' +
            '<span class="small-print">' + esc(testName[x.test_id] || '') + '</span><code class="adm-tasks">' + esc(p.wallet || 'no wallet') + '</code>' +
            '<div class="btn-row"><input class="field" data-tx placeholder="https://etherscan.io/tx/…" maxlength="300" /><button type="button" class="btn btn--small btn--ink" data-paid>Mark paid</button></div><p class="small-print" data-msg></p></div>';
        }).join('') : '<p class="text">Nothing owed right now.</p>') + '</section>';
      bindCsv(panel);

      var refresh = function () { ['tests', 'testRuns', 'testers'].forEach(function (k) { delete cache[k]; }); render(); };
      function editor(box, t) {
        t = t || {};
        box.innerHTML = '<form class="stack stack--tight adm-test-form">' +
          (t.id ? '' : '<label class="label">From request<select class="field" data-req><option value="">(none)</option>' + reqs.map(function (q) { return '<option value="' + q.id + '">' + esc(q.project) + ' · ' + esc(tierOf(q).name) + ' · ' + esc(BIZ_STATUS[q.status] || q.status) + '</option>'; }).join('') + '</select></label>') +
          '<label class="label">Project<input class="field" data-k="project" maxlength="120" value="' + esc(t.project || '') + '" /></label>' +
          '<label class="label">Test title (testers see it)<input class="field" data-k="title" maxlength="120" value="' + esc(t.title || '') + '" placeholder="First swap on testnet" /></label>' +
          '<label class="label">Short intro for testers<textarea class="field" rows="2" data-k="intro" maxlength="600">' + esc(t.intro || '') + '</textarea></label>' +
          '<label class="label">Link testers open (https)<input class="field" data-k="url" maxlength="300" value="' + esc(t.url || '') + '" /></label>' +
          '<label class="label">Network note<input class="field" data-k="network" maxlength="80" value="' + esc(t.network_note || '') + '" placeholder="Sepolia testnet" /></label>' +
          '<label class="label">Tasks, one per line (1 to 20)<textarea class="field adm-tasks" rows="6" data-k="tasks">' + esc((t.tasks || []).map(function (x) { return x.title; }).join('\n')) + '</textarea></label>' +
          '<div class="ad-row"><label class="label">Testers (spots)<input class="field" type="number" min="1" max="500" data-k="spots" value="' + (t.spots || 10) + '" /></label>' +
          '<label class="label">Stablecoin per tester ($)<input class="field" type="number" min="0" step="0.01" data-k="reward" value="' + (t.reward_usd != null ? t.reward_usd : 0) + '" /></label>' +
          '<label class="label">Coins per tester<input class="field" type="number" min="0" data-k="coins" value="' + (t.coins != null ? t.coins : T.testerCoins) + '" /></label>' +
          '<label class="label">Minutes (about)<input class="field" type="number" min="5" max="240" data-k="minutes" value="' + (t.minutes || 30) + '" /></label></div>' +
          '<p class="small-print">Tester pool: ' + Math.round(T.testerShare * 100) + '% of the price, split between the testers. Picking a request fills this in.' + (t.id ? ' Changing tasks after people started can mix up their answers.' : '') + '</p>' +
          '<div class="btn-row"><button type="submit" class="btn btn--small btn--ink">Save as draft</button><button type="button" class="btn btn--small btn--yellow" data-open>Save and open</button></div><p class="small-print" data-msg></p></form>';
        var f = box.querySelector('form');
        var v = function (k) { return f.querySelector('[data-k="' + k + '"]'); };
        var req = f.querySelector('[data-req]');
        if (req) req.addEventListener('change', function () {
          var q = reqs.filter(function (x) { return x.id === req.value; })[0];
          if (!q) return;
          var tier = tierOf(q), d = q.details || {};
          v('project').value = q.project; v('url').value = d.testLink || q.website || ''; v('network').value = d.network || '';
          v('tasks').value = String(d.tasks || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 20).join('\n');
          v('spots').value = tier.testers; v('reward').value = reward(tier);
        });
        var save = function (status) {
          var lines = v('tasks').value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
          var msg = f.querySelector('[data-msg]');
          if (!lines.length || lines.length > 20) { msg.textContent = 'Add 1 to 20 tasks, one per line.'; return; }
          msg.textContent = 'Saving…';
          db().rpc('admin_save_test', {
            p_id: t.id || null, p_request: t.id ? t.request_id : (req.value || null), p_project: v('project').value.trim(), p_title: v('title').value.trim(), p_intro: v('intro').value.trim(),
            p_url: v('url').value.trim(), p_network: v('network').value.trim(), p_tasks: lines.map(function (x, i) { return { id: 't' + (i + 1), title: x.slice(0, 200) }; }),
            p_spots: Number(v('spots').value), p_reward: Number(v('reward').value), p_coins: Number(v('coins').value), p_minutes: Number(v('minutes').value), p_status: status || t.status || 'draft',
          }).then(must).then(refresh, function (err) { msg.textContent = 'Could not save: ' + err.message; });
        };
        f.addEventListener('submit', function (e) { e.preventDefault(); save(t.id ? null : 'draft'); });
        f.querySelector('[data-open]').addEventListener('click', function () { save('open'); });
      }
      editor(panel.querySelector('[data-new]'));

      var signed = function (paths) {
        if (!paths.length) return Promise.resolve({});
        return db().storage.from('test-shots').createSignedUrls(paths, 3600).then(function (r) {
          var out = {};
          (r.data || []).forEach(function (x) { if (x.signedUrl) out[x.path] = x.signedUrl; });
          return out;
        });
      };
      var reportHtml = function (t) {
        var mine = runs.filter(function (x) { return x.test_id === t.id && x.status === 'approved'; });
        var paths = [];
        mine.forEach(function (x) { (x.results || []).forEach(function (res) { if (res.shot) paths.push(res.shot); }); });
        return signed(paths).then(function (urls) { return Web3TestReport.html(t, mine, { shot: function (p) { return urls[p] || ''; } }); });
      };
      panel.querySelectorAll('[data-test]').forEach(function (card) {
        var t = tests.filter(function (x) { return x.id === card.getAttribute('data-test'); })[0];
        var msg = card.querySelector(':scope > [data-msg]');
        card.querySelector('[data-edit]').addEventListener('click', function () { editor(card.querySelector('[data-editbox]'), t); });
        card.querySelectorAll('[data-st]').forEach(function (b) {
          b.addEventListener('click', function () {
            msg.textContent = 'Saving…';
            db().rpc('admin_save_test', { p_id: t.id, p_request: t.request_id, p_project: t.project, p_title: t.title, p_intro: t.intro, p_url: t.url, p_network: t.network_note, p_tasks: t.tasks,
              p_spots: t.spots, p_reward: t.reward_usd, p_coins: t.coins, p_minutes: t.minutes, p_status: b.getAttribute('data-st') }).then(must).then(refresh, function (err) { msg.textContent = err.message; });
          });
        });
        card.querySelector('[data-report]').addEventListener('click', function () {
          var box = card.querySelector('[data-reportbox]');
          box.innerHTML = '<p class="small-print">Building…</p>';
          reportHtml(t).then(function (h) { box.innerHTML = h; }, function (err) { box.innerHTML = '<p class="small-print">' + esc(err.message) + '</p>'; });
        });
        card.querySelector('[data-pdf]').addEventListener('click', function () {
          msg.textContent = 'Preparing the PDF… choose Save as PDF in the print box.';
          reportHtml(t).then(function (h) { Web3TestReport.print(h); }, function (err) { msg.textContent = err.message; });
        });
        card.querySelectorAll('[data-shot]').forEach(function (a) {
          a.addEventListener('click', function (e) {
            e.preventDefault();
            signed([a.getAttribute('data-shot')]).then(function (u) { var url = u[a.getAttribute('data-shot')]; if (url) window.open(url, '_blank', 'noopener'); });
          });
        });
        card.querySelectorAll('[data-run]').forEach(function (box) {
          box.querySelectorAll('[data-review]').forEach(function (b) {
            b.addEventListener('click', function () {
              b.disabled = true;
              db().rpc('admin_review_run', { p_run: box.getAttribute('data-run'), p_status: b.getAttribute('data-review'), p_note: box.querySelector('[data-note]').value })
                .then(must).then(refresh, function (err) { b.disabled = false; box.querySelector('[data-msg]').textContent = err.message; });
            });
          });
        });
      });
      panel.querySelectorAll('[data-pay]').forEach(function (box) {
        box.querySelector('[data-paid]').addEventListener('click', function () {
          var tx = box.querySelector('[data-tx]').value.trim();
          if (!/^https:\/\/\S{3,}$/.test(tx)) { box.querySelector('[data-msg]').textContent = 'Paste the https:// transaction link from the block explorer.'; return; }
          db().rpc('admin_mark_paid', { p_run: box.getAttribute('data-pay'), p_tx: tx }).then(must).then(refresh, function (err) { box.querySelector('[data-msg]').textContent = err.message; });
        });
      });
    });
  }

  function sponsorBookings(panel) {
    var SB = (window.WEB3TOYS_CONFIG || {}).supabase || {};
    var logoUrl = function (p) { return SB.url.replace(/\/$/, '') + '/storage/v1/object/public/sponsor-logos/' + p.split('/').map(encodeURIComponent).join('/'); };
    return Promise.all([
      load('sponsorBookings', function () { return db().from('sponsor_bookings').select('*').order('created_at', { ascending: false }).then(must); }),
      load('orders', function () { return db().from('orders').select('*').order('created_at', { ascending: false }).limit(5000).then(must); }),
      load('sponsorCounts', function () { return db().rpc('admin_sponsor_counts').then(must).catch(function () { return []; }); }),
    ]).then(function (r) {
      var rows = r[0].filter(function (b) { return b.status !== 'pending_payment' || Date.now() - Date.parse(b.created_at) < 864e5; });
      var orders = {};
      r[1].forEach(function (o) { orders[o.id] = o; });
      var counts = {};
      (r[2] || []).forEach(function (c) { counts[c.booking_id] = c; });
      var month = function (m) { return new Date(m + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }); };
      var where = function (b) { return b.kind === 'toy' ? b.toy_id + (b.with_round ? ' + round' : '') : b.kind; };
      table = { name: 'sponsor-bookings', head: ['Created', 'Sponsor', 'Slot', 'Month', 'Category', 'Line', 'Link', 'Email', 'Status', 'Paid', 'Views', 'Clicks'],
        rows: rows.map(function (b) { var o = orders[b.order_id]; var c = counts[b.id] || {}; return [date(b.created_at), b.sponsor, where(b), b.month, b.category, b.line, b.link, b.email, BOOK_STATUS[b.status] || b.status, o ? o.status + ' ' + money(o.amount, o.currency) : '', c.views || 0, c.clicks || 0]; }) };
      var waiting = rows.filter(function (b) { return b.status === 'pending'; }).length;
      panel.innerHTML = '<div class="btn-row"><button type="button" class="btn btn--small" data-csv>Export CSV</button><span class="small-print">' + rows.length + ' bookings · ' + waiting + ' waiting for review</span></div>' +
        '<p class="small-print">Check each card against the rules: allowed category, no token promotion, price claims or "buy now", and a safe link. Reject refunds in full.</p>' +
        (rows.length ? rows.map(function (b) {
          var o = orders[b.order_id];
          var c = counts[b.id] || {};
          var stats = location.origin + location.pathname.replace(/admin\/.*$/, 'advertise/stats/') + '?b=' + b.id + '&k=' + b.stats_token;
          return '<article class="card stack stack--tight adm-req" data-booking="' + b.id + '"><div class="cap-row"><h3 class="title-sm">' + esc(b.sponsor) + ' · ' + esc(where(b)) + ' · ' + esc(month(b.month)) + '</h3>' +
            '<span class="chip ' + (b.status === 'approved' ? 'is-mint' : b.status === 'pending' ? 'is-yellow' : 'is-white') + '">' + esc(BOOK_STATUS[b.status] || b.status) + '</span></div>' +
            '<div class="sponsor-card"><span class="sponsor-label">Sponsored</span><img class="sponsor-logo" src="' + esc(logoUrl(b.logo_path)) + '" alt="Logo" /><span class="sponsor-text"><b>' + esc(b.sponsor) + '</b><span>' + esc(b.line) + '</span></span><span class="sponsor-go">→</span></div>' +
            '<p class="small-print">' + esc(b.category) + ' · <a href="' + esc(b.link) + '" target="_blank" rel="noopener nofollow">' + esc(b.link) + '</a> · ' + esc(b.email) + ' · Paid: ' + (o ? esc(o.status) + ' ' + money(o.amount, o.currency) : 'no') +
            ' · ' + (c.views || 0) + ' views, ' + (c.clicks || 0) + ' clicks · <a href="' + esc(stats) + '" target="_blank" rel="noopener">their stats link</a></p>' +
            '<label class="label">Note (only you see it)<textarea class="field" rows="2" data-note>' + esc(b.admin_note || '') + '</textarea></label>' +
            '<div class="btn-row">' +
            (b.status === 'pending' ? '<button type="button" class="btn btn--small btn--yellow" data-book-set="approved">Approve</button>' : '') +
            (b.status === 'pending' || b.status === 'approved' ? '<button type="button" class="btn btn--small acct-danger" data-book-reject>Reject and refund</button>' : '') +
            '<button type="button" class="btn btn--small" data-book-note>Save note</button></div><p class="small-print" data-msg aria-live="polite"></p></article>';
        }).join('') : '<p class="text">No bookings yet. They arrive from the Advertise page.</p>');
      bindCsv(panel);
      panel.querySelectorAll('[data-booking]').forEach(function (card) {
        var id = card.getAttribute('data-booking');
        var msg = card.querySelector('[data-msg]');
        var b = rows.filter(function (x) { return x.id === id; })[0];
        var set = function (status) {
          msg.textContent = 'Saving…';
          return db().rpc('admin_set_booking', { p_id: id, p_status: status, p_note: card.querySelector('[data-note]').value }).then(must);
        };
        var done = function () { delete cache.sponsorBookings; delete cache.orders; render(); };
        var ap = card.querySelector('[data-book-set]');
        if (ap) ap.addEventListener('click', function () { set('approved').then(done, function (err) { msg.textContent = err.message; }); });
        card.querySelector('[data-book-note]').addEventListener('click', function () { set(null).then(done, function (err) { msg.textContent = err.message; }); });
        var rj = card.querySelector('[data-book-reject]');
        if (rj) rj.addEventListener('click', function () {
          if (!window.confirm('Reject this booking and refund it in full?')) return;
          rj.disabled = true;
          set('rejected').then(function () {
            if (!b.order_id || !orders[b.order_id] || orders[b.order_id].status !== 'paid') return null;
            msg.textContent = 'Refunding…';
            return refundOrder(b.order_id).catch(function (err) {
              if (err.crypto && window.confirm(err.message + '\n\nHave you refunded it in Paymento? Press OK to mark it refunded.')) return refundOrder(b.order_id, true);
              throw err;
            });
          }).then(done, function (err) { rj.disabled = false; msg.textContent = 'Rejected, but the refund failed: ' + err.message; });
        });
      });
    });
  }

  // ---------- Project requests ----------

  // Telegram contact for a request: their username and their group link.
  function tgLinks(d) {
    var user = /^@?[A-Za-z0-9_]{5,32}$/.test(d.telegram || '') ? String(d.telegram).replace(/^@/, '') : '';
    var group = /^https:\/\/(t\.me|telegram\.me)\/\S+$/.test(d.tgGroup || '') ? d.tgGroup : '';
    if (!user && !group) return '';
    return '<div class="btn-row">' + (user ? '<a class="btn btn--small" href="https://t.me/' + esc(user) + '" target="_blank" rel="noopener">Telegram @' + esc(user) + '</a>' : '') +
      (group ? '<a class="btn btn--small btn--yellow" href="' + esc(group) + '" target="_blank" rel="noopener">Join their group</a>' : '') + '</div>';
  }

  function requests(panel) {
    return Promise.all([
      load('requests', function () { return db().from('project_requests').select('*').order('created_at', { ascending: false }).then(must); }),
      load('orders', function () { return db().from('orders').select('*').order('created_at', { ascending: false }).limit(5000).then(must); }),
    ]).then(function (r) {
      var rows = r[0];
      var orders = {};
      r[1].forEach(function (o) { orders[o.id] = o; });
      table = { name: 'project-requests', head: ['Date', 'Project', 'Kind', 'Tier', 'Email', 'Website', 'X', 'Telegram', 'Telegram group', 'Status', 'Payment', 'Note'],
        rows: rows.map(function (q) { var o = orders[q.order_id]; var d = q.details || {}; return [date(q.created_at), q.project, q.kind, q.tier, q.email, q.website, q.x_handle, d.telegram || '', d.tgGroup || '', q.status, o ? o.status + ' ' + money(o.amount, o.currency) : 'not paid', q.admin_note]; }) };
      panel.innerHTML = '<div class="btn-row"><button type="button" class="btn btn--small" data-csv>Export CSV</button><span class="small-print">' + rows.length + ' requests</span></div>' +
        (rows.length ? rows.map(function (q) {
          var o = orders[q.order_id];
          return '<article class="card stack stack--tight adm-req" data-req="' + q.id + '"><div class="cap-row"><h3 class="title-sm">' + esc(q.project) + ' · ' + esc(q.kind === 'toy' ? 'Custom toy' : 'Academy course') + (q.tier ? ' (' + esc(q.tier) + ')' : '') + '</h3>' +
            '<span class="chip ' + (q.status === 'declined' ? 'is-white' : 'is-yellow') + '">' + esc(settings.statusNames[q.status] || q.status) + '</span></div>' +
            '<p class="small-print">' + esc(date(q.created_at)) + ' · ' + esc(q.email || '') + (q.website ? ' · ' + esc(q.website) : '') + (q.x_handle ? ' · ' + esc(q.x_handle) : '') +
            ' · Payment: ' + (o ? esc(o.status) + ' ' + money(o.amount, o.currency) : 'not paid yet') + '</p>' +
            tgLinks(q.details || {}) +
            '<details><summary class="small-print">Their answers</summary><pre class="adm-pre">' + esc(JSON.stringify(q.details, null, 2)) + '</pre></details>' +
            '<fieldset class="adm-check"><legend class="label">Vetting checklist</legend>' + settings.vetting.map(function (v) {
              return '<label class="mk-check"><input type="checkbox" data-v="' + v.id + '"' + ((q.checklist || {})[v.id] ? ' checked' : '') + ' /> <span>' + esc(v.text) + '</span></label>';
            }).join('') + '</fieldset>' +
            '<label class="label">Note (only you see it)<textarea class="field" rows="2" data-note>' + esc(q.admin_note || '') + '</textarea></label>' +
            '<div class="btn-row"><select class="field" data-status>' + Object.keys(settings.statusNames).map(function (s) {
              return '<option value="' + s + '"' + (s === q.status ? ' selected' : '') + '>' + esc(settings.statusNames[s]) + '</option>';
            }).join('') + '</select><button type="button" class="btn btn--small" data-save>Save</button>' +
            '<button type="button" class="btn btn--small btn--yellow" data-set="approved">Approve</button><button type="button" class="btn btn--small acct-danger" data-set="declined">Decline</button></div>' +
            '<p class="small-print" data-msg aria-live="polite"></p></article>';
        }).join('') : '<p class="text">No project requests yet. They arrive from the Work with us page (Part 7).</p>');
      bindCsv(panel);
      panel.querySelectorAll('[data-req]').forEach(function (card) {
        var save = function (status) {
          var checklist = {};
          card.querySelectorAll('[data-v]').forEach(function (c) { if (c.checked) checklist[c.getAttribute('data-v')] = true; });
          if (status === 'declined' && !window.confirm('Decline this project? Remember to refund them in full in Razorpay or Paymento.')) return;
          card.querySelector('[data-msg]').textContent = 'Saving…';
          db().rpc('admin_update_request', { p_id: card.getAttribute('data-req'), p_status: status || card.querySelector('[data-status]').value, p_checklist: checklist, p_note: card.querySelector('[data-note]').value })
            .then(must).then(function () { delete cache.requests; render(); }, function (err) { card.querySelector('[data-msg]').textContent = 'Could not save: ' + err.message; });
        };
        card.querySelector('[data-save]').addEventListener('click', function () { save(null); });
        card.querySelectorAll('[data-set]').forEach(function (b) { b.addEventListener('click', function () { save(b.getAttribute('data-set')); }); });
      });
    });
  }

  // ---------- Review queue ----------

  var reviewFilter = 'todo';

  function review(panel) {
    return Promise.all([
      load('reviewIndex', function () { return C.loadJson('../data/review-index.json'); }),
      load('approvals', function () { return db().from('review_approvals').select('*').then(must); }),
    ]).then(function (r) {
      var done = {};
      r[1].forEach(function (a) { done[a.file + '|' + a.item] = a; });
      var items = r[0].items.map(function (it) {
        var a = done[it.file + '|' + it.item];
        return Object.assign({ state: !a ? 'todo' : a.hash === it.hash ? 'approved' : 'changed', approvedAt: a && a.approved_at }, it);
      });
      var n = function (s) { return items.filter(function (i) { return i.state === s; }).length; };
      var shown = items.filter(function (i) { return reviewFilter === 'all' || (reviewFilter === 'todo' ? i.state !== 'approved' : i.state === reviewFilter); });
      var label = { todo: 'To review', changed: 'Changed since approval', approved: 'Approved' };
      table = { name: 'review-queue', head: ['File', 'Item', 'What', 'State', 'Approved on'], rows: items.map(function (i) { return [i.file, i.item, i.label, label[i.state], date(i.approvedAt)]; }) };
      panel.innerHTML = tiles([['To review', n('todo')], ['Changed since approval', n('changed')], ['Approved', n('approved')]]) +
        '<p class="small-print">Every item marked "review": true in the data files. Approving records your OK here; if the item is edited later it comes back as changed. When a file is fully approved, ask me to remove its review marks.</p>' +
        '<div class="btn-row"><select class="field" data-filter>' + [['todo', 'To review and changed'], ['changed', 'Changed only'], ['approved', 'Approved'], ['all', 'Everything']].map(function (f) {
          return '<option value="' + f[0] + '"' + (f[0] === reviewFilter ? ' selected' : '') + '>' + f[1] + '</option>';
        }).join('') + '</select><button type="button" class="btn btn--small" data-csv>Export CSV</button></div>' +
        '<ul class="adm-review">' + shown.map(function (i) {
          return '<li class="is-' + i.state + '"><div><b>' + esc(i.label) + '</b><span class="small-print">' + esc(i.file) + (i.item !== '(whole file)' ? ' · ' + esc(i.item) : ' · whole file') + (i.state === 'changed' ? ' · edited since you approved it' : '') + '</span>' +
            (i.note ? '<span class="small-print adm-note">' + esc(i.note) + '</span>' : '') + '</div>' +
            (i.state === 'approved' ? '<button type="button" class="btn btn--small" data-undo="' + esc(i.file + '|' + i.item) + '">Undo</button>'
              : '<button type="button" class="btn btn--small btn--yellow" data-ok="' + esc(i.file + '|' + i.item + '|' + i.hash) + '">Approved</button>') + '</li>';
        }).join('') + '</ul>';
      bindCsv(panel);
      panel.querySelector('[data-filter]').addEventListener('change', function (e) { reviewFilter = e.target.value; render(); });
      var act = function (file, item, hash, undo) {
        return db().rpc('admin_approve', { p_file: file, p_item: item, p_hash: hash || '', p_undo: !!undo }).then(must).then(function () { delete cache.approvals; render(); }, function (err) { window.alert('Could not save: ' + err.message); });
      };
      panel.querySelectorAll('[data-ok]').forEach(function (b) {
        b.addEventListener('click', function () { var p = b.getAttribute('data-ok').split('|'); b.disabled = true; act(p[0], p[1], p[2], false); });
      });
      panel.querySelectorAll('[data-undo]').forEach(function (b) {
        b.addEventListener('click', function () { var p = b.getAttribute('data-undo').split('|'); act(p[0], p[1], '', true); });
      });
    });
  }

  start();
})();
