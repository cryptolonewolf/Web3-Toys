// /advertise/stats/?b=BOOKING&k=TOKEN: a sponsor's private stats page.
// Views and clicks from our own counter (sponsor_stats), by day and slot.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var SB = (window.WEB3TOYS_CONFIG || {}).supabase || {};
  var q = new URLSearchParams(location.search);
  var id = q.get('b') || '', token = q.get('k') || '';
  var none = function (t) { app.innerHTML = '<section class="card stack stack--tight"><h1 class="title-md">Sponsor stats</h1><p class="text">' + esc(t) + '</p></section>'; };
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{20,64}$/i.test(token) || !SB.url) return none('This stats link is not complete. Use the link from your booking.');

  fetch(SB.url.replace(/\/$/, '') + '/rest/v1/rpc/sponsor_stats', {
    method: 'POST',
    headers: { apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: id, p_token: token }),
  }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
    if (!rows.length) return none('We could not find these stats. Check the link, or email hi@web3.toys.');
    var b = rows[0];
    var days = {};
    var tot = { views: 0, clicks: 0, start: 0, result: 0 };
    rows.forEach(function (r) {
      if (!r.day) return;
      var d = days[r.day] = days[r.day] || { views: 0, clicks: 0 };
      d.views += Number(r.views); d.clicks += Number(r.clicks);
      tot.views += Number(r.views); tot.clicks += Number(r.clicks);
      tot[r.slot] += Number(r.views);
    });
    var ctr = tot.views ? (Math.round(tot.clicks / tot.views * 1000) / 10) + '%' : '-';
    var where = b.kind === 'toy' ? b.toy_id : b.kind === 'site' ? 'site-wide' : 'newsletter';
    var month = new Date(b.month + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    app.innerHTML =
      '<section class="stack stack--tight"><p class="label">Private sponsor stats</p><h1 class="title-lg">' + esc(b.sponsor) + '</h1>' +
      '<p class="small-print">' + esc(where) + ' · ' + esc(month) + ' · status: ' + esc(b.status) + '</p></section>' +
      '<ul class="ad-audience">' +
      '<li class="card"><span aria-hidden="true">👀</span><b>' + tot.views.toLocaleString('en-US') + '</b><span class="small-print">views (card at least half on screen)</span></li>' +
      '<li class="card"><span aria-hidden="true">👆</span><b>' + tot.clicks.toLocaleString('en-US') + '</b><span class="small-print">clicks</span></li>' +
      '<li class="card"><span aria-hidden="true">📈</span><b>' + ctr + '</b><span class="small-print">click rate</span></li>' +
      '<li class="card"><span aria-hidden="true">🧭</span><b>' + tot.start.toLocaleString('en-US') + ' / ' + tot.result.toLocaleString('en-US') + '</b><span class="small-print">views on start / result screens</span></li></ul>' +
      (Object.keys(days).length ? '<div class="adm-scroll"><table class="tk-table"><thead><tr><th>Day</th><th>Views</th><th>Clicks</th></tr></thead><tbody>' +
        Object.keys(days).sort().reverse().map(function (d) { return '<tr><td>' + esc(d) + '</td><td>' + days[d].views + '</td><td>' + days[d].clicks + '</td></tr>'; }).join('') + '</tbody></table></div>'
        : '<p class="text">No views yet. Numbers appear from the first day your card is live.</p>') +
      '<p class="small-print">Counted by web3.toys itself: no cookies, no outside trackers, no personal data. Keep this link private.</p>';
  }).catch(function (err) { app.innerHTML = C.loadError(err); });
})();
