// Airdrop Campaign Planner: how many tokens, how much per wallet, the claim
// timeline and plain warnings. Works in the browser (window.AirdropEngine)
// and in Node tests.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AirdropEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function addDays(iso, days) {
    var d = new Date(iso + 'T00:00:00Z');
    if (isNaN(d)) return '';
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function plan(s, cfg) {
    var tokens = Math.max(0, Number(s.supply) || 0) * Math.max(0, Number(s.airdropPct) || 0) / 100;
    var wallets = Math.max(0, Math.round(Number(s.wallets) || 0));
    var shares;
    if (s.method === 'tiered') {
      shares = cfg.tiers.map(function (t) {
        var w = Math.round(wallets * t.walletPct / 100);
        var tk = tokens * t.tokenPct / 100;
        return { label: t.label, wallets: w, tokens: tk, each: w ? tk / w : 0 };
      });
    } else {
      shares = [{ label: s.method === 'points' ? 'Average wallet' : 'Every wallet', wallets: wallets, tokens: tokens, each: wallets ? tokens / wallets : 0 }];
    }
    var claimDay = (cfg.timeline.filter(function (t) { return t.id === 'open'; })[0] || { day: 0 }).day;
    var steps = cfg.timeline.map(function (t) { return { label: t.label, day: t.day, date: s.snapshot ? addDays(s.snapshot, t.day) : '' }; });
    var closeDay = claimDay + Math.max(0, Number(s.claimDays) || 0);
    steps.push({ label: 'Claim closes', day: closeDay, date: s.snapshot ? addDays(s.snapshot, closeDay) : '' });
    var vest = Math.max(0, Number(s.vestMonths) || 0);
    var atClaim = Math.min(100, Math.max(0, Number(s.atClaimPct) || 0));
    if (atClaim < 100 && vest > 0) {
      var endDay = claimDay + Math.round(vest * 30.44);
      steps.push({ label: 'Last tokens unlock', day: endDay, date: s.snapshot ? addDays(s.snapshot, endDay) : '' });
    }
    steps.sort(function (a, b) { return a.day - b.day; });

    var L = cfg.limits;
    var W = cfg.warnings;
    var warnings = [];
    var rules = Object.keys(s.rules || {}).filter(function (k) { return s.rules[k]; });
    var anti = Object.keys(s.anti || {}).filter(function (k) { return s.anti[k]; });
    if (Number(s.airdropPct) > L.bigAirdropPct) warnings.push(W.big.replace('{n}', L.bigAirdropPct));
    if (Number(s.claimDays) < L.shortClaimDays) warnings.push(W.short.replace('{n}', L.shortClaimDays));
    if (!rules.length) warnings.push(W.noRules);
    if (anti.length < L.minAnti) warnings.push(W.anti.replace('{n}', L.minAnti));
    if (atClaim >= 100 || vest <= 0) warnings.push(W.allAtClaim);

    return {
      tokens: tokens,
      value: (Number(s.price) || 0) * tokens,
      shares: shares,
      steps: steps,
      rules: rules,
      anti: anti,
      warnings: warnings,
    };
  }

  return { plan: plan, addDays: addDays };
});
