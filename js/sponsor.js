// Sponsor cards on toys (Sponsor a Toy, supabase/015_sponsors.sql).
// Loaded on every page by js/site.js; only acts on toy pages.
//   - Start screen: a small card under the toy, gone as soon as play starts.
//   - Result screens: a small card above the "Take it further" box.
//   - Never inside gameplay, never blocking play, never on certificates.
// Shows this month's approved sponsor for the toy, else the site-wide
// sponsor, else (once For Projects is live) a "Your project here" card.
// Views and clicks are counted by our own counter (sponsor_hit); no outside
// trackers, no cookies.

(function () {
  var site = window.WEB3TOYS || {};
  var cfg = (window.WEB3TOYS_CONFIG || {}).supabase || {};
  var app = document.getElementById('app');
  var toy = document.body.getAttribute('data-toy');
  if (!app || !toy || document.body.hasAttribute('data-person') || !cfg.url || !cfg.anonKey) return;

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var sponsor = null, price = null, playing = false, ready = false;
  var seen = {};

  function rpc(fn, body, keep) {
    return fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      keepalive: Boolean(keep),
      headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  }

  function logo(path) {
    return cfg.url.replace(/\/$/, '') + '/storage/v1/object/public/sponsor-logos/' + path.split('/').map(encodeURIComponent).join('/');
  }

  function card(slot) {
    if (sponsor) {
      return '<a class="sponsor-card" data-sponsor-slot="' + slot + '" href="' + esc(sponsor.link) + '" target="_blank" rel="sponsored noopener">' +
        '<span class="sponsor-label">Sponsored</span><img class="sponsor-logo" src="' + esc(logo(sponsor.logo_path)) + '" alt="" width="44" height="44" loading="lazy" />' +
        '<span class="sponsor-text"><b>' + esc(sponsor.sponsor) + '</b><span>' + esc(sponsor.line) + '</span></span><span class="sponsor-go" aria-hidden="true">→</span></a>';
    }
    if (!(site.businessOn && site.businessOn())) return '';
    return '<a class="sponsor-card sponsor-card--house" data-sponsor-slot="' + slot + '" href="' + (site.root || '/') + 'advertise/?toy=' + encodeURIComponent(toy) + '">' +
      '<span class="sponsor-label">Sponsor slot</span><span class="sponsor-logo sponsor-logo--house" aria-hidden="true">📣</span>' +
      '<span class="sponsor-text"><b>Your project here</b><span>Reach players learning web3' + (price ? ', from $' + price + ' a month' : '') + '.</span></span><span class="sponsor-go" aria-hidden="true">→</span></a>';
  }

  function track(el) {
    if (!sponsor || el.getAttribute('data-tracked')) return;
    el.setAttribute('data-tracked', '1');
    var slot = el.getAttribute('data-sponsor-slot');
    el.addEventListener('click', function () { rpc('sponsor_hit', { p_booking: sponsor.id, p_what: 'click', p_slot: slot }, true).catch(function () {}); });
    var count = function () {
      if (seen[slot]) return;
      seen[slot] = true;
      rpc('sponsor_hit', { p_booking: sponsor.id, p_what: 'view', p_slot: slot }).catch(function () {});
    };
    if (!('IntersectionObserver' in window)) { count(); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && e.intersectionRatio >= 0.5) { count(); io.disconnect(); } }); }, { threshold: 0.5 });
    io.observe(el);
  }

  function place() {
    if (!ready) return;
    // Start screen: under the toy, until play starts.
    var start = document.querySelector('.sponsor-start');
    var resultBoxes = Array.prototype.filter.call(app.querySelectorAll('[data-offers]'), function (b) { return b.getAttribute('data-offers') !== 'certificate'; });
    var onCertificate = app.querySelector('[data-offers="certificate"]');
    if (!playing && !resultBoxes.length && !onCertificate) {
      var html = card('start');
      if (html && !start) {
        start = document.createElement('aside');
        start.className = 'sponsor-start';
        start.setAttribute('aria-label', 'Sponsored');
        app.insertAdjacentElement('afterend', start);
        start.innerHTML = html;
        track(start.firstChild);
      }
    } else if (start) start.remove();
    // Result screens: above the offers box (never on certificates).
    resultBoxes.forEach(function (box) {
      var prev = box.previousElementSibling;
      if (prev && prev.classList.contains('sponsor-result')) return;
      var html = card('result');
      if (!html) return;
      var el = document.createElement('div');
      el.className = 'sponsor-result';
      el.innerHTML = html;
      box.parentNode.insertBefore(el, box);
      track(el.firstChild);
    });
  }

  // Play starts at the first tap inside the toy (not on the sponsor card).
  app.addEventListener('click', function (e) {
    if (playing || app.querySelector('[data-offers]')) return;
    if (e.target.closest('button, a, input, label')) { playing = true; place(); }
  }, true);
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    setTimeout(function () {
      queued = false;
      if (app.querySelector('[data-offers]')) playing = false;
      place();
    }, 120);
  }).observe(app, { childList: true, subtree: true });

  Promise.all([
    rpc('active_sponsors').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
    fetch((site.root || '/') + 'data/business/ad_slots.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
  ]).then(function (r) {
    var rows = r[0] || [];
    sponsor = rows.filter(function (x) { return x.kind === 'toy' && x.toy_id === toy; })[0] || rows.filter(function (x) { return x.kind === 'site'; })[0] || null;
    price = r[1] && r[1].toyMonth ? r[1].toyMonth[toy] || r[1].newToy : null;
    ready = true;
    place();
  });

  window.Web3Sponsor = { current: function () { return sponsor; } };
})();
