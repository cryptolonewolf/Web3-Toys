// Payments with Razorpay. Loaded with js/auth.js. Web3Pay.buy(productId,
// item) shows a small pay box, starts the order on the server (which sets
// the price from data/products.json), opens Razorpay and, after paying,
// asks the server to confirm it. Visitors in India pay in rupees (UPI or
// card); everyone else pays in US dollars (card). Switched on with
// payments.enabled in config.js.

(function () {
  var A = window.Web3Auth;
  var site = window.WEB3TOYS;
  var CFG = (window.WEB3TOYS_CONFIG || {}).payments || {};
  if (!A || !site) return;
  var db = A.client;
  var CUR_KEY = 'web3toys.currency.v1';
  var list = null;
  var bought = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function products() {
    if (!list) list = fetch(site.root + 'data/products.json').then(function (r) { return r.json(); }).then(function (d) { return d.products; });
    return list;
  }

  function guessCurrency() {
    try {
      var saved = localStorage.getItem(CUR_KEY);
      if (saved === 'INR' || saved === 'USD') return saved;
    } catch (e) { /* private mode */ }
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* old browser */ }
    return /^Asia\/(Kolkata|Calcutta)$/.test(tz) || /-IN$/i.test(navigator.language || '') ? 'INR' : 'USD';
  }

  function setCurrency(c) {
    try { localStorage.setItem(CUR_KEY, c); } catch (e) { /* private mode */ }
  }

  function price(p, cur) {
    return cur === 'INR' ? '₹' + Number(p.inr).toLocaleString('en-IN') : '$' + (Number(p.usd) % 1 ? Number(p.usd).toFixed(2) : Number(p.usd));
  }

  // A friendly message from a server function error.
  function fnError(r) {
    if (!r.error) return Promise.resolve(r.data);
    var ctx = r.error.context;
    var read = ctx && ctx.json ? ctx.json().catch(function () { return {}; }) : Promise.resolve({});
    return read.then(function (b) { throw new Error((b && b.error) || 'Something went wrong. Please try again.'); });
  }

  // Every request carries the player's login explicitly.
  function call(name, body) {
    return db.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (!session) throw new Error('Your login has expired. Log out, log in again, then retry.');
      return db.functions.invoke(name, { body: body, headers: { Authorization: 'Bearer ' + session.access_token } });
    }).then(fnError);
  }

  function loadCheckout() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load the payment window. Check your connection.')); };
      document.head.appendChild(s);
    });
  }

  // ---------- The pay box ----------

  function coinsButton(p) {
    var have = site.coins.wallet().balance;
    var enough = have >= p.coins;
    return '<button type="button" class="btn btn--block btn--yellow" data-coins' + (enough ? '' : ' disabled') + '>' + site.icon('coin') + ' Unlock with ' + p.coins.toLocaleString('en-US') + ' coins</button>' +
      '<p class="small-print">You have ' + have.toLocaleString('en-US') + ' coins.' + (enough ? '' : ' <a href="' + site.root + 'progress/#coins">Earn more coins</a>') + '</p>';
  }

  function box(p, item, onPaid) {
    var cur = guessCurrency();
    var m = document.createElement('div');
    m.className = 'modal pay-modal';
    document.body.appendChild(m);
    var close = function () { m.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape' && !m.classList.contains('is-busy')) close(); };
    document.addEventListener('keydown', onKey);
    m.addEventListener('click', function (e) { if (e.target === m && !m.classList.contains('is-busy')) close(); });

    function draw(msg) {
      m.innerHTML = '<div class="card stack stack--tight" role="dialog" aria-modal="true" aria-labelledby="pay-title">' +
        '<div class="cap-row"><h2 class="title-md" id="pay-title">' + esc(p.title) + '</h2><button type="button" class="cap-x" data-close aria-label="Close">×</button></div>' +
        (p.line ? '<p class="text">' + esc(p.line) + '</p>' : '') +
        '<p class="pay-price">' + price(p, CFG.enabled ? cur : 'USD') + '</p>' +
        (CFG.enabled ? '<p class="small-print">' + (cur === 'INR' ? 'Pay with UPI or card, in rupees.' : 'Pay by card, in US dollars.') +
        ' <button type="button" class="text-button" data-cur>' + (cur === 'INR' ? 'Pay in US dollars instead' : 'In India? Pay in rupees') + '</button></p>' : '') +
        (CFG.enabled ? '<button type="button" class="btn btn--ink btn--block" data-pay>Pay ' + price(p, cur) + '</button>' : '') +
        (p.coins ? coinsButton(p) : '') +
        (CFG.crypto ? '<button type="button" class="btn btn--block" data-crypto>Pay with crypto · ' + price(p, 'USD') + '</button>' +
          '<p class="small-print">Crypto (like USDT or USDC) through Paymento, paid in US dollars\' worth. Send only from a wallet you control, on the network shown.</p>' : '') +
        '<p class="small-print" data-pay-msg aria-live="polite">' + esc(msg || '') + '</p>' +
        '<p class="small-print">' + (CFG.enabled && CFG.crypto ? 'Card and UPI payments by Razorpay, crypto by Paymento.' : CFG.crypto ? 'Crypto payments by Paymento.' : 'Secure payment by Razorpay.') + ' By paying you agree to the <a href="' + site.root + 'terms/" target="_blank" rel="noopener">Terms</a> and <a href="' + site.root + 'refunds/" target="_blank" rel="noopener">Refunds</a> rules. Educational products, not financial advice.</p></div>';
      m.querySelector('[data-close]').addEventListener('click', close);
      var sw = m.querySelector('[data-cur]');
      if (sw) sw.addEventListener('click', function () { cur = cur === 'INR' ? 'USD' : 'INR'; setCurrency(cur); draw(); });
      var pb = m.querySelector('[data-pay]');
      if (pb) pb.addEventListener('click', pay);
      var c = m.querySelector('[data-crypto]');
      if (c) c.addEventListener('click', payCrypto);
      var cb = m.querySelector('[data-coins]');
      if (cb) cb.addEventListener('click', payCoins);
      (m.querySelector('[data-pay]') || m.querySelector('[data-coins]') || m.querySelector('[data-crypto]')).focus();
    }

    function busy(on, msg) {
      m.classList.toggle('is-busy', on);
      var b = m.querySelector('[data-pay]');
      if (b) b.disabled = on;
      var t = m.querySelector('[data-pay-msg]');
      if (t) t.textContent = msg || '';
    }

    function pay() {
      busy(true, 'Starting the payment…');
      var started;
      Promise.all([loadCheckout(), call('create-order', { product: p.id, item: item || null, currency: cur })]).then(function (r) {
        started = r[1];
        site.sound.play('tick');
        var methods = cur === 'INR'
          ? { upi: true, card: true, netbanking: false, wallet: false, emi: false, paylater: false }
          : { card: true, upi: false, netbanking: false, wallet: false, emi: false, paylater: false };
        var rz = new window.Razorpay({
          key: started.keyId,
          order_id: started.orderId,
          amount: started.amount,
          currency: started.currency,
          name: 'web3.toys',
          description: started.title,
          image: new URL(site.iconSrc(true), location.href).href,
          prefill: { email: started.email || '' },
          method: methods,
          theme: { color: '#FFD93D' },
          handler: function (resp) {
            busy(true, 'Confirming your payment…');
            call('verify-payment', resp).then(function (v) {
              bought = null;
              done(v.order);
            }, function (err) { busy(false, err.message + ' If you were charged, it will appear in Purchases within a few minutes.'); });
          },
          modal: { ondismiss: function () { busy(false, 'Payment cancelled. You were not charged.'); } },
        });
        rz.on('payment.failed', function (f) { busy(false, 'The payment did not go through: ' + ((f.error && f.error.description) || 'please try again') + '.'); });
        rz.open();
      }).catch(function (err) { busy(false, err.message); });
    }

    // Coins: the database checks the coin price and the balance.
    function payCoins() {
      if (!window.confirm('Unlock ' + p.title + ' for ' + p.coins.toLocaleString('en-US') + ' coins?')) return;
      busy(true, 'Unlocking…');
      var cb = m.querySelector('[data-coins]');
      if (cb) cb.disabled = true;
      window.Web3Sync.redeem(p.id, item).then(function (id) {
        bought = null;
        done({ id: id, title: p.title + (item ? ' (' + item + ')' : '') }, true);
      }, function (err) { busy(false, err.message); if (cb) cb.disabled = false; });
    }

    // Crypto: Paymento's own page takes the payment, then sends the buyer
    // back to My Progress, Purchases, where the order is checked.
    function payCrypto() {
      busy(true, 'Opening the crypto checkout…');
      var c = m.querySelector('[data-crypto]');
      if (c) c.disabled = true;
      call('crypto-order', { action: 'create', product: p.id, item: item || null }).then(function (r) {
        try { localStorage.setItem('web3toys.cryptoOrder.v1', r.orderId); } catch (e) { /* private mode */ }
        location.href = r.url;
      }, function (err) { busy(false, err.message); if (c) c.disabled = false; });
    }

    function done(order, withCoins) {
      m.classList.remove('is-busy');
      site.fx.confetti();
      site.sound.play('cash');
      m.innerHTML = '<div class="card stack stack--tight" role="dialog" aria-modal="true" aria-labelledby="pay-title">' +
        '<h2 class="title-md" id="pay-title">Paid ✓</h2><p class="text">' + (p.type === 'project' ? 'Payment received for ' + esc(p.title) + '. We will review your project and contact you on Telegram or email. A receipt is on its way to your email.'
          : esc(item ? order.title || p.title : p.title) + ' is yours.' + (withCoins ? ' Paid with coins.' : ' A receipt is on its way to your email.')) + '</p>' +
        '<div class="btn-row">' + (p.file ? '<button type="button" class="btn btn--yellow" data-dl>Download</button>' : '') +
        (p.type === 'call' && callUrl() ? '<a class="btn btn--yellow" href="' + esc(callUrl(order.id)) + '" target="_blank" rel="noopener">Pick your time</a>' : '') +
        (p.type === 'project' ? '<a class="btn btn--yellow" href="' + site.root + 'work-with-us/">Follow your request</a>' : '') +
        '<a class="btn" href="' + site.root + 'progress/#purchases">My purchases</a><button type="button" class="btn" data-close>Close</button></div>' +
        '<p class="small-print" data-pay-msg aria-live="polite"></p></div>';
      m.querySelector('[data-close]').addEventListener('click', close);
      var dl = m.querySelector('[data-dl]');
      if (dl) dl.addEventListener('click', function () {
        download(order.id).catch(function (err) { m.querySelector('[data-pay-msg]').textContent = err.message; });
      });
      document.dispatchEvent(new CustomEvent('web3toys:purchased', { detail: order }));
      site.log('purchase', (withCoins ? 'coins:' : '') + p.id + (item ? ':' + item : ''));
      if (onPaid) onPaid(order);
    }

    draw();
  }

  // The booking link for a paid call, with the buyer's email filled in.
  function callUrl(orderId) {
    var url = ((window.WEB3TOYS_CONFIG || {}).call || {}).calUrl || '';
    if (!url) return '';
    var u = A.user();
    var q = [];
    if (u && u.email) q.push('email=' + encodeURIComponent(u.email));
    if (orderId) q.push('notes=' + encodeURIComponent('Paid on web3.toys, order ' + orderId));
    return url + (q.length ? (url.indexOf('?') < 0 ? '?' : '&') + q.join('&') : '');
  }

  // ---------- What pages call ----------

  function buy(productId, item, onPaid) {
    return products().then(function (ps) {
      var p = ps.filter(function (x) { return x.id === productId; })[0];
      if (!p) throw new Error('Unknown product.');
      if (!CFG.enabled && !CFG.crypto && !p.coins) throw new Error('Payments open soon.');
      if (!A.user()) {
        A.open('Log in to buy, so your purchase is saved to your account and you can download it again any time.');
        throw new Error('login');
      }
      site.log('buy_click', p.id + (item ? ':' + item : ''));
      box(p, item, onPaid);
    });
  }

  function download(orderId) {
    // Open the tab first (phones block pop-ups opened after a wait).
    var win = window.open('', '_blank');
    return call('download', { orderId: orderId }).then(function (r) {
      if (win) win.location.href = r.url;
      else location.href = r.url;
    }, function (err) { if (win) win.close(); throw err; });
  }

  function purchases() {
    if (!A.user()) return Promise.resolve([]);
    if (!bought) {
      bought = db.from('orders').select('id,product_id,item,title,currency,amount,status,paid_at').in('status', ['paid', 'refunded']).order('paid_at', { ascending: false })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
      bought.catch(function () { bought = null; });
    }
    return bought;
  }

  function owns(productId, item) {
    return purchases().then(function (rows) {
      return rows.some(function (o) { return o.status === 'paid' && o.product_id === productId && (o.item || null) === (item || null); });
    });
  }

  // Back from Paymento: ask the server whether it is paid yet.
  function checkCrypto(orderId) {
    return call('crypto-order', { action: 'check', orderId: orderId }).then(function (r) {
      if (r.status === 'paid') {
        bought = null;
        try { localStorage.removeItem('web3toys.cryptoOrder.v1'); } catch (e) { /* private mode */ }
        document.dispatchEvent(new CustomEvent('web3toys:purchased', { detail: { id: orderId } }));
      }
      return r;
    });
  }

  A.onChange(function () { bought = null; });

  window.Web3Pay = { callUrl: callUrl, money: !!(CFG.enabled || CFG.crypto), enabled: true, crypto: !!CFG.crypto, checkCrypto: checkCrypto, products: products, price: price, currency: guessCurrency, buy: buy, download: download, purchases: purchases, owns: owns };
  document.dispatchEvent(new CustomEvent('web3pay:ready'));
})();
