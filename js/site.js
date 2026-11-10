// Shared by every page: the top menu and logo, the footer links, the mascot
// pictures, small icons and the fun effects (confetti, coins, wobble).
// To change the menu, edit MENU below.

(function () {
  // The site's home folder, worked out from where this file lives, so links
  // work from any page and from a preview link.
  var me = document.currentScript && document.currentScript.src;
  var ROOT = me ? me.replace(/js\/site\.js(\?.*)?$/, '') : '/';

  var MENU = [
    { label: 'Toys', href: '' },
    { label: 'Tools', href: 'builder/' },
    { label: 'Academy', href: 'academy/' },
    { label: 'Real Toys', href: 'real-toys/' },
    { label: 'My Progress', href: 'progress/' },
  ];
  var CALL = { label: 'Book a Call', href: 'book-a-call/' };
  // For Projects (switched on by business.live in config.js, planned for
  // December; preview it now with ?preview-business=1, hide with =0).
  var PROJECTS = [
    { label: 'Launch Your Own Toy', href: 'launch-your-toy/' },
    { label: 'Test Your Product', href: 'test-your-product/' },
    { label: 'Advertise', href: 'advertise/' },
    { label: 'List your course', href: 'academy/list-your-project/' },
    { label: 'Your free page', href: 'my-page/' },
    { label: 'Pages directory', href: 'pages/' },
    { label: 'Book a Call', href: 'book-a-call/' },
  ];
  // Books and About live in the footer and in the About Aki box on the side.
  var FOOTER_EXTRA = [
    { label: 'Books', href: 'books/' },
    { label: 'About Aki', href: 'about/' },
    { label: 'Work with us', href: 'work-with-us/' },
    { label: 'List your project', href: 'academy/list-your-project/' },
    { label: 'Leaderboard', href: 'leaderboard/' },
    { label: 'Check a certificate', href: 'verify/' },
    { label: 'Privacy', href: 'privacy/' },
    { label: 'Terms', href: 'terms/' },
    { label: 'Refunds', href: 'refunds/' },
    { label: 'Contact', href: 'contact/' },
  ];

  function config() {
    return window.WEB3TOYS_CONFIG || {};
  }

  // ---------- Mascot ----------
  // Pictures are listed in config.js under "mascot". If a picture is missing,
  // the simple placeholder drawing shows instead.
  var PLACEHOLDER = 'assets/mascot/placeholder.svg';
  var MOOD = { thinking: '💭', worried: '💦', celebrating: '🎉' };

  function mascotSrc(pose) {
    var m = config().mascot || {};
    return ROOT + (m[pose] || m.grin || PLACEHOLDER);
  }

  // <img> for a mascot picture. cls: extra classes, size: width and height.
  function mascotImg(pose, cls, size, alt) {
    return '<img class="' + (cls || 'mascot') + '" src="' + mascotSrc(pose) + '" alt="' + (alt || '') + '"' +
      ' width="' + (size || 84) + '" height="' + (size || 84) + '" data-pose="' + (pose || 'grin') + '"' +
      ' onerror="this.onerror=null;this.src=\'' + ROOT + PLACEHOLDER + '\'" />';
  }

  // Round face for the speech bubble guide, with a small mood badge.
  function face(pose) {
    return '<span class="guide-face" data-mood="' + (MOOD[pose] || '') + '">' + mascotImg(pose, 'guide-face-img', 72, 'Aki') + '</span>';
  }

  // ---------- Icons ----------
  // Small cartoon icons drawn in the site colours. icon('coin') returns SVG.
  var I = {
    coin: '<circle cx="12" cy="12" r="9" fill="#FFD93D"/><circle cx="12" cy="12" r="5.5" fill="none"/><path d="M12 9v6"/>',
    key: '<circle cx="8" cy="12" r="4.5" fill="#FFD93D"/><path d="M12.5 12H21M18 12v3M21 12v2.5"/>',
    block: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" fill="#4D9DE0"/><path d="M4 7.5L12 12l8-4.5M12 12v9"/><path d="M12 3l8 4.5L12 12 4 7.5z" fill="#BFE0FA"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 7.8-8 9-4.6-1.2-8-4.5-8-9V6z" fill="#FF6B6B"/><path d="M12 8v5M12 16v.5"/>',
    chain: '<rect x="2.5" y="8.5" width="11" height="7" rx="3.5" fill="#BFE0FA"/><rect x="10.5" y="8.5" width="11" height="7" rx="3.5" fill="none"/>',
    bulb: '<path d="M8.5 15.5C6.5 14 5.5 12 5.5 10a6.5 6.5 0 0113 0c0 2-1 4-3 5.5z" fill="#FFD93D"/><path d="M9 18.5h6M10 21h4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="#fff"/><circle cx="12" cy="12" r="3" fill="#1F1B2E"/>',
    check: '<circle cx="12" cy="12" r="9" fill="#6BCB77"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
    steps: '<path d="M3 20h5v-5h5v-5h5V5h3" fill="none"/><circle cx="20.5" cy="5" r="1.5" fill="#FF6B6B"/>',
    flame: '<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.6 3-5.5 3.5-9 2 1.3 3 3 3 4.5 1-1 1.5-2 1.5-3.5 3 2 5 4.6 5 8 0 3.4-2.5 6-6.5 6z" fill="#FF6B6B"/><path d="M12 21c-1.7 0-2.8-1.1-2.8-2.6 0-1.6 1.4-2.4 2.8-4 1.4 1.6 2.8 2.4 2.8 4 0 1.5-1.1 2.6-2.8 2.6z" fill="#FFD93D"/>',
    book: '<path d="M4 4.5h6.5A2.5 2.5 0 0113 7v13a2 2 0 00-2-2H4z" fill="#4D9DE0"/><path d="M20 4.5h-6.5A2.5 2.5 0 0011 7v13a2 2 0 012-2h7z" fill="#FFD93D"/>',
    gift: '<rect x="3.5" y="9" width="17" height="11.5" rx="1.5" fill="#FF6B6B"/><rect x="2.5" y="6.5" width="19" height="4" rx="1" fill="#FFD93D"/><path d="M12 6.5v14M12 6.5C10 3 7 3.5 7.5 5.5 8 7 12 6.5 12 6.5zm0 0c2-3.5 5-3 4.5-1 -.5 1.5-4.5 1-4.5 1z"/>',
    call: '<path d="M6.5 3.5l3 3.5-2 2.5c1 2.3 2.8 4.1 5 5l2.5-2 3.5 3-1.6 3c-7.5 0-13.4-6-13.4-13.4z" fill="#6BCB77"/>',
    star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="#FFD93D"/>',
    rocket: '<path d="M12 2.5c3.5 2.5 5 6.5 4 11.5H8C7 9 8.5 5 12 2.5z" fill="#fff"/><circle cx="12" cy="9" r="2" fill="#4D9DE0"/><path d="M8 14l-3 3.5h4M16 14l3 3.5h-4" fill="#FF6B6B"/><path d="M10.5 17.5c0 2 1.5 4 1.5 4s1.5-2 1.5-4" fill="#FFD93D"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" fill="#FFD93D"/><path d="M8 10.5V8a4 4 0 018 0v2.5M12 14.5v2.5"/>',
    quiz: '<rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="#FFD93D"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 16.5v.5"/>',
    bag: '<path d="M5 8h14l-1.2 12.5H6.2z" fill="#6BCB77"/><path d="M9 10V7a3 3 0 016 0v3"/>',
    report: '<path d="M5.5 3h9l4 4v14h-13z" fill="#fff"/><path d="M14.5 3v4h4M9 17.5v-3M12 17.5v-6M15 17.5v-4.5"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2" fill="#fff"/><path d="M3.5 6.5L12 13l8.5-6.5"/>',
  };

  function icon(name, cls) {
    if (!I[name]) return '';
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="#1F1B2E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + I[name] + '</svg>';
  }

  // ---------- Logo ----------
  // The brand files live in images/brand/.
  var BRAND = 'images/brand/';

  function logoImg() {
    return '<img class="logo-img" src="' + ROOT + BRAND + 'web3toys-logo.svg" alt="web3.toys" width="347" height="112" />';
  }

  // The hexagon 3 icon (certificates, loading screen, footer).
  function iconSrc(png) {
    return ROOT + BRAND + (png ? 'web3toys-icon-512.png' : 'web3toys-icon.svg');
  }

  // ---------- Top menu and footer ----------

  function here(href) {
    var path = location.href.split(/[?#]/)[0].replace(/index\.html$/, '');
    return path === ROOT + href;
  }

  function menuLinks(cls) {
    return MENU.map(function (m) {
      return '<a class="' + cls + '" href="' + ROOT + m.href + '"' + (here(m.href) ? ' aria-current="page"' : '') + '>' + m.label + '</a>';
    }).join('');
  }

  function businessOn() {
    var m = /[?&]preview-business=([01])/.exec(location.search);
    try {
      if (m) localStorage.setItem('web3toys.bizPreview.v1', m[1]);
      if (localStorage.getItem('web3toys.bizPreview.v1') === '1') return true;
    } catch (e) { /* private mode */ }
    return Boolean((config().business || {}).live);
  }

  function projectsMenu() {
    var on = PROJECTS.some(function (m) { return here(m.href); });
    return '<details class="topnav-group"' + (on ? ' data-here' : '') + '><summary class="topnav-link">For Projects</summary><div class="topnav-drop">' +
      PROJECTS.map(function (m) {
        return '<a class="topnav-link" href="' + ROOT + m.href + '"' + (here(m.href) ? ' aria-current="page"' : '') + '>' + m.label + '</a>';
      }).join('') + '</div></details>';
  }

  function buildTopbar() {
    var bar = document.getElementById('topbar');
    if (!bar) return;
    var biz = businessOn();
    var cta = biz
      ? '<a class="btn btn--cta" href="' + ROOT + 'launch-your-toy/"' + (here('launch-your-toy/') ? ' aria-current="page"' : '') + '><span aria-hidden="true">🚀</span><span class="cta-long">Launch Your Own Toy</span><span class="cta-short">Launch a Toy</span></a>'
      : '<a class="btn btn--yellow btn--call" href="' + ROOT + CALL.href + '"' + (here(CALL.href) ? ' aria-current="page"' : '') + '>' + icon('call') + '<span>' + CALL.label + '</span></a>';
    bar.innerHTML =
      '<div class="topbar-inner">' +
      '<a class="logo" href="' + ROOT + '">' + logoImg() + '</a>' +
      '<nav class="topnav" id="topnav" aria-label="Main">' + menuLinks('topnav-link') + (biz ? projectsMenu() : '') +
      '<a class="topnav-link menu-coins" href="' + ROOT + 'progress/#coins" hidden>' + icon('coin') + '&nbsp;<span data-coin-count>0</span>&nbsp;coins</a></nav>' +
      '<a class="coin-count" href="' + ROOT + 'progress/#coins" hidden title="Your coins">' + icon('coin') + '<span data-coin-count>0</span><span class="sr-only"> coins</span></a>' +
      cta +
      '<button type="button" class="menu-btn" aria-expanded="false" aria-controls="topnav"><span class="sr-only">Menu</span><span class="menu-lines" aria-hidden="true"></span></button>' +
      '</div>';
    var btn = bar.querySelector('.menu-btn');
    btn.addEventListener('click', function () {
      var open = bar.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
    var group = bar.querySelector('.topnav-group');
    if (group) document.addEventListener('click', function (e) { if (group.open && !group.contains(e.target)) group.open = false; });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && group && group.open) group.open = false;
      if (e.key === 'Escape' && bar.classList.contains('is-open')) {
        bar.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });
  }

  function buildFooter() {
    var foot = document.querySelector('.site-footer');
    if (!foot || foot.querySelector('.footer-nav')) return;
    var nav = document.createElement('nav');
    nav.className = 'footer-nav';
    nav.setAttribute('aria-label', 'Footer');
    var mark = document.createElement('a');
    mark.className = 'footer-mark';
    mark.href = ROOT;
    mark.innerHTML = '<img src="' + iconSrc() + '" alt="web3.toys" width="44" height="44" loading="lazy" />';
    foot.insertBefore(mark, foot.firstChild);
    var biz = businessOn();
    var extra = biz ? FOOTER_EXTRA.filter(function (m) { return m.href !== 'work-with-us/' && m.href !== 'academy/list-your-project/'; }) : FOOTER_EXTRA;
    nav.innerHTML = menuLinks('footer-link') +
      (biz ? '' : '<a class="footer-link" href="' + ROOT + CALL.href + '">' + CALL.label + '</a>') +
      extra.map(function (m) { return '<a class="footer-link" href="' + ROOT + m.href + '">' + m.label + '</a>'; }).join('') +
      (biz ? '<span class="footer-group"><b>For projects:</b> ' + PROJECTS.map(function (m) { return '<a class="footer-link" href="' + ROOT + m.href + '">' + m.label + '</a>'; }).join('') + '</span>' : '');
    foot.insertBefore(nav, mark.nextSibling);
  }

  // ---------- Fun effects ----------
  // All of them are skipped for visitors who ask for less motion.

  function calm() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var COLORS = ['#FFD93D', '#4D9DE0', '#FF6B6B', '#6BCB77', '#A98BFF'];

  function confetti() {
    if (calm()) return;
    var box = document.createElement('div');
    box.className = 'fx-confetti';
    box.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 60; i++) {
      var p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = COLORS[i % COLORS.length];
      p.style.setProperty('--drift', (Math.random() * 160 - 80).toFixed(0) + 'px');
      p.style.setProperty('--spin', (Math.random() * 900 - 450).toFixed(0) + 'deg');
      p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
      p.style.animationDuration = (1.6 + Math.random() * 1.2).toFixed(2) + 's';
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 3600);
  }

  // A few coins pop up out of an element, for example a right answer.
  function coins(el, count) {
    if (calm() || !el) return;
    var r = el.getBoundingClientRect();
    var box = document.createElement('div');
    box.className = 'fx-coins';
    box.setAttribute('aria-hidden', 'true');
    box.style.left = r.left + r.width / 2 + 'px';
    box.style.top = r.top + 'px';
    for (var i = 0; i < (count || 6); i++) {
      var c = document.createElement('i');
      c.innerHTML = icon('coin');
      c.style.setProperty('--x', (Math.random() * 140 - 70).toFixed(0) + 'px');
      c.style.setProperty('--y', (-50 - Math.random() * 60).toFixed(0) + 'px');
      c.style.animationDelay = (i * 0.04).toFixed(2) + 's';
      box.appendChild(c);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 1200);
  }

  // A short shake, for example on a wrong answer.
  function wobble(el) {
    if (calm() || !el) return;
    el.classList.remove('fx-wobble');
    void el.offsetWidth;
    el.classList.add('fx-wobble');
    setTimeout(function () { el.classList.remove('fx-wobble'); }, 600);
  }

  // ---------- Sound effects ----------
  // Off until the visitor taps a speaker button; the choice is remembered.
  // Short notes made in the browser, so there are no sound files to load.
  var SOUND_KEY = 'web3toys.sound.v1';
  var audio = null;

  // Each sound is a list of notes: [start pitch, length in seconds, wave,
  // volume, end pitch (optional), delay (optional)].
  var SOUNDS = {
    tick: [[740, 0.03, 'square', 0.025]],
    pop: [[520, 0.09, 'sine', 0.12, 900]],
    drop: [[620, 0.45, 'sawtooth', 0.06, 110]],
    cash: [[1180, 0.07, 'triangle', 0.1], [1580, 0.12, 'triangle', 0.1, null, 0.07]],
    ding: [[880, 0.15, 'sine', 0.12], [1320, 0.3, 'sine', 0.1, null, 0.12]],
    buzz: [[150, 0.25, 'square', 0.05]],
    clunk: [[90, 0.3, 'square', 0.09, 45], [60, 0.25, 'sine', 0.12, null, 0.05]],
  };

  function soundOn() {
    try { return window.localStorage.getItem(SOUND_KEY) === 'on'; } catch (e) { return false; }
  }

  function play(name) {
    if (!soundOn() || !SOUNDS[name]) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var t0 = audio.currentTime;
      SOUNDS[name].forEach(function (n) {
        var t = t0 + (n[5] || 0);
        var osc = audio.createOscillator();
        var gain = audio.createGain();
        osc.type = n[2];
        osc.frequency.setValueAtTime(n[0], t);
        if (n[4]) osc.frequency.exponentialRampToValueAtTime(n[4], t + n[1]);
        gain.gain.setValueAtTime(n[3], t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + n[1]);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(t);
        osc.stop(t + n[1] + 0.02);
      });
    } catch (e) {
      // Sound is a bonus; never let it break a toy.
    }
  }

  // A speaker button for a toy's header. Any number of them stay in step.
  function soundButton() {
    var on = soundOn();
    return '<button type="button" class="sound-btn" data-sound-toggle aria-pressed="' + on + '">' +
      '<span aria-hidden="true">' + (on ? '🔊' : '🔇') + '</span><span class="sr-only">Sound effects</span></button>';
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-sound-toggle]');
    if (!btn) return;
    var on = !soundOn();
    try { window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch (err) { /* private mode */ }
    document.querySelectorAll('[data-sound-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(on));
      b.firstChild.textContent = on ? '🔊' : '🔇';
    });
    play('pop');
  });

  // ---------- Counting (admin dashboard) ----------
  // Anonymous counts only: what happened and on which page, never who.
  // Waits in a queue until js/log.js (loaded with accounts) sends it.
  var logQueue = window.__w3log = window.__w3log || [];

  function logEvent(name, item) {
    logQueue.push({ type: 'event', name: name, page: location.pathname, item: item == null ? null : String(item) });
    if (window.Web3Log) window.Web3Log.flush();
  }

  // Operations home (admin): a play is the first tap on a button inside a
  // toy; page errors are counted with their message cut short (emails and
  // long numbers removed); one page load in five sends its load time.
  var played = false;
  document.addEventListener('click', function (e) {
    if (played || !document.body || !document.body.getAttribute('data-toy')) return;
    var app = document.getElementById('app');
    if (!app || !e.target.closest || !e.target.closest('#app button, #app [role="button"]')) return;
    played = true;
    var via = '';
    try { via = sessionStorage.getItem('web3toys.via.v1') || ''; } catch (err) { /* private mode */ }
    logEvent('play', document.body.getAttribute('data-toy') + (via ? '@' + via : ''));
  }, true);
  var errorsSent = 0;
  function logError(msg) {
    if (errorsSent >= 3) return;
    errorsSent += 1;
    logEvent('js_error', String(msg || 'Unknown error').replace(/\S+@\S+/g, '[email]').replace(/[0-9a-f]{16,}|\d{6,}/gi, '#').slice(0, 80));
  }
  window.addEventListener('error', function (e) { if (e && e.message) logError(e.message); });
  window.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; if (r && r.name !== 'AbortError') logError('Promise: ' + (r.message || r)); });
  window.addEventListener('load', function () {
    if (Math.random() >= 0.2) return;
    setTimeout(function () {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      var ms = nav ? Math.round(nav.loadEventEnd || nav.domComplete) : 0;
      if (ms > 0 && ms < 600000) logEvent('page_load', String(ms));
    }, 0);
  });

  function logLead(email, source) {
    logQueue.push({ type: 'lead', email: email, source: source, page: location.pathname });
    if (window.Web3Log) window.Web3Log.flush();
  }

  // Every email signup form on the site, whichever toy it is in.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches || !form.matches('[data-signup], [data-notify]')) return;
    var email = form.querySelector('input[type="email"]');
    if (!email || !email.value) return;
    logLead(email.value, form.hasAttribute('data-notify') ? 'real-toys' : pageKey());
    logEvent('signup', pageKey());
  }, true);

  // Book a Call clicks, wherever the button is.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="book-a-call"], a[href*="cal.com"], [data-soon="call"]');
    if (a) logEvent('call_click', pageKey());
  }, true);

  // ---------- Coins ----------
  // Visitors earn coins for playing, finishing and sharing. Each reward counts
  // once per toy, so tapping a button again earns nothing. Coins live in this
  // browser only. How many each action gives is set in config.js (points).
  var COINS_KEY = 'web3toys.coins.v1';
  var COIN_DEFAULTS = { daily: 5, finish: 20, certificate: 50, share: 10, x: 10 };

  function wallet() {
    try {
      var w = JSON.parse(window.localStorage.getItem(COINS_KEY));
      if (w && typeof w.balance === 'number') return w;
    } catch (e) { /* broken or blocked storage */ }
    return { balance: 0, claimed: {}, history: [] };
  }

  function saveWallet(w) {
    try { window.localStorage.setItem(COINS_KEY, JSON.stringify(w)); } catch (e) { /* private mode */ }
  }

  function coinAmount(kind) {
    var p = config().points || {};
    return p[kind] != null ? p[kind] : COIN_DEFAULTS[kind] || 0;
  }

  // award('share', 'scam', 'Shared Spot the Scam', button). Returns the coins
  // given (0 if this was already claimed).
  function award(kind, key, label, el) {
    var w = wallet();
    var id = kind + ':' + key;
    var n = coinAmount(kind);
    if (!n || w.claimed[id]) return 0;
    w.claimed[id] = Date.now();
    w.balance += n;
    w.history.unshift({ id: id, at: new Date().toISOString().slice(0, 10), label: label, coins: n });
    w.history = w.history.slice(0, 50);
    saveWallet(w);
    showCoins();
    queueTags();
    popCoins(n, el);
    // Logged-in players: js/sync.js saves it to their account.
    document.dispatchEvent(new CustomEvent('web3toys:changed', { detail: { kind: kind, key: key } }));
    if (kind === 'finish' || kind === 'certificate') logEvent('finish', key);
    else if (kind === 'share' || kind === 'x') logEvent('share', key);
    play('cash');
    return n;
  }

  // "+10" floating up from the button that earned it.
  function popCoins(n, el) {
    var counter = document.querySelector('.coin-count');
    var target = el || (counter && counter.offsetParent ? counter : document.querySelector('.menu-btn'));
    var tag = document.createElement('span');
    tag.className = 'coin-pop';
    tag.setAttribute('role', 'status');
    tag.innerHTML = '+' + n + ' ' + icon('coin') + '<span class="sr-only"> coins</span>';
    var r = target ? target.getBoundingClientRect() : { left: innerWidth / 2, top: 80, width: 0 };
    tag.style.left = Math.min(innerWidth - 80, Math.max(8, r.left + r.width / 2 - 30)) + 'px';
    tag.style.top = Math.max(70, r.top - 10) + 'px';
    document.body.appendChild(tag);
    setTimeout(function () { tag.remove(); }, 1600);
    if (target) coins(target, 4);
  }

  function showCoins() {
    var n = wallet().balance;
    document.querySelectorAll('[data-coin-count]').forEach(function (el) { el.textContent = n.toLocaleString('en-US'); });
    document.querySelectorAll('.coin-count, .menu-coins').forEach(function (el) { el.hidden = n <= 0; });
  }

  // Each toy page earns sharing coins once: once for its share card, once
  // for posting on X.
  function pageKey() {
    return location.pathname.replace(/index\.html$/, '').replace(/\/$/, '').split('/').pop() || 'home';
  }

  var X_LINKS = 'a[href^="https://x.com/intent"], a[href^="https://twitter.com/intent"]';

  // Posting on X from any toy earns coins once per page.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest(X_LINKS);
    if (!a) return;
    award('x', pageKey(), 'Posted on X from ' + (document.title.split(' · ')[0] || pageKey()), a);
  });

  // A small "+10" tag on every Share and Post on X button, so visitors know
  // sharing earns coins. Once earned, it turns into a tick.
  function tagButtons() {
    var claimed = wallet().claimed;
    document.querySelectorAll('[data-share], ' + X_LINKS).forEach(function (el) {
      var kind = el.matches(X_LINKS) ? 'x' : 'share';
      var n = coinAmount(kind);
      if (!n) return;
      var done = Boolean(claimed[kind + ':' + pageKey()]);
      var tag = el.querySelector('.coin-tag');
      if (!tag) {
        tag = document.createElement('span');
        tag.className = 'coin-tag';
        el.appendChild(tag);
      }
      var html = done ? '✓' + icon('coin') + '<span class="sr-only"> coins earned</span>' : '+' + n + icon('coin') + '<span class="sr-only"> coins</span>';
      if (tag.innerHTML !== html) tag.innerHTML = html;
      tag.classList.toggle('is-done', done);
    });
  }

  var tagQueued = false;
  function queueTags() {
    if (tagQueued) return;
    tagQueued = true;
    requestAnimationFrame(function () {
      tagQueued = false;
      tagButtons();
    });
  }

  // ---------- Older helper ----------
  // When a page is opened straight from the computer (double-clicked) instead
  // of from a website, links to a folder like "simulator/" would show a file
  // list. Point them at the folder's index.html instead. Online, nothing changes.
  function fixFolderLinks(root) {
    if (location.protocol !== 'file:') return;
    root.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (/^(?!file:)[a-z]+:|^#/i.test(href)) return;
      if (href === '' || href === '.' || href === './') href = './';
      if (href.slice(-1) === '/') a.setAttribute('href', href + 'index.html');
    });
  }

  window.WEB3TOYS = {
    root: ROOT,
    fixFolderLinks: fixFolderLinks,
    mascotSrc: mascotSrc,
    mascotImg: mascotImg,
    face: face,
    icon: icon,
    iconSrc: iconSrc,
    fx: { confetti: confetti, coins: coins, wobble: wobble, calm: calm },
    sound: { play: play, on: soundOn, button: soundButton },
    log: logEvent,
    deliver: deliver,
    businessOn: businessOn,
    coins: { award: award, wallet: wallet, amount: coinAmount, refresh: showCoins, pageKey: pageKey },
  };

  // Accounts load only when config.js has the Supabase settings.
  function loadAuth() {
    var sb = config().supabase || {};
    if (!sb.url || !sb.anonKey || window.Web3Auth) return;
    var load = function (srcs) {
      if (!srcs.length) return;
      var el = document.createElement('script');
      el.src = ROOT + srcs[0];
      el.onload = function () { load(srcs.slice(1)); };
      document.head.appendChild(el);
    };
    var need = window.Web3Progress ? [] : ['js/progress.js'];
    if (!window.Web3Avatar) need.push('js/avatar.js');
    var after = (window.Web3EarnTasks ? [] : ['js/earn-tasks.js']).concat(['js/earn-fab.js']);
    load(need.concat(['js/vendor/supabase-2.117.3.js', 'js/auth.js', 'js/log.js', 'js/sync.js', 'js/pay.js'], after));
  }

  // Loading screen: the hexagon icon until the page draws its content
  // (pages replace everything inside #app when they are ready).
  function showLoader() {
    var app = document.getElementById('app');
    if (!app || app.querySelector(':scope > :not(noscript)')) return;
    var box = document.createElement('div');
    box.className = 'page-loader';
    box.setAttribute('role', 'status');
    box.innerHTML = '<img src="' + iconSrc() + '" alt="" width="72" height="72" /><span>Loading…</span>';
    app.appendChild(box);
  }

  // Invite links (?ref=CODE): remember the first one; js/sync.js links the
  // new player to their inviter after they log in.
  // Play links on profile pages add ?via=handle, so the page's owner sees
  // plays that came from their page (counted without names).
  function keepVia() {
    var m = /[?&]via=@?([A-Za-z0-9_]{1,15})\b/.exec(location.search);
    if (!m) return;
    try { sessionStorage.setItem('web3toys.via.v1', m[1].toLowerCase()); } catch (e) { /* private mode */ }
  }

  function keepReferral() {
    var m = /[?&]ref=([a-z0-9]{6,12})\b/i.exec(location.search);
    if (!m) return;
    try { if (!localStorage.getItem('web3toys.ref.v1')) localStorage.setItem('web3toys.ref.v1', m[1].toLowerCase()); } catch (e) { /* private mode */ }
  }

  // Paid offers on finish screens (js/offers.js), on every page. Pages say
  // how to deliver what was bought with WEB3TOYS.deliver(productId, fn);
  // handlers wait in a queue until js/offers.js has loaded.
  var deliverQueue = window.__w3deliver = window.__w3deliver || [];

  function deliver(id, fn) {
    if (window.Web3Offers) window.Web3Offers.deliver(id, fn);
    else deliverQueue.push([id, fn]);
  }

  function loadOffers() {
    if (window.Web3Offers) return;
    var el = document.createElement('script');
    el.src = ROOT + 'js/offers.js';
    document.head.appendChild(el);
  }

  // Early Bird counters and badges (js/earlybird.js), on every page.
  function loadEarlyBird() {
    if (window.Web3EarlyBird || !(config().supabase || {}).url) return;
    var el = document.createElement('script');
    el.src = ROOT + 'js/earlybird.js';
    document.head.appendChild(el);
  }

  // The consent question for profile pages (js/consent-ask.js), for
  // logged-in players while For Projects is on.
  function loadConsent() {
    if (!businessOn() || document.body.getAttribute('data-toy') || !(config().supabase || {}).url) return;
    var el = document.createElement('script');
    el.src = ROOT + 'js/consent-ask.js';
    document.head.appendChild(el);
  }

  // Embedded toys (?embed=1, the Pro embed code): only the toy, no menus.
  function embedMode() {
    if (!/[?&]embed=1\b/.test(location.search) || !document.body.getAttribute('data-toy')) return;
    document.documentElement.classList.add('is-embed');
    document.body.classList.add('is-embed');
  }

  // Sponsor cards on toy pages (js/sponsor.js).
  function loadSponsor() {
    if (window.Web3Sponsor || !document.body.getAttribute('data-toy') || !(config().supabase || {}).url) return;
    var el = document.createElement('script');
    el.src = ROOT + 'js/sponsor.js';
    document.head.appendChild(el);
  }

  function start() {
    keepReferral();
    keepVia();
    embedMode();
    loadConsent();
    loadOffers();
    loadEarlyBird();
    loadSponsor();
    logEvent('page_view', null);
    showLoader();
    buildTopbar();
    buildFooter();
    loadAuth();
    showCoins();
    // Toys draw their buttons later, so tag them whenever the page changes.
    tagButtons();
    new MutationObserver(queueTags).observe(document.body, { childList: true, subtree: true });
    // Opening any toy earns a small coin bonus once a day.
    if (document.getElementById('shop')) {
      var name = (document.title.split(' · ')[0] || '').split(':')[0];
      award('daily', new Date().toISOString().slice(0, 10), 'First toy of the day: ' + name);
    }
    fixFolderLinks(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
