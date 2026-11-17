// Invite and earn (supabase/025_affiliates.sql): the card with your link,
// your share, what you earned and your payout wallet. Shown in /my-page/
// for page owners and as a short summary on My Progress.
//   Web3Affiliate.render(box, { root, compact })
// Words: data/business/affiliate.json.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var NETWORKS = [['ethereum', 'Ethereum'], ['base', 'Base'], ['arbitrum', 'Arbitrum'], ['optimism', 'Optimism'], ['polygon', 'Polygon'], ['bnb', 'BNB Chain'], ['solana', 'Solana'], ['tron', 'Tron']];
  var PRODUCT_NAMES = { 'report-full': 'Full report', 'cert-hd': 'HD certificate', 'cert-premium': 'Premium certificate', 'export-branded': 'Branded export', 'launch-report': 'Launch report', 'pro-year': 'Pro page, one year' };

  function usd(n) { var v = Number(n) || 0; return '$' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function pct(r) { return Math.round(Number(r) * 100) + '%'; }
  function what(id) {
    if (PRODUCT_NAMES[id]) return PRODUCT_NAMES[id];
    if (/^deposit-toy-/.test(id)) return 'Toy deposit';
    if (/^deposit-test-/.test(id)) return 'Test deposit';
    if (/^course-/.test(id)) return 'Quest';
    if (/^ad-/.test(id)) return 'Ad slot';
    return id;
  }
  function must(r) { if (r.error) throw r.error; return r.data; }

  function render(box, o) {
    o = o || {};
    var R = o.root || '/';
    var A = window.Web3Auth;
    if (!box || !A || !A.user()) return Promise.resolve();
    return Promise.all([C.loadJson(R + 'data/business/affiliate.json'), A.client.rpc('my_affiliate').then(must)]).then(function (r) {
      var W = r[0], m = r[1];
      if (!m) { box.innerHTML = ''; return; }
      if (!m.eligible) {
        box.innerHTML = o.compact ? '' : '<h2 class="title-md">💸 ' + esc(W.title) + '</h2><p class="text">' + esc(W.noPage) + '</p><a class="btn btn--small btn--ink" href="' + R + 'my-page/">Claim My Page</a>';
        return;
      }
      var link = 'https://web3.toys/?ref=' + m.handle;
      var tier = 'You get <b>' + pct(m.rate) + '</b>' + (m.next_at != null ? ' · ' + pct(m.next_rate) + ' from ' + m.next_at + ' paying buyers (you have ' + m.buyers + ')' : ' · the top share') + '.';
      var nums = '<ul class="aff-nums"><li><span class="small-print">Waiting</span><b>' + usd(m.pending) + '</b></li><li><span class="small-print">Ready</span><b>' + usd(m.ready) + '</b></li>' +
        (Number(m.requested) ? '<li><span class="small-print">On its way</span><b>' + usd(m.requested) + '</b></li>' : '') + '<li><span class="small-print">Paid</span><b>' + usd(m.paid) + '</b></li></ul>';
      if (o.compact) {
        box.innerHTML = '<div class="cap-row"><h2 class="title-sm">💸 ' + esc(W.title) + '</h2><a class="text-button" href="' + R + 'my-page/#earn">Open →</a></div>' + nums + '<p class="small-print">' + tier + '</p>';
        return;
      }
      var min = Number((m.settings || {}).min_payout_usd || 20);
      box.innerHTML = '<h2 class="title-md">💸 ' + esc(W.title) + '</h2><p class="text">' + esc(W.line) + '</p>' +
        '<div class="aff-link"><code>' + esc(link) + '</code><button type="button" class="btn btn--small btn--ink" data-copy>Copy</button>' +
        '<a class="btn btn--small" target="_blank" rel="noopener" href="https://x.com/intent/post?text=' + encodeURIComponent('Learning web3 by playing little 5 minute toys on web3.toys ' + link) + '">Share on X</a></div>' +
        '<p class="small-print">Your web3.toys page counts as your link too.' + (m.code ? ' Your old invite code still works: ?ref=' + esc(m.code) + '.' : '') + '</p>' +
        '<p class="small-print">' + tier + '</p>' + nums +
        (Number(m.ready) >= min && m.wallet && !Number(m.requested) ? '<button type="button" class="btn btn--ink" data-payout>Send me ' + usd(m.ready) + '</button>' : '<p class="small-print">Payouts from ' + usd(min) + ' ready.</p>') +
        '<p class="small-print" data-amsg aria-live="polite"></p>' +
        ((m.recent || []).length ? '<h3 class="title-sm">Your earnings</h3><ul class="aff-list">' + m.recent.map(function (e) {
          return '<li><span>' + esc(what(e.product_id)) + ' · ' + usd(e.paid_usd) + ' × ' + pct(e.rate) + '</span><b>' + usd(e.amount_usd) + '</b><span class="small-print">' + esc(new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + ' · ' + esc(e.state) + '</span></li>';
        }).join('') + '</ul>' : '<p class="small-print">No earnings yet. Share your link to start.</p>') +
        ((m.payouts || []).length ? '<h3 class="title-sm">Payouts</h3><ul class="aff-list">' + m.payouts.map(function (p) {
          return '<li><span>' + esc(p.token) + ' on ' + esc(p.network) + '</span><b>' + usd(p.amount_usd) + '</b><span class="small-print">' + esc(p.status === 'requested' ? 'on its way' : p.status) + (p.tx ? ' · ' + esc(p.tx) : '') + '</span></li>';
        }).join('') + '</ul>' : '') +
        '<details class="aff-wallet"' + (m.wallet ? '' : ' open') + '><summary><b>Payout wallet</b>' + (m.wallet ? ' · ' + esc(m.wallet.token) + ' on ' + esc(m.wallet.network) : '') + '</summary>' +
        '<p class="small-print">' + esc(W.walletLine) + '</p><form class="stack stack--tight" data-wallet novalidate>' +
        '<label class="label" for="aff-net">Network</label><select class="field" id="aff-net">' + NETWORKS.map(function (n) { return '<option value="' + n[0] + '"' + (m.wallet && m.wallet.network === n[0] ? ' selected' : '') + '>' + n[1] + '</option>'; }).join('') + '</select>' +
        '<label class="label" for="aff-token">Coin</label><select class="field" id="aff-token"><option' + (m.wallet && m.wallet.token === 'USDT' ? '' : ' selected') + '>USDC</option><option' + (m.wallet && m.wallet.token === 'USDT' ? ' selected' : '') + '>USDT</option></select>' +
        '<label class="label" for="aff-wallet">Wallet address</label><input class="field" id="aff-wallet" maxlength="64" autocomplete="off" value="' + esc(m.wallet ? m.wallet.wallet : '') + '" />' +
        '<button type="submit" class="btn btn--small">Save wallet</button><p class="small-print" data-wmsg aria-live="polite"></p></form></details>' +
        '<details><summary><b>How it works</b></summary><ul class="biz-feats">' + W.rules.map(function (x) { return '<li>' + window.WEB3TOYS.icon('check') + '<span>' + esc(x) + '</span></li>'; }).join('') + '</ul>' +
        '<p class="small-print">Shares: ' + W.tiers.map(function (t) { return pct(t.rate) + (t.minBuyers ? ' from ' + t.minBuyers + ' buyers' : ' to start'); }).join(' · ') + '. Full rules: <a href="' + R + 'terms/#invite-and-earn">Terms</a>.</p></details>';
      box.querySelector('[data-copy]').addEventListener('click', function (e) {
        var done = function () { e.target.textContent = 'Copied'; };
        if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, function () {}); else done();
      });
      var pb = box.querySelector('[data-payout]');
      if (pb) pb.addEventListener('click', function () {
        pb.disabled = true;
        A.client.rpc('request_affiliate_payout').then(must).then(function () { render(box, o); }, function (err) { pb.disabled = false; box.querySelector('[data-amsg]').textContent = err.message; });
      });
      box.querySelector('[data-wallet]').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target, msg = f.querySelector('[data-wmsg]');
        A.client.rpc('set_affiliate_wallet', { p_network: f.querySelector('#aff-net').value, p_token: f.querySelector('#aff-token').value, p_wallet: f.querySelector('#aff-wallet').value.trim() }).then(must)
          .then(function () { render(box, o); }, function (err) { msg.textContent = err.message; });
      });
    }).catch(function (err) {
      box.innerHTML = o.compact ? '' : '<h2 class="title-md">💸 Invite and earn</h2><p class="small-print">' + esc(/function|does not exist/.test(err.message || '') ? 'Opens soon.' : err.message) + '</p>';
    });
  }

  window.Web3Affiliate = { render: render };
})();
