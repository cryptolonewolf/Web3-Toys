// The consent question for profile pages (supabase/021_pages_pro.sql).
// When a player has earned a project's Pro badge, or joined with a creator's
// invite link, they are asked once: "Share my X handle and badges with
// [name]?" Yes or No, plus an optional tick to share their email for updates.
// Nothing is shared unless they press Yes; they can change it any time in
// My Progress, Settings. Loaded by js/site.js for logged-in players while
// For Projects is on. Never shown during play or in admin.

(function () {
  var site = window.WEB3TOYS || {};
  var R = site.root || '/';
  var KEY = 'web3toys.consentLater.v1';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var shown = false;

  function quiet() {
    var path = location.pathname;
    if (/^\/(admin|p|my-page)\//.test(path) || /^\/@/.test(path)) return true;
    // Never during play: only on toy start or result screens is fine, so we
    // simply skip toy pages and ask on the next ordinary page.
    return !!document.body.getAttribute('data-toy');
  }

  function later() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } }

  function ask(A) {
    if (shown || quiet() || later() || !A.user()) return;
    shown = true;
    A.client.rpc('my_consent_asks').then(function (r) {
      var list = (!r.error && r.data) || [];
      if (list.length) show(A, list[0]);
    }, function () {});
  }

  function show(A, p) {
    var why = p.source === 'pro' ? 'You earned the ' + p.name + ' Pro badge.' : 'You joined web3.toys with ' + p.name + '\'s invite link.';
    var box = document.createElement('div');
    box.className = 'pay-modal consent-modal';
    box.innerHTML = '<div class="pay-box card stack stack--tight" role="dialog" aria-modal="true" aria-labelledby="consent-title">' +
      '<p class="label">' + esc(why) + '</p>' +
      '<h2 class="title-md" id="consent-title">Share my X handle and badges with ' + esc(p.name) + '?</h2>' +
      '<p class="small-print">If you say yes, <a href="' + R + '@' + esc(p.handle) + '" target="_blank" rel="noopener">' + esc(p.name) + '</a> can see your display name, your X handle (if you logged in with X) and your badges for their toys, and may show your display name on their page. If you say no, they only see a count.</p>' +
      '<label class="mk-check"><input type="checkbox" data-email /> <span>Also share my email for updates from ' + esc(p.name) + '</span></label>' +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-yes>Yes, share</button><button type="button" class="btn" data-no>No</button></div>' +
      '<p class="small-print">You can change this any time in My Progress, Settings. <button type="button" class="text-button" data-later>Ask me later</button></p>' +
      '<p class="small-print" data-msg aria-live="polite"></p></div>';
    document.body.appendChild(box);
    var close = function () { box.remove(); };
    var answer = function (yes) {
      box.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      A.client.rpc('answer_consent', { p_page: p.page_id, p_share: yes, p_email: yes && box.querySelector('[data-email]').checked }).then(function (r) {
        if (r.error) throw r.error;
        box.querySelector('.pay-box').innerHTML = '<p class="text">' + (yes ? '✅ Thanks! You are sharing with ' + esc(p.name) + '.' : 'Got it. Nothing is shared with ' + esc(p.name) + '.') + '</p><button type="button" class="btn" data-close>Close</button>';
        box.querySelector('[data-close]').addEventListener('click', close);
      }).catch(function (err) { box.querySelector('[data-msg]').textContent = err.message; box.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); });
    };
    box.querySelector('[data-yes]').addEventListener('click', function () { answer(true); });
    box.querySelector('[data-no]').addEventListener('click', function () { answer(false); });
    box.querySelector('[data-later]').addEventListener('click', function () { try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* ok */ } close(); });
    box.querySelector('[data-yes]').focus();
  }

  var go = function () { window.Web3Auth.onChange(function () { setTimeout(function () { ask(window.Web3Auth); }, 1500); }); };
  if (window.Web3Auth) go(); else document.addEventListener('web3auth:ready', go, { once: true });
})();
