// Shared helpers for the web3.toys pages: loading JSON content, the rank
// badge and the analytics placeholder.

(function () {
  var CONFIG = window.WEB3TOYS_CONFIG || {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Loads a JSON file from the site. Browsers block this when a page is
  // opened straight from the computer, so say how to preview instead.
  function loadJson(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Could not load ' + path + ' (' + res.status + ')');
      return res.json();
    });
  }

  function loadError(err) {
    var local = location.protocol === 'file:';
    return '<section class="card card--warning stack stack--tight" role="alert">' +
      '<h1 class="title-md">This page could not load its content.</h1>' +
      '<p class="text text--ink">' + (local
        ? 'Pages opened straight from your computer cannot read their content files. Open the site through its web address or a Vercel preview link instead.'
        : 'Please refresh the page. If it keeps happening, a content file may have a typo.') + '</p>' +
      '<p class="small-print">' + esc(err && err.message) + '</p></section>';
  }

  // The rank badge: a numbered circle plus the rank name.
  function rankBadge(rank, level, big) {
    return '<span class="rank-badge' + (big ? ' rank-badge--big' : '') + '" title="Rank ' + level + '">' +
      '<span class="rank-level">' + level + '</span><span class="rank-name">' + esc(rank.name) + '</span></span>';
  }

  // ---------- Analytics placeholder ----------
  // Loads the analytics script from config.js only when one is set.
  var analytics = CONFIG.analytics || {};
  if (analytics.scriptUrl) {
    var s = document.createElement('script');
    s.defer = true;
    s.src = analytics.scriptUrl;
    if (analytics.siteId) s.setAttribute('data-domain', analytics.siteId);
    document.head.appendChild(s);
  }

  // track('quiz_passed', { toy: 'crypto-in-5' }). Does nothing until an
  // analytics tool is set up; it then forwards to tools that expose
  // window.plausible or window.gtag.
  function track(name, props) {
    if (!analytics.scriptUrl) return;
    try {
      if (window.plausible) window.plausible(name, { props: props || {} });
      else if (window.gtag) window.gtag('event', name, props || {});
    } catch (e) {
      // Analytics must never break the page.
    }
  }

  // Sponsored rounds (data/business/sponsored_rounds.json): the approved,
  // current round for this toy and kind ('lesson' or 'scam'), or null. Only
  // while For Projects is switched on (config.js business.live, or preview).
  var roundsFile = null;
  function sponsoredRound(toyId, kind) {
    var site = window.WEB3TOYS;
    if (!site || !site.businessOn || !site.businessOn()) return Promise.resolve(null);
    if (!roundsFile) roundsFile = loadJson((site.root || '../') + 'data/business/sponsored_rounds.json').catch(function () { return { rounds: [] }; });
    var today = new Date().toISOString().slice(0, 10);
    return roundsFile.then(function (f) {
      return (f.rounds || []).filter(function (r) {
        return r.approved === true && r.toy === toyId && r.kind === kind && r.sponsor && /^https:\/\//.test(r.link || '') &&
          (!r.from || r.from <= today) && (!r.until || r.until >= today);
      })[0] || null;
    });
  }

  window.Web3Common = { esc: esc, loadJson: loadJson, loadError: loadError, rankBadge: rankBadge, track: track, sponsoredRound: sponsoredRound };
})();
