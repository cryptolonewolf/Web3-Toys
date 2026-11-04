// The admin dashboard (admin/). Only works for accounts in the admins table:
// every number comes from the database, which refuses anyone else. Tabs:
// Users, Leads, Purchases, Bookings, Project requests, Review queue,
// Referrals, Releases and Toy stats, each with Export CSV. Settings: data/admin.json.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var TABS = [['users', 'Users'], ['leads', 'Leads'], ['purchases', 'Purchases'], ['bookings', 'Bookings'], ['requests', 'Project requests'], ['review', 'Review queue'], ['growth', 'Referrals & posts'], ['releases', 'Releases'], ['stats', 'Toy stats']];
  var tab = (location.hash.replace('#', '') || 'users');
  var days = 30;
  var settings = null;
  var home = null;
  var ranks = null;
  var cache = {};
  var table = null;

  if (!TABS.some(function (t) { return t[0] === tab; })) tab = 'users';

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
        tab = b.getAttribute('data-tab');
        if (history.replaceState) history.replaceState(null, '', '#' + tab);
        render();
      });
    });
    app.querySelector('[data-days]').addEventListener('change', function (e) {
      days = Number(e.target.value);
      delete cache.events;
      render();
    });
    var panel = app.querySelector('[data-panel]');
    ({ users: users, leads: leads, purchases: purchases, bookings: bookings, requests: requests, review: review, growth: growth, releases: releases, stats: stats })[tab](panel)
      .catch(function (err) { panel.innerHTML = '<p class="tk-warn is-bad">Could not load: ' + esc(err.message) + '</p>'; });
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
    return Promise.all([
      R.reload(),
      db().from('release_overrides').select('*').then(must),
      load('notify', function () { return db().from('release_notify').select('toy_id').limit(100000).then(must); }),
    ]).then(function (r) {
      var over = {};
      r[1].forEach(function (o) { over[o.toy_id] = o; });
      var asked = {};
      r[2].forEach(function (n) { asked[n.toy_id] = (asked[n.toy_id] || 0) + 1; });
      var when = function (d) { return d ? R.dayLabel(d) + ' ' + d.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'Asia/Kolkata' }) : ''; };
      var rows = R.list().map(function (t) {
        var i = R.info(t.id);
        var o = over[t.id];
        return { t: t, i: i, o: o, row: [(cards[t.id] || {}).title || t.id, when(new Date(Date.parse(t.date))), i.status + (i.isNew ? ' (new)' : ''),
          o ? (o.action === 'release' ? 'Released early' : 'Delayed' + (o.until ? ' to ' + when(new Date(o.until)) : '')) : '', t.ready ? 'yes' : 'not built yet', asked[t.id] || 0] };
      });
      var head = ['Toy', 'Date in releases.json', 'Status now', 'Your override', 'Built', 'Notify me'];
      panel.innerHTML = '<p class="small-print">Server time: ' + esc(R.now().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })) + ' India time. Change dates in data/releases.json; use these buttons to release early or delay without editing it.</p>' +
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
