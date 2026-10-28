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
    { label: 'Real Toys', href: 'real-toys/' },
    { label: 'Books', href: 'books/' },
    { label: 'About', href: 'about/' },
    { label: 'My Progress', href: 'progress/' },
  ];
  var CALL = { label: 'Book a Call', href: 'book-a-call/' };
  var FOOTER_EXTRA = [{ label: 'Check a certificate', href: 'verify/' }];

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
  // "web3 toys" in Luckiest Guy, a coin for the dot, and floating blocks.
  // The same drawing is saved as assets/logo.svg for use elsewhere.
  function cube(x, y, s, top, side, cls) {
    var h = s / 2;
    return '<g class="logo-block ' + cls + '" stroke="#1F1B2E" stroke-width="1.6" stroke-linejoin="round">' +
      '<path d="M' + x + ' ' + (y - s) + 'l' + s + ' ' + h + 'l-' + s + ' ' + h + 'l-' + s + ' -' + h + 'z" fill="' + top + '"/>' +
      '<path d="M' + (x - s) + ' ' + (y - h) + 'l' + s + ' ' + h + 'v' + (s + 1) + 'l-' + s + ' -' + h + 'z" fill="' + side + '"/>' +
      '<path d="M' + (x + s) + ' ' + (y - h) + 'l-' + s + ' ' + h + 'v' + (s + 1) + 'l' + s + ' -' + h + 'z" fill="' + side + '" style="filter:brightness(.8)"/></g>';
  }

  function logoSvg() {
    return '<svg class="logo-svg" viewBox="0 0 224 58" role="img" aria-label="web3.toys">' +
      cube(30, 14, 7, '#BFE0FA', '#4D9DE0', 'b1') +
      cube(122, 10, 6, '#FFE3DF', '#FF6B6B', 'b2') +
      cube(212, 22, 7, '#DDF3DF', '#6BCB77', 'b3') +
      '<g font-family="\'Luckiest Guy\', \'Fredoka\', sans-serif" font-size="34" stroke-linejoin="round">' +
      '<text x="2" y="52" textLength="92" lengthAdjust="spacingAndGlyphs" fill="#1F1B2E">web3</text>' +
      '<text x="120" y="52" textLength="84" lengthAdjust="spacingAndGlyphs" fill="#FFD93D" stroke="#1F1B2E" stroke-width="2.6" paint-order="stroke">toys</text></g>' +
      '<g class="logo-coin" stroke="#1F1B2E"><circle cx="107" cy="41" r="8.5" fill="#FFD93D" stroke-width="2.4"/>' +
      '<circle cx="107" cy="41" r="4.6" fill="none" stroke-width="1.6"/></g></svg>';
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

  function buildTopbar() {
    var bar = document.getElementById('topbar');
    if (!bar) return;
    bar.innerHTML =
      '<div class="topbar-inner">' +
      '<a class="logo" href="' + ROOT + '">' + logoSvg() + '</a>' +
      '<nav class="topnav" id="topnav" aria-label="Main">' + menuLinks('topnav-link') + '</nav>' +
      '<a class="btn btn--yellow btn--call" href="' + ROOT + CALL.href + '"' + (here(CALL.href) ? ' aria-current="page"' : '') + '>' + icon('call') + '<span>' + CALL.label + '</span></a>' +
      '<button type="button" class="menu-btn" aria-expanded="false" aria-controls="topnav"><span class="sr-only">Menu</span><span class="menu-lines" aria-hidden="true"></span></button>' +
      '</div>';
    var btn = bar.querySelector('.menu-btn');
    btn.addEventListener('click', function () {
      var open = bar.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (e) {
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
    nav.innerHTML = menuLinks('footer-link') +
      '<a class="footer-link" href="' + ROOT + CALL.href + '">' + CALL.label + '</a>' +
      FOOTER_EXTRA.map(function (m) { return '<a class="footer-link" href="' + ROOT + m.href + '">' + m.label + '</a>'; }).join('');
    foot.insertBefore(nav, foot.firstChild);
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
    logoSvg: logoSvg,
    fx: { confetti: confetti, coins: coins, wobble: wobble, calm: calm },
  };

  function start() {
    buildTopbar();
    buildFooter();
    fixFolderLinks(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
