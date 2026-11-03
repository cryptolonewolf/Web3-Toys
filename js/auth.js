// Accounts: log in with X, Google or an email magic link (Supabase Auth).
// Loaded by site.js only when config.js has supabase.url and anonKey.
// Playing never needs an account. Window.Web3Auth lets pages ask who is
// logged in and react when that changes.

(function () {
  var site = window.WEB3TOYS;
  var CFG = window.WEB3TOYS_CONFIG || {};
  var SB = CFG.supabase || {};
  var A = CFG.auth || {};
  var ROOT = site.root;
  var CONSENT_VERSION = '2026-11';
  var CONSENT_KEY = 'web3toys.consent.v1';
  var listeners = [];
  var current = null;
  var profile = null;

  if (!window.supabase || !SB.url || !SB.anonKey) return;
  var client = window.supabase.createClient(SB.url, SB.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function consentGiven() {
    try { return !!localStorage.getItem(CONSENT_KEY); } catch (e) { return false; }
  }

  function rememberConsent() {
    try { localStorage.setItem(CONSENT_KEY, new Date().toISOString()); } catch (e) { /* private mode */ }
  }

  // ---------- Header: "Log in" in the menu, or the avatar when logged in ----------

  // Everyone gets a random cartoon picture (js/avatar.js) from their seed.
  function avatarHtml(size, cls) {
    var seed = (profile && profile.avatar_seed) || (current && current.id) || 'visitor';
    var frame = profile && profile.badge_frame ? ' ' + profile.badge_frame : '';
    return '<img class="acct-avatar' + frame + (cls ? ' ' + cls : '') + '" src="' + window.Web3Avatar.dataUri(seed) + '" alt="" width="' + size + '" height="' + size + '" />';
  }

  function paintHeader() {
    var bar = document.querySelector('#topbar .topbar-inner');
    if (!bar) return;
    var nav = bar.querySelector('#topnav');
    var link = nav && nav.querySelector('[data-acct-link]');
    if (nav && !link) {
      link = document.createElement('a');
      link.className = 'topnav-link';
      link.setAttribute('data-acct-link', '');
      nav.appendChild(link);
    }
    var chip = bar.querySelector('[data-acct-chip]');
    if (current) {
      // Logged in: the avatar opens the account, and My Progress is in the menu.
      if (link) link.hidden = true;
      if (!chip) {
        chip = document.createElement('a');
        chip.className = 'acct-chip';
        chip.setAttribute('data-acct-chip', '');
        bar.insertBefore(chip, bar.querySelector('.menu-btn'));
      }
      chip.href = ROOT + 'progress/';
      chip.title = 'My account';
      chip.innerHTML = avatarHtml(32) + '<span class="sr-only">My account</span>';
    } else {
      if (chip) chip.remove();
      if (link) {
        link.hidden = false;
        link.href = '#login';
        link.textContent = 'Log in';
        link.onclick = function (e) {
          e.preventDefault();
          var top = document.getElementById('topbar');
          var mb = top && top.querySelector('.menu-btn');
          if (top) top.classList.remove('is-open');
          if (mb) mb.setAttribute('aria-expanded', 'false');
          open();
        };
      }
    }
  }

  // ---------- The login box ----------

  function open(reason) {
    if (document.querySelector('.acct-modal')) return;
    var agreed = consentGiven();
    var m = document.createElement('div');
    m.className = 'modal acct-modal';
    m.innerHTML =
      '<div class="card stack stack--tight" role="dialog" aria-modal="true" aria-labelledby="acct-title">' +
      '<div class="cap-row"><h2 class="title-md" id="acct-title">Log in or sign up</h2><button type="button" class="cap-x" data-close aria-label="Close">×</button></div>' +
      '<p class="text">' + esc(reason || 'Save your progress, coins and certificates, and see them on any device. Playing stays free without an account.') + '</p>' +
      '<label class="mk-check acct-consent"><input type="checkbox" data-consent' + (agreed ? ' checked' : '') + ' /> <span>I agree to the <a href="' + ROOT + 'privacy/" target="_blank" rel="noopener">Privacy policy</a> and <a href="' + ROOT + 'terms/" target="_blank" rel="noopener">Terms</a>.</span></label>' +
      '<div class="stack stack--tight" data-ways>' +
      (A.x !== false ? '<button type="button" class="btn btn--ink btn--block acct-way" data-oauth="' + esc(A.xProvider || 'x') + '">Continue with X</button>' : '') +
      (A.google !== false ? '<button type="button" class="btn btn--block acct-way" data-oauth="google">Continue with Google</button>' : '') +
      (A.email !== false ? '<form class="stack stack--tight" data-email><label class="label" for="acct-email">Or get a login link by email</label>' +
        '<div class="lk-row"><input id="acct-email" class="field" type="email" autocomplete="email" required placeholder="you@example.com" />' +
        '<button type="submit" class="btn btn--yellow acct-way">Send link</button></div></form>' : '') +
      '</div><p class="small-print" data-acct-msg aria-live="polite"></p>' +
      '<p class="small-print">We never post for you and never see your passwords.</p></div>';
    document.body.appendChild(m);
    var box = m.querySelector('[role=dialog]');
    var consent = m.querySelector('[data-consent]');
    var msg = m.querySelector('[data-acct-msg]');
    var ways = m.querySelectorAll('.acct-way');
    var sync = function () {
      ways.forEach(function (b) { b.disabled = !consent.checked; });
      msg.textContent = consent.checked ? '' : 'Tick the box above to continue.';
    };
    var close = function () { m.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    consent.addEventListener('change', sync);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    m.querySelector('[data-close]').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    m.querySelectorAll('[data-oauth]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!consent.checked) return sync();
        rememberConsent();
        msg.textContent = 'Taking you to log in…';
        client.auth.signInWithOAuth({ provider: b.getAttribute('data-oauth'), options: { redirectTo: location.href.split('#')[0] } })
          .then(function (r) { if (r.error) msg.textContent = 'Could not start the login: ' + r.error.message; });
      });
    });
    var form = m.querySelector('[data-email]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!consent.checked) return sync();
        rememberConsent();
        var email = form.querySelector('input').value.trim();
        msg.textContent = 'Sending…';
        client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.href.split('#')[0] } })
          .then(function (r) {
            msg.textContent = r.error ? 'Could not send the link: ' + r.error.message : 'Check your inbox for a login link. It works once and for a short time.';
          });
      });
    }
    sync();
    (consent.checked ? box.querySelector('.acct-way') : consent).focus();
  }

  // ---------- Session ----------

  function loadProfile() {
    if (!current) { profile = null; return Promise.resolve(); }
    return client.from('profiles').select('*').eq('id', current.id).maybeSingle().then(function (r) {
      profile = r.data || null;
      var patch = { last_seen_at: new Date().toISOString() };
      // First login: a random cartoon picture and fun name, pump.fun style.
      if (profile && !profile.avatar_seed) {
        patch.avatar_seed = window.Web3Avatar.newSeed();
        patch.display_name = window.Web3Avatar.name(patch.avatar_seed);
        profile.avatar_seed = patch.avatar_seed;
        profile.display_name = patch.display_name;
      }
      // The consent was ticked in the login box before signing up.
      if (profile && !profile.consent_at && consentGiven()) {
        patch.consent_at = new Date().toISOString();
        patch.consent_version = CONSENT_VERSION;
      }
      return client.from('profiles').update(patch).eq('id', current.id);
    });
  }

  function changed(user) {
    var was = current && current.id;
    current = user || null;
    if ((current && current.id) === was && profile) return;
    loadProfile().then(function () {
      paintHeader();
      listeners.forEach(function (cb) { try { cb(current, profile); } catch (e) { /* keep others running */ } });
    });
  }

  client.auth.getSession().then(function (r) { changed(r.data.session && r.data.session.user); });
  client.auth.onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_OUT') { profile = null; current = null; paintHeader(); listeners.forEach(function (cb) { cb(null, null); }); return; }
    changed(session && session.user);
  });
  paintHeader();

  function signOut() {
    return client.auth.signOut();
  }

  function deleteAccount() {
    return client.rpc('delete_my_account').then(function (r) {
      if (r.error) throw r.error;
      try {
        Object.keys(localStorage).filter(function (k) { return k.indexOf('web3toys.') === 0; }).forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { /* private mode */ }
      return client.auth.signOut();
    });
  }

  function setName(name) {
    if (!current) return Promise.reject(new Error('Not logged in'));
    name = String(name || '').trim().slice(0, 40);
    return client.from('profiles').update({ display_name: name }).eq('id', current.id).then(function (r) {
      if (r.error) throw r.error;
      profile.display_name = name;
      paintHeader();
    });
  }

  // New random picture, or new random name. Returns the new value.
  function shuffle(what) {
    if (!current) return Promise.reject(new Error('Not logged in'));
    var seed = window.Web3Avatar.newSeed();
    var patch = what === 'name' ? { display_name: window.Web3Avatar.name(seed) } : { avatar_seed: seed };
    return client.from('profiles').update(patch).eq('id', current.id).then(function (r) {
      if (r.error) throw r.error;
      Object.keys(patch).forEach(function (k) { profile[k] = patch[k]; });
      paintHeader();
      return patch.display_name || patch.avatar_seed;
    });
  }

  document.addEventListener('web3toys:synced', paintHeader);

  window.Web3Auth = {
    shuffle: shuffle,
    avatarHtml: avatarHtml,
    client: client,
    user: function () { return current; },
    profile: function () { return profile; },
    open: open,
    signOut: signOut,
    deleteAccount: deleteAccount,
    setName: setName,
    // cb(user, profile) runs now (if known) and on every login or logout.
    onChange: function (cb) { listeners.push(cb); if (profile || current === null) cb(current, profile); },
  };
  document.dispatchEvent(new CustomEvent('web3auth:ready'));
})();
