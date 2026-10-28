// The home page cards. Each toy card is its own little logo: its own font,
// colours, objects and hover effect. Nothing is shared except the rounded
// corners. Every drawing sits in a 270 by 100 box, the shape of the card.
//
// font: a Google Font. Only the letters in the title (and in extra) are
// downloaded, which keeps the page fast.
// title: the card title as HTML; most cards just show the plain title.
// art: the drawing behind and around the title.

(function () {
  var INK = '#1F1B2E';

  function svg(inner, extra) {
    return '<svg class="xart" viewBox="0 0 270 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"' + (extra || '') + '>' + inner + '</svg>';
  }

  function range(n, fn) {
    var out = '';
    for (var i = 0; i < n; i++) out += fn(i);
    return out;
  }

  function star(x, y, r, fill) {
    return '<path d="M' + x + ' ' + (y - r) + ' L' + (x + r * 0.3) + ' ' + (y - r * 0.3) + ' L' + (x + r) + ' ' + y + ' L' + (x + r * 0.3) + ' ' + (y + r * 0.3) + ' L' + x + ' ' + (y + r) + ' L' + (x - r * 0.3) + ' ' + (y + r * 0.3) + ' L' + (x - r) + ' ' + y + ' L' + (x - r * 0.3) + ' ' + (y - r * 0.3) + 'Z" fill="' + fill + '"/>';
  }

  // Stack of coins drawn from the bottom up. cls lets each stack bounce.
  function coinStack(x, base, n, cls, delay) {
    return '<g class="' + cls + '" style="--d:' + delay + 's">' + range(n, function (i) {
      var y = base - i * 5;
      return '<path d="M' + (x - 11) + ' ' + y + ' v3 a11 3.5 0 0 0 22 0 v-3z" fill="#B8860B" stroke="' + INK + '" stroke-width="1.2"/>' +
        '<ellipse cx="' + x + '" cy="' + y + '" rx="11" ry="3.5" fill="#FFD93D" stroke="' + INK + '" stroke-width="1.2"/>';
    }) + '</g>';
  }

  var DESIGNS = {
    // 1. Pixel art on black, glowing yellow, blocks chained along the edges.
    'crypto-in-5': {
      font: 'Press Start 2P',
      title: function () { return 'Genesis<br>Block'; },
      art: function () {
        var colors = ['#FFD93D', '#4D9DE0', '#FF6B6B', '#6BCB77'];
        var chain = function (y, size, offset) {
          return range(11, function (i) {
            var x = offset + i * 25;
            return (i ? '<rect x="' + (x - 25 + size) + '" y="' + (y + size / 2 - 1) + '" width="' + (25 - size) + '" height="2" fill="#6b6b80"/>' : '') +
              '<rect class="pblock" style="--d:' + (i * 0.06).toFixed(2) + 's" x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" fill="' + colors[i % 4] + '"/>';
          });
        };
        return svg(
          '<rect width="270" height="100" fill="#0B0B14"/>' +
          range(26, function (i) { return '<rect x="' + ((i * 53) % 270) + '" y="' + (14 + ((i * 37) % 70)) + '" width="2" height="2" fill="' + (i % 3 ? '#3a3a55' : '#FFD93D') + '"/>'; }) +
          chain(4, 8, 8) + chain(86, 10, 4),
          ' shape-rendering="crispEdges"'
        );
      },
    },

    // 2. White card, thick yellow border, ink Bungee title with a key ring O.
    'getting-started': {
      font: 'Bungee',
      title: function () {
        return 'N<span class="keyring" aria-hidden="true"><svg viewBox="0 0 40 60"><circle cx="20" cy="20" r="15" fill="none" stroke="' + INK + '" stroke-width="7"/>' +
          '<g class="ringkey"><rect x="17" y="33" width="6" height="22" rx="2" fill="#FFD93D" stroke="' + INK + '" stroke-width="2"/><rect x="23" y="45" width="7" height="4" fill="#FFD93D" stroke="' + INK + '" stroke-width="2"/><circle cx="20" cy="35" r="5" fill="#FFD93D" stroke="' + INK + '" stroke-width="2"/></g></svg></span>T YOUR KEYS';
      },
      art: function () {
        var key = function (x, y, r, c) {
          return '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ')" stroke="' + INK + '" stroke-width="2"><circle r="7" fill="' + c + '"/><circle r="2.5" fill="#fff"/><path d="M7 -2 H28 V2 H7Z M20 2 V7 H24 V2" fill="' + c + '"/></g>';
        };
        return svg(
          '<rect width="270" height="100" fill="#FFFFFF"/>' +
          key(22, 18, 20, '#FFD93D') + key(236, 84, -150, '#4D9DE0') +
          '<g transform="translate(238 8)" stroke="' + INK + '" stroke-width="2"><path d="M6 14 V8 a7 7 0 0 1 14 0 V14" fill="none" stroke-width="3"/><rect x="2" y="13" width="22" height="18" rx="3" fill="#FF6B6B"/><circle cx="13" cy="21" r="2.5" fill="' + INK + '"/></g>' +
          '<g transform="translate(10 66) rotate(-6)" stroke="' + INK + '" stroke-width="1.6"><rect width="44" height="28" rx="3" fill="#FFF8E1"/>' +
          range(4, function (i) { return '<text x="' + (4 + (i % 2) * 21) + '" y="' + (11 + Math.floor(i / 2) * 11) + '" font-size="6" font-family="monospace" fill="' + INK + '" stroke="none">' + (i + 1) + '.</text><path d="M' + (10 + (i % 2) * 21) + ' ' + (11 + Math.floor(i / 2) * 11) + ' h10" stroke-width="1"/>'; }) +
          '</g>'
        );
      },
    },

    // 3. Caution stripes, red comic title with a black outline and a shake.
    'dont-lose-money': {
      font: 'Bangers',
      art: function () {
        return svg(
          '<defs><pattern id="hz" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="16" height="16" fill="#FFD93D"/><rect width="8" height="16" fill="' + INK + '"/></pattern></defs>' +
          '<rect width="270" height="100" fill="#FFE14D"/><rect width="270" height="14" fill="url(#hz)"/><rect y="86" width="270" height="14" fill="url(#hz)"/>' +
          '<g class="rekt-skull" transform="translate(16 30)" stroke="' + INK + '" stroke-width="2"><path d="M18 0 C6 0 0 9 1 18 C2 24 6 27 8 28 V36 H28 V28 C30 27 34 24 35 18 C36 9 30 0 18 0Z" fill="#fff"/><circle cx="11" cy="17" r="4" fill="' + INK + '"/><circle cx="25" cy="17" r="4" fill="' + INK + '"/><path d="M14 31 V36 M18 31 V36 M22 31 V36"/></g>' +
          '<path d="M196 24 L212 34 L222 28 L238 52 L248 46 L262 72" fill="none" stroke="#E8262F" stroke-width="4" stroke-linejoin="round"/><path d="M256 70 L263 74 L264 64Z" fill="#E8262F"/>' +
          '<g class="rekt-pig" transform="translate(206 56)" stroke="' + INK + '" stroke-width="2"><path d="M4 12 C4 2 14 -1 22 0 C30 1 34 6 34 12 C34 20 28 24 20 24 C12 24 4 21 4 12Z" fill="#FF9EC4"/><path d="M19 0 L15 8 L20 13 L16 24" fill="none" stroke-width="2.2"/><rect x="33" y="9" width="5" height="6" rx="2" fill="#FF9EC4"/><path d="M8 22 V28 M28 22 V28"/><circle cx="27" cy="9" r="1.6" fill="' + INK + '"/><path d="M14 -1 h8" stroke-width="3"/></g>'
        );
      },
    },

    // 4. Purple, a gold gradient title with a hard shadow, coin stacks growing.
    'earn-small': {
      font: 'Shrikhand',
      art: function () {
        return svg(
          '<defs><radialGradient id="ss" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#8E5CFF"/><stop offset="1" stop-color="#4B1FA8"/></radialGradient></defs>' +
          '<rect width="270" height="100" fill="url(#ss)"/>' +
          star(30, 18, 4, '#FFE98A') + star(244, 16, 5, '#FFE98A') + star(132, 90, 3, '#C9B2FF') +
          coinStack(18, 88, 3, 'cstack', 0) + coinStack(42, 88, 6, 'cstack', 0.08) + coinStack(66, 88, 9, 'cstack', 0.16) +
          coinStack(206, 88, 10, 'cstack', 0.24) + coinStack(230, 88, 12, 'cstack', 0.32) + coinStack(254, 88, 14, 'cstack', 0.4)
        );
      },
    },

    // 5. A manila case file: typewriter title, CLASSIFIED stamp, redactions, cracked vault.
    'web3-hacks': {
      font: 'Special Elite',
      extra: 'CLASSIFIED',
      title: function (t) { return t + '<span class="stamp" aria-hidden="true">CLASSIFIED</span>'; },
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#D9B46E"/>' +
          '<path d="M0 8 H70 L80 0 H0Z" fill="#C9A15A"/>' +
          '<rect x="0" y="8" width="270" height="92" fill="#E8C887"/>' +
          range(5, function (i) { return '<path d="M12 ' + (20 + i * 15) + ' H258" stroke="#C9A15A" stroke-width="0.8"/>'; }) +
          '<g fill="#111"><rect x="14" y="76" width="40" height="6"/><rect x="58" y="76" width="18" height="6"/><rect x="14" y="86" width="26" height="6"/><rect x="178" y="14" width="30" height="5"/><rect x="14" y="16" width="52" height="5"/></g>' +
          '<g transform="translate(222 52)" stroke="' + INK + '" stroke-width="2"><circle r="20" fill="#9AA6B8"/><circle r="13" fill="#C3CCD9"/><path d="M-13 0 H13 M0 -13 V13" stroke-width="1.5"/><circle r="4" fill="#9AA6B8"/><path d="M6 -19 L2 -8 L9 -2 L3 8" fill="none" stroke-width="2.2"/></g>'
        );
      },
    },

    // 6. An airmail envelope with a marker title, a hook and a stamp.
    scam: {
      font: 'Permanent Marker',
      art: function () {
        return svg(
          '<defs><pattern id="am" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="24" height="24" fill="#fff"/><rect width="6" height="24" fill="#E63946"/><rect x="12" width="6" height="24" fill="#2B6CB0"/></pattern></defs>' +
          '<rect width="270" height="100" fill="url(#am)"/><rect x="7" y="7" width="256" height="86" rx="10" fill="#FFF6E5"/>' +
          '<path d="M7 12 L135 58 L263 12" fill="none" stroke="#E3D3B5" stroke-width="2"/>' +
          '<g transform="translate(224 14)" stroke="' + INK + '" stroke-width="1.5"><rect width="30" height="34" fill="#FFD93D" stroke-dasharray="3 2"/><text x="15" y="24" text-anchor="middle" font-size="18" font-family="Georgia, serif" font-weight="700" fill="' + INK + '" stroke="none">?</text></g>' +
          '<g class="hook"><path d="M30 0 V40" stroke="#555" stroke-width="1.2"/><path d="M30 40 V52 a7 7 0 0 1 -13 3" fill="none" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/><path d="M17 55 l-2 -6" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/></g>'
        );
      },
    },

    // 7. A sky with clouds and a rocket ready to go.
    'token-simulator': {
      font: 'Bungee Shade',
      art: function () {
        var cloud = function (x, y, s) {
          return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="#fff"><circle cx="0" cy="0" r="10"/><circle cx="12" cy="-5" r="12"/><circle cx="26" cy="0" r="9"/><rect x="0" y="0" width="26" height="9"/></g>';
        };
        return svg(
          '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7CC8FF"/><stop offset="1" stop-color="#DDF2FF"/></linearGradient></defs>' +
          '<rect width="270" height="100" fill="url(#sky)"/>' + cloud(150, 92, 1.4) + cloud(10, 90, 1.1) + cloud(230, 24, 0.8) + cloud(60, 14, 0.6) +
          '<g class="rocket" transform="translate(236 46) rotate(30)" stroke="' + INK + '" stroke-width="2"><path class="flame" d="M-5 22 Q0 38 5 22Z" fill="#FFD93D"/><path d="M0 -24 C10 -14 12 4 8 22 H-8 C-12 4 -10 -14 0 -24Z" fill="#fff"/><circle cy="-6" r="5" fill="#4D9DE0"/><path d="M-8 10 L-16 24 L-7 21Z M8 10 L16 24 L7 21Z" fill="#FF6B6B"/></g>'
        );
      },
    },

    // 8. Dark water, a fishing line and a dead coin.
    'dead-projects': {
      font: 'Creepster',
      art: function () {
        return svg(
          '<defs><linearGradient id="dw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16384A"/><stop offset="1" stop-color="#03121B"/></linearGradient></defs>' +
          '<rect width="270" height="100" fill="url(#dw)"/>' +
          range(3, function (i) { return '<path d="M0 ' + (18 + i * 30) + ' q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="#2B5D73" stroke-width="1.5" opacity=".7"/>'; }) +
          '<g class="bubbles" fill="none" stroke="#5FA3BF" stroke-width="1"><circle cx="40" cy="70" r="3"/><circle cx="46" cy="58" r="2"/><circle cx="210" cy="40" r="2.5"/></g>' +
          '<g class="line"><path d="M246 0 V58" stroke="#B9D4DF" stroke-width="1"/><path d="M246 58 V66 a6 6 0 0 1 -11 2" fill="none" stroke="#B9D4DF" stroke-width="2"/>' +
          '<g transform="translate(238 76)" stroke="#0A0A0A" stroke-width="1.5"><circle r="9" fill="#8A8F6A"/><circle cx="-3" cy="-1" r="2" fill="#0A0A0A"/><circle cx="3" cy="-1" r="2" fill="#0A0A0A"/><path d="M-3 4 h6"/></g></g>' +
          '<g transform="translate(18 74)" fill="none" stroke="#C8D8C0" stroke-width="1.5"><path d="M0 8 L8 2 L8 14Z"/><path d="M8 8 H40"/><path d="M14 2 V14 M20 3 V13 M26 4 V12 M32 5 V11"/><circle cx="44" cy="8" r="5"/></g>'
        );
      },
    },

    // 9. A night sky, a big moon and a neon title.
    'ways-to-moon': {
      font: 'Monoton',
      art: function () {
        return svg(
          '<defs><linearGradient id="ns" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1033"/><stop offset="1" stop-color="#2A1A66"/></linearGradient></defs>' +
          '<rect width="270" height="100" fill="url(#ns)"/>' +
          range(22, function (i) { return '<circle class="twinkle" style="--d:' + ((i % 5) * 0.2).toFixed(1) + 's" cx="' + ((i * 61) % 270) + '" cy="' + ((i * 29) % 100) + '" r="' + (i % 4 ? 0.8 : 1.4) + '" fill="#fff"/>'; }) +
          '<path d="M238 8 A30 30 0 1 0 262 56 A24 24 0 1 1 238 8Z" fill="#FFF3B0"/><circle cx="226" cy="40" r="3" fill="#F2DD7A"/><circle cx="236" cy="56" r="2" fill="#F2DD7A"/>' +
          '<g transform="translate(26 74) rotate(-40)"><path d="M0 -10 C4 -6 5 2 3 8 H-3 C-5 2 -4 -6 0 -10Z" fill="#fff"/><path d="M-2 8 Q0 15 2 8Z" fill="#FF9F43"/></g>'
        );
      },
    },

    // Career and entrepreneur toys, each with its own look.
    'first-job': {
      font: 'Caveat Brush',
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#C8925A"/>' +
          range(60, function (i) { return '<circle cx="' + ((i * 47) % 270) + '" cy="' + ((i * 23) % 100) + '" r="1" fill="#A8743F"/>'; }) +
          '<g class="note" transform="translate(12 12) rotate(-6)"><rect width="46" height="40" fill="#FFF47A"/><text x="23" y="17" text-anchor="middle" font-size="9" font-family="Arial Black, sans-serif" font-weight="900" fill="' + INK + '">HIRING</text><path d="M8 26 h30 M8 32 h22" stroke="' + INK + '" stroke-width="1.2"/><circle cx="23" cy="2" r="3.5" fill="#E63946" stroke="' + INK + '" stroke-width="1"/></g>' +
          '<g class="note" transform="translate(212 46) rotate(7)"><rect width="44" height="48" fill="#fff"/><path d="M7 10 h20 M7 18 h30 M7 24 h26 M7 30 h30 M7 36 h18" stroke="#9AA6B8" stroke-width="1.5"/><circle cx="22" cy="2" r="3.5" fill="#4D9DE0" stroke="' + INK + '" stroke-width="1"/></g>'
        );
      },
    },

    'web3-roles': {
      font: 'Righteous',
      art: function () {
        var badge = function (x, y, r, color, label) {
          return '<g class="badge" transform="translate(' + x + ' ' + y + ') rotate(' + r + ')" stroke="' + INK + '" stroke-width="1.5"><rect x="-15" y="-20" width="30" height="40" rx="4" fill="#fff"/><rect x="-15" y="-20" width="30" height="10" rx="4" fill="' + color + '"/><circle cy="2" r="6" fill="' + color + '"/><text y="16" text-anchor="middle" font-size="6" font-family="monospace" font-weight="700" fill="' + INK + '" stroke="none">' + label + '</text></g>';
        };
        return svg(
          '<defs><linearGradient id="rl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2EC4B6"/><stop offset="1" stop-color="#3A86FF"/></linearGradient></defs>' +
          '<rect width="270" height="100" fill="url(#rl)"/>' +
          badge(26, 50, -14, '#FFD93D', 'DEV') + badge(46, 62, 8, '#FF6B6B', 'DESIGN') + badge(226, 46, 10, '#A98BFF', 'GROWTH') + badge(248, 60, -6, '#6BCB77', 'OPS')
        );
      },
    },

    'hall-of-fame': {
      font: 'Cinzel Decorative',
      weight: 700,
      art: function () {
        var laurel = function (x, flip) {
          return '<g transform="translate(' + x + ' 50) scale(' + flip + ' 1)" fill="#E8B923" stroke="#7A5A00" stroke-width="0.8">' +
            range(6, function (i) { return '<ellipse cx="' + (-4 - i * 1.5) + '" cy="' + (-24 + i * 9) + '" rx="3" ry="7" transform="rotate(' + (-40 + i * 12) + ' ' + (-4 - i * 1.5) + ' ' + (-24 + i * 9) + ')"/>'; }) + '</g>';
        };
        return svg(
          '<defs><radialGradient id="spot" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#C8243C"/><stop offset="1" stop-color="#4A0812"/></radialGradient></defs>' +
          '<rect width="270" height="100" fill="url(#spot)"/>' +
          range(14, function (i) { return '<rect x="' + (i * 20) + '" width="8" height="100" fill="#000" opacity=".12"/>'; }) +
          '<rect x="5" y="5" width="260" height="90" rx="10" fill="none" stroke="#E8B923" stroke-width="2"/><rect x="9" y="9" width="252" height="82" rx="8" fill="none" stroke="#E8B923" stroke-width="0.8"/>' +
          laurel(40, 1) + laurel(230, -1) +
          '<g class="sparkle">' + star(70, 22, 4, '#FFE9A8') + star(206, 80, 4, '#FFE9A8') + star(196, 18, 3, '#FFE9A8') + '</g>'
        );
      },
    },

    'raise-first-round': {
      font: 'Rye',
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#D8EBCF"/>' +
          range(9, function (i) { return '<circle cx="135" cy="50" r="' + (14 + i * 14) + '" fill="none" stroke="#B7D6AA" stroke-width="1"/>'; }) +
          '<rect x="6" y="6" width="258" height="88" rx="8" fill="none" stroke="#2F5E3A" stroke-width="2.5"/><rect x="11" y="11" width="248" height="78" rx="6" fill="none" stroke="#2F5E3A" stroke-width="0.8" stroke-dasharray="2 2"/>' +
          '<g class="seal" transform="translate(34 50)"><circle r="17" fill="#2F5E3A"/><circle r="13" fill="none" stroke="#D8EBCF" stroke-width="1" stroke-dasharray="2 1.5"/><text y="7" text-anchor="middle" font-size="20" font-family="Georgia, serif" font-weight="700" fill="#D8EBCF">$</text></g>' +
          '<g font-family="Georgia, serif" font-weight="700" fill="#2F5E3A" font-size="11"><text x="16" y="86">100K</text><text x="222" y="86">100K</text></g>'
        );
      },
    },

    'tokenomics-basics': {
      font: 'Rubik Mono One',
      art: function () {
        return svg(
          '<defs><pattern id="bp" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0 H0 V10" fill="none" stroke="#fff" stroke-width=".4" opacity=".35"/></pattern></defs>' +
          '<rect width="270" height="100" fill="#1E5AA8"/><rect width="270" height="100" fill="url(#bp)"/>' +
          '<g class="pie" transform="translate(234 52)" fill="none" stroke="#fff" stroke-width="1.6"><circle r="22"/><path d="M0 0 V-22 M0 0 L19 11 M0 0 L-15 16"/><path d="M0 -22 A22 22 0 0 1 19 11 L0 0Z" fill="#fff" fill-opacity=".25"/></g>' +
          '<g fill="none" stroke="#fff" stroke-width="1"><path d="M14 80 H70 M14 76 V84 M70 76 V84"/><text x="42" y="92" text-anchor="middle" font-size="7" font-family="monospace" fill="#fff" stroke="none">100%</text><path d="M16 14 l10 0 l0 10" /></g>'
        );
      },
    },

    // Play and Learn toys.
    'invest-100': {
      font: 'VT323',
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#06140C"/>' +
          range(34, function (i) { return '<rect y="' + i * 3 + '" width="270" height="1" fill="#0F2A18"/>'; }) +
          '<path class="chart" d="M6 88 L30 80 L48 84 L70 62 L88 70 L104 44 L120 76 L140 66 L160 30 L176 72 L196 56 L214 60 L234 22 L250 40 L264 14" fill="none" stroke="#39FF88" stroke-width="2" opacity=".32"/>' +
          '<text x="10" y="16" font-size="10" font-family="monospace" fill="#39FF88" opacity=".8">$100 → ?</text><text x="208" y="94" font-size="8" font-family="monospace" fill="#FF5C5C" opacity=".85">-80% ▼</text>'
        );
      },
    },

    'token-split': {
      font: 'Lilita One',
      art: function () {
        var slice = function (x, y, r) {
          return '<g class="slice" transform="translate(' + x + ' ' + y + ') rotate(' + r + ')" stroke="' + INK + '" stroke-width="1.6"><path d="M0 24 L-16 -10 Q0 -16 16 -10Z" fill="#FFD93D"/><path d="M-16 -10 Q0 -16 16 -10 L15 -14 Q0 -20 -15 -14Z" fill="#E8A050"/><circle cx="0" cy="-2" r="3" fill="#E63946"/><circle cx="-5" cy="8" r="2.4" fill="#E63946"/></g>';
        };
        return svg(
          '<defs><pattern id="gh" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#fff"/><rect width="10" height="20" fill="#E63946" opacity=".55"/><rect width="20" height="10" fill="#E63946" opacity=".55"/></pattern></defs>' +
          '<rect width="270" height="100" fill="url(#gh)"/>' + slice(30, 50, -20) + slice(240, 50, 20)
        );
      },
    },
  };

  // Loads one Google Font with only the letters it needs.
  var loaded = {};
  function loadFont(design, text) {
    var key = design.font + '|' + text;
    if (loaded[key]) return;
    loaded[key] = true;
    var chars = {};
    (text + (design.extra || '')).replace(/\s/g, '').split('').forEach(function (ch) {
      chars[ch] = true;
      chars[ch.toUpperCase()] = true;
      chars[ch.toLowerCase()] = true;
    });
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + design.font.replace(/ /g, '+') + (design.weight ? ':wght@' + design.weight : '') +
      '&text=' + encodeURIComponent(Object.keys(chars).sort().join('')) + '&display=swap';
    document.head.appendChild(link);
  }

  // The inside of a card: its drawing and its title.
  function card(id, title, esc) {
    var d = DESIGNS[id];
    if (!d) return null;
    loadFont(d, title);
    return d.art() + '<span class="xtitle" style="font-family:\'' + d.font + '\', var(--font-display)">' + (d.title ? d.title(esc(title)) : esc(title)) + '</span>';
  }

  window.Web3Cards = { card: card, ids: Object.keys(DESIGNS) };
})();
