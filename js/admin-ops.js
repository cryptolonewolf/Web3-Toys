// The Operations home in admin (the first tab), the Inbox (refunds, contact
// messages, failed or disputed payments, X posts, flagged referrals), the
// audit log and Revenue. Settings and your to-do list: data/ops.json.
// Database: supabase/017_ops.sql (admin_ops, admin_setup_status, ...).
// "Show sample data" fills everything with made-up numbers (labelled).
//   Web3AdminOps.home(panel, ctx) / inbox(panel, ctx, sub) / audit(panel, ctx) / revenue(panel, ctx)
// ctx comes from js/admin.js: db, load, cache, esc, must, tiles, grid, bindCsv, render, go, refundOrder, date.

(function () {
  var SAMPLE_KEY = 'web3toys.opsSample.v1';
  var HOUR = 36e5, DAY = 864e5;
  function sampleOn() { try { return localStorage.getItem(SAMPLE_KEY) === '1'; } catch (e) { return false; } }
  function setSample(on) { try { if (on) localStorage.setItem(SAMPLE_KEY, '1'); else localStorage.removeItem(SAMPLE_KEY); } catch (e) { /* private mode */ } }
  function ago(ms) { return new Date(Date.now() - ms).toISOString(); }
  function age(iso) {
    if (!iso) return '';
    var h = (Date.now() - Date.parse(iso)) / HOUR;
    return h < 1 ? 'under an hour' : h < 48 ? Math.floor(h) + ' h' : Math.floor(h / 24) + ' days';
  }
  function money(cents, cur) { var n = (Number(cents) || 0) / 100; return cur === 'INR' ? '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  // Colour by the age of the oldest item: green, amber, red (data/ops.json hours).
  function level(q, hours) {
    if (!q.count) return 'clear';
    var h = q.oldest ? (Date.now() - Date.parse(q.oldest)) / HOUR : 0;
    return h >= hours.red ? 'red' : h >= hours.amber ? 'amber' : 'green';
  }
  var RANK = { red: 0, amber: 1, green: 2, clear: 3 };
  function sortQueues(list, hours) {
    return list.map(function (q, i) { return Object.assign({ level: level(q, hours), order: i }, q); }).sort(function (a, b) {
      return RANK[a.level] - RANK[b.level] || (Date.parse(a.oldest || 0) || Infinity) - (Date.parse(b.oldest || 0) || Infinity) || a.order - b.order;
    });
  }

  // Product groups for revenue (For Projects products by their id).
  function group(id, catalog) {
    if (/^deposit-toy-/.test(id)) return 'Launch Your Own Toy';
    if (/^deposit-test-/.test(id)) return 'Test Your Product';
    if (/^ad-/.test(id)) return 'Sponsor a Toy';
    if (/^pro-/.test(id)) return 'Pro pages';
    var p = catalog[id];
    var t = p && p.type;
    return { report: 'Reports', cert: 'Certificates', book: 'Books', call: 'Calls', project: 'Work with us', course: 'Quests' }[t] || (p ? p.title : id);
  }

  // ---------- Sample data ----------
  function sample() {
    return {
      queues: [
        { id: 'toyreq', count: 2, oldest: ago(30 * HOUR) }, { id: 'testreq', count: 1, oldest: ago(5 * HOUR) },
        { id: 'testruns', count: 6, oldest: ago(80 * HOUR) }, { id: 'sponsors', count: 1, oldest: ago(2 * HOUR) },
        { id: 'posts', count: 4, oldest: ago(20 * HOUR) }, { id: 'referrals', count: 0, oldest: null },
        { id: 'refunds', count: 1, oldest: ago(50 * HOUR) }, { id: 'contact', count: 3, oldest: ago(10 * HOUR) },
        { id: 'courses', count: 0, oldest: null }, { id: 'review', count: 12, oldest: ago(9 * DAY) }, { id: 'payments', count: 1, oldest: ago(3 * HOUR) },
      ],
      numbers: {
        plays: [1840, 1525], finishes: [960, 870], accounts: [212, 240], signups: [95, 61], certificates: [410, 352], shares: [77, 80],
        yesterday: { plays: 281, accounts: 30, signups: 14, certificates: 66 },
        revenue: [
          { product: 'report-full', currency: 'USD', now: 4990, before: 2994 }, { product: 'report-full', currency: 'INR', now: 199500, before: 159600 },
          { product: 'deposit-toy-full', currency: 'USD', now: 124950, before: null }, { product: 'ad-toy-scam', currency: 'USD', now: null, before: 50000 },
          { product: 'cert-hd', currency: 'INR', now: 59700, before: 39800 },
        ],
      },
      today: {
        overrides: [],
        earlyBird: [{ toy: 'crypto-in-5', spots: 1000, taken: 812 }, { toy: 'scam', spots: 1000, taken: 1000 }, { toy: 'getting-started', spots: 1000, taken: 145 }],
        sponsors: [{ sponsor: 'Example Wallet', kind: 'toy', toy: 'scam', month: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString().slice(0, 10), status: 'approved' }],
      },
      health: {
        errors: 7, topErrors: [{ page: '/scam/', item: "Cannot read properties of null (reading 'focus')", n: 5 }, { page: '/academy/', item: 'Promise: Failed to fetch', n: 2 }],
        webhook: 1, webhookLast: [{ source: 'razorpay-webhook', detail: 'Could not update order (HTTP 500)', created_at: ago(6 * HOUR) }],
        linkRun: { detail: '214 links on 38 pages', created_at: ago(2 * DAY) }, links: [{ source: '/hall-of-fame/vitalik-buterin/', detail: 'https://example.org/old-page → 404' }],
        slow: [{ page: '/simulator/', ms: 4120, n: 18 }],
      },
    };
  }

  // ---------- Function versions (for the to-do list) ----------
  function ping(name) {
    var sb = (window.WEB3TOYS_CONFIG || {}).supabase || {};
    if (!sb.url) return Promise.resolve(null);
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 6000) : 0;
    return fetch(sb.url.replace(/\/$/, '') + '/functions/v1/' + name + '?ping=1', { signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (j) { clearTimeout(t); return j; });
  }

  function todoState(item, S) {
    var c = item.check || 'manual';
    var cfg = window.WEB3TOYS_CONFIG || {};
    if (S.todos[item.id]) return { done: true, how: 'ticked' };
    if (/^sql-/.test(c)) return { done: !!S.setup[c] };
    if (/^fn:/.test(c)) {
      var parts = c.split(':');
      var p = S.pings[parts[1]];
      return { done: !!(p && Number(p.version) >= Number(parts[2])), note: p ? 'version ' + p.version : 'not deployed, or an older copy' };
    }
    if (c === 'razorpay-live') { var co = S.pings['create-order']; return { done: !!(co && co.live), note: co ? (co.live ? 'live keys' : 'test keys') : 'unknown' }; }
    if (c === 'resend') { var d = S.pings['ops-digest'] || S.pings['launch-emails']; return { done: !!(d && d.email), note: d ? (d.email ? 'set' : 'RESEND_API_KEY missing') : 'unknown' }; }
    if (c === 'social') return { done: !!((cfg.social || {}).x && (cfg.social || {}).telegram) };
    if (c === 'books') return { done: S.setup.books >= S.bookCount && S.bookCount > 0, note: (S.setup.books || 0) + ' of ' + S.bookCount + ' uploaded' };
    if (c === 'portraits') return { done: S.portraits.have >= S.portraits.total, note: S.portraits.have + ' of ' + S.portraits.total };
    if (c === 'audience') return { done: !S.audienceTbd, note: S.audienceTbd ? 'still says TBD' : '' };
    if (c === 'review') return { done: S.reviewLeft === 0, note: S.reviewLeft + ' left' };
    if (c === 'business-live') return { done: !!(cfg.business || {}).live, note: 'planned for December' };
    return { done: false, manual: true };
  }

  // ---------- Home ----------
  function home(panel, ctx) {
    var esc = ctx.esc, db = ctx.db;
    var isSample = sampleOn();
    return Promise.all([
      ctx.load('opsJson', function () { return window.Web3Common.loadJson('../data/ops.json'); }),
      ctx.load('reviewIndex', function () { return window.Web3Common.loadJson('../data/review-index.json'); }),
      ctx.load('approvals', function () { return db().from('review_approvals').select('*').then(ctx.must); }),
      ctx.load('releasesJson', function () { return window.Web3Common.loadJson('../data/releases.json'); }),
    ]).then(function (r) {
      var O = r[0];
      var done = {};
      r[2].forEach(function (a) { done[a.file + '|' + a.item] = a.hash; });
      var pending = r[1].items.filter(function (it) { return done[it.file + '|' + it.item] !== it.hash; }).map(function (it) { return it.hash; });
      var data = isSample ? Promise.resolve(sample()) : ctx.load('ops', function () { return db().rpc('admin_ops', { p_review: pending }).then(ctx.must); });
      return data.then(function (D) {
        var meta = {};
        O.queues.forEach(function (q) { meta[q.id] = q; });
        var queues = sortQueues(O.queues.map(function (m) { return D.queues.filter(function (q) { return q.id === m.id; })[0] || { id: m.id, count: 0 }; }), O.hours);
        var red = queues.filter(function (q) { return q.level === 'red'; }).length;
        var waiting = queues.reduce(function (s, q) { return s + Number(q.count || 0); }, 0);
        panel.innerHTML =
          '<div class="ops-top"><div><h2 class="title-md">Operations</h2><p class="small-print">' + (waiting ? waiting + ' waiting' + (red ? ' · <b class="ops-red-text">' + red + ' overdue</b>' : '') : 'All clear 🎉') + '</p></div>' +
          '<label class="mk-check ops-sample"><input type="checkbox" data-sample' + (isSample ? ' checked' : '') + ' /> <span>Show sample data</span></label></div>' +
          (isSample ? '<p class="ops-sample-note">Sample data · made-up numbers to preview this page. Untick to see real data.</p>' : '') +
          '<ul class="ops-queues">' + queues.map(function (q) {
            var m = meta[q.id];
            return '<li class="ops-q is-' + q.level + '"><span class="ops-q-icon" aria-hidden="true">' + m.icon + '</span>' +
              '<div class="ops-q-body"><b>' + esc(m.label) + '</b><span class="small-print">' + (q.count ? 'oldest ' + esc(age(q.oldest) || 'unknown') : 'nothing waiting') + '</span></div>' +
              '<span class="ops-q-count" aria-label="' + q.count + ' waiting">' + q.count + '</span>' +
              '<button type="button" class="btn btn--small' + (q.count ? ' btn--ink' : '') + '" data-open="' + esc(m.open) + '">Open</button></li>';
          }).join('') + '</ul>' +
          '<p class="small-print ops-legend"><span class="ops-dot is-green"></span> under ' + O.hours.amber + ' h <span class="ops-dot is-amber"></span> under ' + O.hours.red + ' h <span class="ops-dot is-red"></span> over ' + O.hours.red + ' h</p>' +
          todayHtml(D.today, r[3], esc) + numbersHtml(D.numbers, esc) + healthHtml(D.health, esc) +
          '<section class="card stack stack--tight ops-todo" data-todo><h3 class="title-sm">✅ Your to-do</h3><p class="small-print">Checking…</p></section>';
        panel.querySelector('[data-sample]').addEventListener('change', function (e) { setSample(e.target.checked); ctx.render(); });
        panel.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { ctx.go(b.getAttribute('data-open')); }); });
        todo(panel.querySelector('[data-todo]'), ctx, O, pending.length, isSample);
      });
    });
  }

  function todayHtml(T, rel, esc) {
    var now = Date.now();
    var over = {};
    (T.overrides || []).forEach(function (o) { over[o.toy_id] = o; });
    var decide = window.Web3Releases && window.Web3Releases.decide;
    var soon = rel.toys.map(function (t) {
      var d = decide ? decide(t, now, over[t.id], rel.newDays) : { status: 'locked', at: new Date(t.date) };
      return { id: t.id, d: d, at: d.at ? d.at.getTime() : NaN };
    }).filter(function (x) { return x.at >= now - DAY && x.at <= now + 7 * DAY; }).sort(function (a, b) { return a.at - b.at; });
    var STAT = { live: ['is-mint', 'Live'], locked: ['is-yellow', 'Scheduled'], delayed: ['is-white', 'Delayed'] };
    var birds = (T.earlyBird || []).filter(function (b) { return b.spots - b.taken > 0 || (b.spots && b.taken >= b.spots); });
    var mon = function (iso) { return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }); };
    var sp = (T.sponsors || []).map(function (s) {
      var start = Date.parse(s.month + 'T00:00:00Z');
      var end = Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth() + 1, 0);
      var starts = start >= now - 7 * DAY && start <= now + 7 * DAY;
      return { s: s, label: starts ? 'starts ' + new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'ends ' + new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) };
    });
    return '<section class="stack stack--tight"><h3 class="title-sm">📅 This week</h3><div class="ops-today">' +
      '<div class="card stack stack--tight"><b>Toy releases</b>' + (soon.length ? '<ul class="ops-list">' + soon.map(function (x) {
        var st = STAT[x.d.status] || STAT.locked;
        return '<li><span>' + esc(x.id) + '</span><span class="small-print">' + new Date(x.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) + '</span><span class="chip ' + st[0] + '">' + st[1] + '</span></li>';
      }).join('') + '</ul>' : '<p class="small-print">No releases in the next 7 days.</p>') + '</div>' +
      '<div class="card stack stack--tight"><b>Early Bird spots left</b>' + (birds.length ? '<ul class="ops-list">' + birds.map(function (b) {
        var left = Math.max(0, b.spots - b.taken);
        return '<li><span>' + esc(b.toy) + '</span><span class="ops-meter" aria-hidden="true"><i style="width:' + Math.round(b.taken / b.spots * 100) + '%"></i></span><span class="small-print">' + (left ? left.toLocaleString('en-US') + ' left' : 'full') + '</span></li>';
      }).join('') + '</ul>' : '<p class="small-print">No Early Bird toys.</p>') + '</div>' +
      '<div class="card stack stack--tight"><b>Sponsor slots</b>' + (sp.length ? '<ul class="ops-list">' + sp.map(function (x) {
        return '<li><span>' + esc(x.s.sponsor) + '</span><span class="small-print">' + esc(x.s.kind === 'toy' ? x.s.toy : x.s.kind) + ' · ' + esc(mon(x.s.month)) + '</span><span class="chip ' + (x.s.status === 'approved' ? 'is-mint' : 'is-yellow') + '">' + esc(x.label) + '</span></li>';
      }).join('') + '</ul>' : '<p class="small-print">None start or end this week.</p>') + '</div></div></section>';
  }

  function delta(a, b) {
    a = Number(a) || 0; b = Number(b) || 0;
    if (!b) return a ? '<span class="ops-up">new</span>' : '<span class="small-print">-</span>';
    var p = Math.round((a - b) / b * 100);
    return '<span class="' + (p > 0 ? 'ops-up' : p < 0 ? 'ops-down' : 'small-print') + '">' + (p > 0 ? '▲ ' : p < 0 ? '▼ ' : '') + Math.abs(p) + '%</span>';
  }

  function numbersHtml(N, esc) {
    var tiles = [['plays', 'Plays', '🎮'], ['accounts', 'New accounts', '🙋'], ['signups', 'Email signups', '📧'], ['certificates', 'Certificates', '🎓'], ['shares', 'Shares', '🔁']];
    var cur = {};
    (N.revenue || []).forEach(function (r) {
      var c = cur[r.currency] = cur[r.currency] || { now: 0, before: 0, rows: [] };
      c.now += Number(r.now || 0); c.before += Number(r.before || 0); c.rows.push(r);
    });
    return '<section class="stack stack--tight"><h3 class="title-sm">📊 Last 7 days <span class="small-print">vs the 7 days before</span></h3><ul class="ops-nums">' +
      tiles.map(function (t) {
        var v = N[t[0]] || [0, 0];
        return '<li class="card"><span class="small-print">' + t[2] + ' ' + t[1] + '</span><b>' + Number(v[0]).toLocaleString('en-US') + '</b>' + delta(v[0], v[1]) + '</li>';
      }).join('') +
      (Object.keys(cur).length ? Object.keys(cur).map(function (k) {
        return '<li class="card"><span class="small-print">💰 Revenue ' + k + '</span><b>' + money(cur[k].now, k) + '</b>' + delta(cur[k].now, cur[k].before) + '</li>';
      }).join('') : '<li class="card"><span class="small-print">💰 Revenue</span><b>-</b><span class="small-print">no sales yet</span></li>') + '</ul>' +
      (Object.keys(cur).length ? '<details class="card"><summary><b>Revenue by product</b></summary><div class="adm-scroll"><table class="tk-table adm-table"><thead><tr><th>Product</th><th>Last 7 days</th><th>7 days before</th></tr></thead><tbody>' +
        (N.revenue || []).slice().sort(function (a, b) { return (b.now || 0) - (a.now || 0); }).map(function (r) {
          return '<tr><td>' + esc(r.product) + '</td><td>' + money(r.now, r.currency) + '</td><td>' + money(r.before, r.currency) + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="small-print">Full history by month: the Revenue tab.</p></details>' : '') +
      '<p class="small-print">Plays count the first tap in a toy (new since the Operations home; earlier weeks show 0).</p></section>';
  }

  function healthHtml(H, esc) {
    var bad = function (n) { return n ? ' is-bad' : ' is-good'; };
    var run = H.linkRun;
    return '<section class="card stack stack--tight ops-health"><h3 class="title-sm">🩺 Site health</h3><ul class="ops-list">' +
      '<li><span>Page errors, last 24 h</span><span class="tk-warn' + bad(H.errors) + '">' + H.errors + '</span></li>' +
      '<li><span>Payment webhook failures, 7 days</span><span class="tk-warn' + bad(H.webhook) + '">' + H.webhook + '</span></li>' +
      '<li><span>Broken links' + (run ? ' <span class="small-print">(checked ' + esc(age(run.created_at)) + ' ago)</span>' : '') + '</span><span class="tk-warn' + (run ? bad((H.links || []).length) : '') + '">' + (run ? (H.links || []).length : 'not run yet') + '</span></li>' +
      '<li><span>Pages slower than 3 s</span><span class="tk-warn' + bad((H.slow || []).length + (H.slowCheck || []).length) + '">' + ((H.slow || []).length + (H.slowCheck || []).length) + '</span></li></ul>' +
      ((H.topErrors || []).length ? '<details><summary class="small-print">Top errors</summary><ul class="ops-detail">' + H.topErrors.map(function (e) { return '<li><code>' + esc(e.item) + '</code> <span class="small-print">' + esc(e.page) + ' · ' + e.n + '×</span></li>'; }).join('') + '</ul></details>' : '') +
      ((H.webhookLast || []).length ? '<details><summary class="small-print">Webhook failures</summary><ul class="ops-detail">' + H.webhookLast.map(function (e) { return '<li>' + esc(e.source) + ': ' + esc(e.detail) + ' <span class="small-print">' + esc(age(e.created_at)) + ' ago</span></li>'; }).join('') + '</ul></details>' : '') +
      ((H.links || []).length ? '<details><summary class="small-print">Broken links</summary><ul class="ops-detail">' + H.links.map(function (e) { return '<li><a href="' + esc(e.source) + '">' + esc(e.source) + '</a>: ' + esc(e.detail) + '</li>'; }).join('') + '</ul></details>' : '') +
      ((H.slow || []).length + (H.slowCheck || []).length ? '<details><summary class="small-print">Slow pages</summary><ul class="ops-detail">' + (H.slow || []).map(function (e) { return '<li>' + esc(e.page) + ': ' + (e.ms / 1000).toFixed(1) + ' s on average for visitors (' + e.n + ' visits)</li>'; }).join('') +
        (H.slowCheck || []).map(function (e) { return '<li>' + esc(e.source) + ': ' + esc(e.detail) + ' in the weekly check</li>'; }).join('') + '</ul></details>' : '') +
      '</section>';
  }

  function todo(box, ctx, O, reviewLeft, isSample) {
    var esc = ctx.esc, db = ctx.db;
    var fns = {};
    O.todo.forEach(function (t) { if (/^fn:/.test(t.check)) fns[t.check.split(':')[1]] = true; });
    var names = Object.keys(fns);
    Promise.all([
      isSample ? Promise.resolve({ 'sql-007': true, 'sql-010': true, 'sql-012': true, 'sql-014': true, books: 1, todos: {} }) : db().rpc('admin_setup_status').then(ctx.must),
      isSample ? Promise.resolve(names.map(function (n, i) { return i < 2 ? { version: 2, live: false, email: false } : null; })) : Promise.all(names.map(ping)),
      ctx.load('productsJson', function () { return window.Web3Common.loadJson('../data/products.json').catch(function () { return {}; }); }),
      ctx.load('hofJson', function () { return window.Web3Common.loadJson('../data/hall-of-fame-people.json').catch(function () { return { people: [] }; }); }),
      ctx.load('advJson', function () { return window.Web3Common.loadJson('../data/business/advertise_page.json').catch(function () { return {}; }); }),
    ]).then(function (r) {
      var pings = {};
      names.forEach(function (n, i) { pings[n] = r[1][i]; });
      var books = (r[2].products || []).filter(function (p) { return p.file; });
      var S = { setup: r[0], todos: r[0].todos || {}, pings: pings, bookCount: books.length, reviewLeft: reviewLeft,
        portraits: { have: (r[3].people || []).filter(function (p) { return p.photo; }).length, total: (r[3].people || []).length },
        audienceTbd: /TBD/.test(JSON.stringify(r[4].audience || '')) };
      var items = O.todo.map(function (t) { return Object.assign({ state: todoState(t, S) }, t); });
      var left = items.filter(function (t) { return !t.state.done; });
      var groups = [];
      left.forEach(function (t) { if (groups.indexOf(t.group) < 0) groups.push(t.group); });
      box.innerHTML = '<div class="cap-row"><h3 class="title-sm">✅ Your to-do</h3><span class="chip ' + (left.length ? 'is-yellow' : 'is-mint') + '">' + (items.length - left.length) + ' of ' + items.length + ' done</span></div>' +
        (left.length ? groups.map(function (g) {
          return '<p class="label">' + esc(g) + '</p><ul class="ops-todo-list">' + left.filter(function (t) { return t.group === g; }).map(function (t) {
            return '<li><label class="mk-check"><input type="checkbox" data-tick="' + esc(t.id) + '"' + (t.state.manual ? '' : ' title="Ticks itself when done; tick to hide it anyway"') + ' /> <span><b>' + esc(t.title) + '</b>' +
              (t.state.note ? ' <span class="chip is-white">' + esc(t.state.note) + '</span>' : '') + '<span class="small-print">' + esc(t.how) + '</span></span></label></li>';
          }).join('') + '</ul>';
        }).join('') : '<p class="text">Everything on your list is done. 🎉</p>') +
        (items.length - left.length ? '<details><summary class="small-print">Done (' + (items.length - left.length) + ')</summary><ul class="ops-todo-list is-done">' + items.filter(function (t) { return t.state.done; }).map(function (t) {
          return '<li><span>✅ ' + esc(t.title) + '</span>' + (S.todos[t.id] ? ' <button type="button" class="text-button" data-untick="' + esc(t.id) + '">undo</button>' : '') + '</li>';
        }).join('') + '</ul></details>' : '') +
        '<p class="small-print">Most items tick themselves when the check passes. Edit this list in data/ops.json.</p>';
      var tick = function (id, on) {
        if (isSample) { window.alert('Sample data is on: nothing is saved.'); return; }
        db().rpc('admin_todo', { p_key: id, p_done: on }).then(ctx.must).then(function () { todo(box, ctx, O, reviewLeft, isSample); }, function (err) { window.alert(err.message); });
      };
      box.querySelectorAll('[data-tick]').forEach(function (c) { c.addEventListener('change', function () { tick(c.getAttribute('data-tick'), true); }); });
      box.querySelectorAll('[data-untick]').forEach(function (c) { c.addEventListener('click', function () { tick(c.getAttribute('data-untick'), false); }); });
    }).catch(function (err) { box.innerHTML = '<p class="small-print">Could not check the setup: ' + esc(err.message) + '</p>'; });
  }

  // ---------- Inbox ----------
  var SUBS = [['refunds', 'Refund requests'], ['payments', 'Failed or disputed payments'], ['contact', 'Contact messages'], ['posts', 'Post to unlock'], ['referrals', 'Flagged referrals']];

  function inbox(panel, ctx, sub) {
    var esc = ctx.esc, db = ctx.db;
    sub = SUBS.some(function (s) { return s[0] === sub; }) ? sub : 'refunds';
    var nav = '<div class="btn-row ops-subs">' + SUBS.map(function (s) {
      return '<button type="button" class="btn btn--small' + (s[0] === sub ? ' btn--ink' : '') + '" data-sub="' + s[0] + '">' + s[1] + '</button>';
    }).join('') + '</div>';
    var bindNav = function () { panel.querySelectorAll('[data-sub]').forEach(function (b) { b.addEventListener('click', function () { ctx.go('inbox:' + b.getAttribute('data-sub')); }); }); };
    var done = function () { delete ctx.cache.ops; ['inboxRefunds', 'inboxPayments', 'inboxContact', 'inboxPosts', 'inboxReferrals', 'orders'].forEach(function (k) { delete ctx.cache[k]; }); ctx.render(); };
    var fail = function (el) { return function (err) { el.textContent = err.message; }; };
    var orders = function () { return ctx.load('orders', function () { return db().from('orders').select('*').order('created_at', { ascending: false }).limit(5000).then(ctx.must); }); };

    if (sub === 'refunds') {
      return Promise.all([ctx.load('inboxRefunds', function () { return db().from('refund_requests').select('*').order('created_at').then(ctx.must); }), orders()]).then(function (r) {
        var byId = {};
        r[1].forEach(function (o) { byId[o.id] = o; });
        var open = r[0].filter(function (q) { return q.status === 'open'; });
        panel.innerHTML = nav + (open.length ? open.map(function (q) {
          var o = byId[q.order_id] || {};
          return '<article class="card stack stack--tight" data-rq="' + esc(q.id) + '"><div class="cap-row"><b>' + esc(o.title || 'Order') + ' · ' + money(o.amount, o.currency) + '</b><span class="small-print">' + esc(age(q.created_at)) + ' ago</span></div>' +
            '<p class="small-print">' + esc(o.email || '') + ' · paid ' + esc(ctx.date(o.paid_at)) + ' · ' + esc(o.provider || 'razorpay') + '</p><p class="text">"' + esc(q.reason) + '"</p>' +
            '<input class="field" data-note maxlength="300" placeholder="Note (for the decline reason)" />' +
            '<div class="btn-row"><button type="button" class="btn btn--small acct-danger" data-refund="' + esc(q.order_id) + '">Refund in full</button><button type="button" class="btn btn--small" data-decline>Decline</button>' +
            (o.email ? '<a class="btn btn--small" href="mailto:' + esc(o.email) + '?subject=' + encodeURIComponent('Your web3.toys refund request') + '">Email them</a>' : '') + '</div><p class="small-print" data-msg></p></article>';
        }).join('') : '<p class="text">No refund requests waiting.</p>') +
          (r[0].length > open.length ? '<details><summary class="small-print">Handled (' + (r[0].length - open.length) + ')</summary><ul class="ops-detail">' + r[0].filter(function (q) { return q.status !== 'open'; }).map(function (q) {
            return '<li>' + esc((byId[q.order_id] || {}).title || q.order_id) + ': ' + esc(q.status) + ' ' + esc(ctx.date(q.handled_at)) + (q.admin_note ? ' · ' + esc(q.admin_note) : '') + '</li>';
          }).join('') + '</ul></details>' : '');
        bindNav();
        panel.querySelectorAll('[data-rq]').forEach(function (card) {
          var msg = card.querySelector('[data-msg]');
          card.querySelector('[data-refund]').addEventListener('click', function (e) {
            if (!window.confirm('Refund this order in full?')) return;
            e.target.disabled = true; msg.textContent = 'Refunding…';
            ctx.refundOrder(e.target.getAttribute('data-refund')).then(done, function (err) {
              if (err.crypto && window.confirm(err.message + '\n\nHave you refunded it in Paymento? Press OK to mark it refunded.')) return ctx.refundOrder(e.target.getAttribute('data-refund'), true).then(done);
              e.target.disabled = false; msg.textContent = err.message;
            });
          });
          card.querySelector('[data-decline]').addEventListener('click', function () {
            db().rpc('admin_refund_request', { p_id: card.getAttribute('data-rq'), p_status: 'declined', p_note: card.querySelector('[data-note]').value }).then(ctx.must).then(done, fail(msg));
          });
        });
      });
    }
    if (sub === 'payments') {
      return orders().then(function (rows) {
        var list = rows.filter(function (o) { return !o.ops_reviewed_at && (o.disputed_at || (o.status === 'failed' && Date.parse(o.created_at) > Date.now() - 30 * DAY)); });
        panel.innerHTML = nav + (list.length ? list.map(function (o) {
          return '<article class="card stack stack--tight" data-pay="' + esc(o.id) + '"><div class="cap-row"><b>' + esc(o.title) + ' · ' + money(o.amount, o.currency) + '</b><span class="chip ' + (o.disputed_at ? 'is-white">⚠️ Disputed' : 'is-white">Failed') + '</span></div>' +
            '<p class="small-print">' + esc(o.email || '') + ' · ' + esc(ctx.date(o.disputed_at || o.created_at)) + (o.razorpay_payment_id ? ' · ' + esc(o.razorpay_payment_id) : '') + '</p>' +
            (o.dispute_note ? '<p class="text">' + esc(o.dispute_note) + '</p>' : '') +
            '<p class="small-print">' + (o.disputed_at ? 'Answer the dispute in Razorpay, Disputes, with proof of delivery (the purchase in their account and the download log).' : 'A payment that did not go through. Usually nothing to do; email them if they may need help.') + '</p>' +
            '<div class="btn-row"><button type="button" class="btn btn--small btn--yellow" data-seen>Mark reviewed</button>' + (o.email ? '<a class="btn btn--small" href="mailto:' + esc(o.email) + '">Email them</a>' : '') + '</div><p class="small-print" data-msg></p></article>';
        }).join('') : '<p class="text">No failed or disputed payments waiting.</p>');
        bindNav();
        panel.querySelectorAll('[data-pay]').forEach(function (c) { c.querySelector('[data-seen]').addEventListener('click', function () { db().rpc('admin_mark_reviewed', { p_kind: 'payment', p_key: c.getAttribute('data-pay') }).then(ctx.must).then(done, fail(c.querySelector('[data-msg]'))); }); });
      });
    }
    if (sub === 'contact') {
      return ctx.load('inboxContact', function () { return db().from('contact_messages').select('*').order('created_at', { ascending: false }).limit(500).then(ctx.must); }).then(function (rows) {
        var open = rows.filter(function (m) { return m.status === 'new'; });
        var TOPIC = { general: 'Something else', payment: 'Payment or refund', project: 'Their project', privacy: 'Data and privacy', bug: 'Something is broken' };
        panel.innerHTML = nav + (open.length ? open.map(function (m) {
          return '<article class="card stack stack--tight" data-ct="' + esc(m.id) + '"><div class="cap-row"><b>' + esc(m.name) + '</b><span class="chip is-yellow">' + esc(TOPIC[m.topic] || m.topic) + '</span></div>' +
            '<p class="small-print">' + esc(m.email) + ' · ' + esc(age(m.created_at)) + ' ago</p><p class="text ops-msg">' + esc(m.message) + '</p>' +
            '<div class="btn-row"><a class="btn btn--small btn--ink" href="mailto:' + esc(m.email) + '?subject=' + encodeURIComponent('Re: your message to web3.toys') + '">Reply by email</a><button type="button" class="btn btn--small btn--yellow" data-done>Mark done</button></div><p class="small-print" data-msg></p></article>';
        }).join('') : '<p class="text">No new messages.</p>') +
          (rows.length > open.length ? '<details><summary class="small-print">Done (' + (rows.length - open.length) + ')</summary><ul class="ops-detail">' + rows.filter(function (m) { return m.status !== 'new'; }).slice(0, 100).map(function (m) { return '<li>' + esc(ctx.date(m.created_at)) + ' · ' + esc(m.name) + ': ' + esc(String(m.message).slice(0, 120)) + '</li>'; }).join('') + '</ul></details>' : '');
        bindNav();
        panel.querySelectorAll('[data-ct]').forEach(function (c) { c.querySelector('[data-done]').addEventListener('click', function () { db().rpc('admin_set_contact', { p_id: c.getAttribute('data-ct'), p_status: 'done', p_note: null }).then(ctx.must).then(done, fail(c.querySelector('[data-msg]'))); }); });
      });
    }
    if (sub === 'posts') {
      return ctx.load('inboxPosts', function () { return db().rpc('admin_open_proofs').then(ctx.must); }).then(function (rows) {
        panel.innerHTML = nav + '<p class="small-print">Posts players shared on X to earn coins. Open each one: if it is missing or fake, tell me and I will show you how to remove the coins.</p>' +
          (rows.length ? '<ul class="ops-detail">' + rows.map(function (p) {
            return '<li data-proof="' + esc(p.user_id + ':' + p.quest) + '"><b>' + esc(p.display_name || 'Player') + '</b> <span class="small-print">' + esc(p.quest) + ' · ' + esc(age(p.created_at)) + ' ago</span><br /><a href="' + esc(p.proof) + '" target="_blank" rel="noopener">' + esc(p.proof) + '</a> <button type="button" class="btn btn--small btn--yellow" data-seen>Looks fine</button></li>';
          }).join('') + '</ul>' : '<p class="text">No posts waiting.</p>');
        bindNav();
        panel.querySelectorAll('[data-proof]').forEach(function (li) { li.querySelector('[data-seen]').addEventListener('click', function () { db().rpc('admin_mark_reviewed', { p_kind: 'post', p_key: li.getAttribute('data-proof') }).then(ctx.must).then(done, function (err) { window.alert(err.message); }); }); });
      });
    }
    return ctx.load('inboxReferrals', function () { return db().rpc('admin_flagged_referrals').then(ctx.must); }).then(function (rows) {
      panel.innerHTML = nav + '<p class="small-print">Invites over the monthly cap, or 3 or more by one person on the same day. Usually fine (a group of friends); look for made-up accounts.</p>' +
        (rows.length ? '<ul class="ops-detail">' + rows.map(function (x) {
          return '<li data-ref="' + esc(x.referee) + '"><b>' + esc(x.referrer_name || '?') + '</b> invited <b>' + esc(x.referee_name || '?') + '</b> <span class="small-print">' + esc(x.reason) + ' · ' + esc(ctx.date(x.created_at)) + ' · ' + esc(x.status) + '</span> <button type="button" class="btn btn--small btn--yellow" data-seen>Mark reviewed</button></li>';
        }).join('') + '</ul>' : '<p class="text">No flagged referrals.</p>');
      bindNav();
      panel.querySelectorAll('[data-ref]').forEach(function (li) { li.querySelector('[data-seen]').addEventListener('click', function () { db().rpc('admin_mark_reviewed', { p_kind: 'referral', p_key: li.getAttribute('data-ref') }).then(ctx.must).then(done, function (err) { window.alert(err.message); }); }); });
    });
  }

  // ---------- Audit log ----------
  var KIND = { biz_requests: 'Project request', sponsor_bookings: 'Sponsor booking', test_runs: 'Tester report', product_tests: 'Test', project_requests: 'Course or project request',
    orders: 'Payment', review_approvals: 'Review approval', release_overrides: 'Release', quest_proofs: 'X post', referrals: 'Referral', refund_requests: 'Refund request', contact_messages: 'Contact message', ops_todos: 'To-do' };
  function audit(panel, ctx) {
    var esc = ctx.esc;
    return ctx.load('audit', function () { return ctx.db().rpc('admin_audit_list', { p_limit: 1000 }).then(ctx.must); }).then(function (rows) {
      var html = rows.map(function (a) {
        var label = (a.detail && a.detail.label) || '';
        return '<tr><td>' + esc(new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })) + '</td><td>' + esc(a.admin_name) + '</td><td>' + esc(a.action) + '</td><td>' + esc(KIND[a.target_kind] || a.target_kind) + (label ? ': ' + esc(label) : '') + '</td></tr>';
      });
      panel.innerHTML = '<p class="small-print">Every approve, reject, refund, mark paid and mark reviewed, recorded by the database (India time). It cannot be edited.</p>' +
        ctx.grid('audit-log', ['When', 'Who', 'Action', 'What'], rows.map(function (a) { return [a.at, a.admin_name, a.action, (KIND[a.target_kind] || a.target_kind) + ' ' + (a.target_id || ''), JSON.stringify((a.detail || {}).changes || {})]; }), html);
      ctx.bindCsv(panel);
    });
  }

  // ---------- Revenue (by product group and month) ----------
  function revenue(panel, ctx) {
    var esc = ctx.esc;
    return Promise.all([
      ctx.load('orders', function () { return ctx.db().from('orders').select('*').order('created_at', { ascending: false }).limit(5000).then(ctx.must); }),
      ctx.load('catalog', function () { return window.Web3Pay ? window.Web3Pay.products() : window.Web3Common.loadJson('../data/products.json').then(function (j) { return j.products || []; }); }),
    ]).then(function (r) {
      var catalog = {};
      (r[1] || []).forEach(function (p) { catalog[p.id] = p; });
      var paid = r[0].filter(function (o) { return (o.status === 'paid' || o.status === 'refunded') && o.currency !== 'COINS' && o.paid_at; });
      var months = [], groups = [], cell = {};
      paid.forEach(function (o) {
        var m = String(o.paid_at).slice(0, 7), g = group(o.product_id, catalog), k = m + '|' + g + '|' + o.currency;
        if (months.indexOf(m) < 0) months.push(m);
        if (groups.indexOf(g) < 0) groups.push(g);
        var c = cell[k] = cell[k] || { paid: 0, refunded: 0, n: 0 };
        if (o.status === 'paid') { c.paid += o.amount; c.n += 1; } else c.refunded += o.amount;
      });
      months.sort().reverse();
      var rows = [];
      months.forEach(function (m) { groups.forEach(function (g) { ['USD', 'INR'].forEach(function (cur) { var c = cell[m + '|' + g + '|' + cur]; if (c) rows.push([m, g, cur, c.n, (c.paid / 100).toFixed(2), (c.refunded / 100).toFixed(2)]); }); }); });
      var total = function (cur, test) { return paid.filter(function (o) { return o.currency === cur && o.status === 'paid' && test(o); }).reduce(function (s, o) { return s + o.amount; }, 0); };
      var thisMonth = new Date().toISOString().slice(0, 7);
      var biz = function (o) { return /^(deposit-|ad-|pro-)/.test(o.product_id); };
      panel.innerHTML = ctx.tiles([['This month (USD)', money(total('USD', function (o) { return String(o.paid_at).slice(0, 7) === thisMonth; }), 'USD')], ['This month (INR)', money(total('INR', function (o) { return String(o.paid_at).slice(0, 7) === thisMonth; }), 'INR')],
        ['For Projects, all time', money(total('USD', biz), 'USD')], ['Everything, all time (USD)', money(total('USD', function () { return true; }), 'USD')]]) +
        '<p class="small-print">Paid orders by month and product (coins not included). Refunded amounts are shown separately.</p>' +
        ctx.grid('revenue', ['Month', 'Product', 'Currency', 'Sales', 'Paid', 'Refunded'], rows);
      ctx.bindCsv(panel);
    });
  }

  window.Web3AdminOps = { home: home, inbox: inbox, audit: audit, revenue: revenue, sortQueues: sortQueues, level: level };
})();
