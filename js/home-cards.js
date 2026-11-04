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
    // A sunny side-hustle desk: a phone video, a pencil, an airdrop on a
    // parachute and a piggy bank with a coin dropping in.
    'earn-small': {
      font: 'Sniglet',
      weight: 800,
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#FFE27A"/>' +
          '<g fill="#FFF1B8">' + range(9, function (i) { var a = -80 + i * 20; return '<path d="M135 120 L' + (135 + 260 * Math.sin(a * Math.PI / 180)).toFixed(1) + ' ' + (120 - 260 * Math.cos(a * Math.PI / 180)).toFixed(1) + ' L' + (135 + 260 * Math.sin((a + 8) * Math.PI / 180)).toFixed(1) + ' ' + (120 - 260 * Math.cos((a + 8) * Math.PI / 180)).toFixed(1) + 'Z"/>'; }) + '</g>' +
          // Phone with a video, and a pencil.
          '<g transform="translate(26 50) rotate(-10)" stroke="' + INK + '" stroke-width="1.6"><rect x="-13" y="-23" width="26" height="46" rx="5" fill="' + INK + '"/><rect x="-10" y="-18" width="20" height="34" rx="2" fill="#fff"/><path d="M-3 -6 L5 0 L-3 6Z" fill="#FF6B6B" stroke-width="1"/></g>' +
          '<g transform="translate(58 72) rotate(35)" stroke="' + INK + '" stroke-width="1.4"><rect x="-4" y="-18" width="8" height="30" fill="#FFD93D"/><rect x="-4" y="-22" width="8" height="5" fill="#FF9EC4"/><path d="M-4 12 L0 20 L4 12Z" fill="#F5D7A8"/></g>' +
          // Airdrop crate on a parachute.
          '<g class="chute" transform="translate(196 6)" stroke="' + INK + '" stroke-width="1.3"><path d="M-16 14 a16 13 0 0 1 32 0z" fill="#4D96FF"/><path d="M-5.3 14 a5.3 13 0 0 1 10.6 0" fill="#fff"/><path d="M-16 14 L-5 30 M16 14 L5 30 M0 14 V30" fill="none"/><rect x="-6" y="30" width="12" height="10" fill="#C98B4B"/><path d="M-6 35 h12" /></g>' +
          // Piggy bank and a coin dropping in.
          '<g class="drop"><ellipse cx="232" cy="38" rx="7" ry="7" fill="#FFD93D" stroke="' + INK + '" stroke-width="1.5"/><text x="232" y="41" text-anchor="middle" font-size="8" font-weight="900" fill="' + INK + '" font-family="Arial, sans-serif">₿</text></g>' +
          '<g stroke="' + INK + '" stroke-width="1.6"><rect x="216" y="78" width="6" height="12" rx="2" fill="#FF9EC4"/><rect x="240" y="78" width="6" height="12" rx="2" fill="#FF9EC4"/>' +
          '<ellipse cx="232" cy="68" rx="24" ry="17" fill="#FF9EC4"/><path d="M220 53 l3 -9 l6 7z" fill="#FF7AB6"/><ellipse cx="256" cy="67" rx="5" ry="6" fill="#FF7AB6"/>' +
          '<path d="M226 52 h12" stroke-width="2.4"/><circle cx="244" cy="62" r="1.6" fill="' + INK + '"/><path d="M208 66 q-6 -4 -4 -9" fill="none"/></g>' +
          star(96, 18, 4, '#fff') + star(176, 90, 4, '#fff') + star(14, 12, 3, '#fff')
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
    // Under the sea in daylight: a seabed of token gravestones, swaying
    // weed, and a hook pulling up a dead coin.
    'dead-projects': {
      font: 'Rubik Wet Paint',
      art: function () {
        var grave = function (x, h, label) {
          return '<g transform="translate(' + x + ' ' + (88 - h) + ')" stroke="' + INK + '" stroke-width="1.4"><path d="M0 ' + h + ' V10 a11 10 0 0 1 22 0 V' + h + 'z" fill="#B8C4C2"/>' +
            '<text x="11" y="17" text-anchor="middle" font-size="6.5" font-weight="900" font-family="Arial, sans-serif" fill="' + INK + '" stroke="none">RIP</text>' +
            '<text x="11" y="27" text-anchor="middle" font-size="6" font-family="monospace" fill="' + INK + '" stroke="none">' + label + '</text></g>';
        };
        var weed = function (x, h, d) {
          return '<path class="weed" style="--d:' + d + 's" d="M' + x + ' 92 q-6 -' + (h / 3) + ' 0 -' + (h / 2) + ' t0 -' + (h / 2) + '" fill="none" stroke="#2FA36B" stroke-width="3.5" stroke-linecap="round"/>';
        };
        return svg(
          '<defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8EE3EF"/><stop offset="1" stop-color="#1E7F9C"/></linearGradient></defs>' +
          '<rect width="270" height="100" fill="url(#sea)"/>' +
          '<g fill="#fff" opacity=".18"><path d="M60 0 h18 l-30 100 h-14z"/><path d="M150 0 h12 l-18 100 h-10z"/></g>' +
          '<path d="M0 6 q11 -5 22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 V0 H0z" fill="#C8F4FA"/>' +
          '<path d="M0 92 q40 -8 80 -2 t90 0 t100 -2 V100 H0z" fill="#F2D49B" stroke="' + INK + '" stroke-width="1.2"/>' +
          weed(62, 30, 0) + weed(70, 22, 0.2) + weed(190, 28, 0.35) + weed(262, 24, 0.1) +
          grave(6, 30, '$RUG') + grave(32, 28, '$LUNA') + grave(204, 26, '$DEAD') +
          '<g class="bubbles" fill="none" stroke="#fff" stroke-width="1.2"><circle cx="70" cy="50" r="3"/><circle cx="76" cy="40" r="2"/><circle cx="206" cy="44" r="2.5"/></g>' +
          '<g class="line"><path d="M248 0 V52" stroke="' + INK + '" stroke-width="1"/><path d="M248 52 V60 a6 6 0 0 1 -11 2" fill="none" stroke="#5A5470" stroke-width="2"/>' +
          '<g transform="translate(240 72)" stroke="' + INK + '" stroke-width="1.5"><circle r="10" fill="#9AA36B"/><path d="M-5 -3 l3 3 M-2 -3 l-3 3 M2 -3 l3 3 M5 -3 l-3 3" stroke-width="1.2"/><path d="M-4 5 q4 -3 8 0" fill="none" stroke-width="1.2"/></g></g>'
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

    // A gallery wall of pencil-sketch portraits in little frames, with gold
    // stars, like the drawings in the game.
    'hall-of-fame': {
      font: 'Kalam',
      weight: 700,
      art: function () {
        var frame = function (x, y, r, color, hair) {
          return '<g class="frame" transform="translate(' + x + ' ' + y + ') rotate(' + r + ')">' +
            '<rect x="-17" y="-21" width="34" height="42" rx="2" fill="#fff" stroke="' + INK + '" stroke-width="1.6"/>' +
            '<rect x="-13" y="-17" width="26" height="30" fill="' + color + '" opacity=".35"/>' +
            '<g stroke="' + color + '" stroke-width="1.1" opacity=".9">' + range(6, function (i) { return '<path d="M' + (-13 + i * 5) + ' 13 l8 -30"/>'; }) + '</g>' +
            '<circle cx="0" cy="-3" r="7.5" fill="#FFE3C8" stroke="' + INK + '" stroke-width="1.3"/>' +
            '<path d="' + hair + '" fill="' + INK + '"/>' +
            '<path d="M-11 13 q11 -12 22 0" fill="' + color + '" stroke="' + INK + '" stroke-width="1.3"/>' +
            '<circle cx="-2.6" cy="-3" r=".9" fill="' + INK + '"/><circle cx="2.6" cy="-3" r=".9" fill="' + INK + '"/>' +
            '<path d="M-2.5 1 q2.5 2 5 0" fill="none" stroke="' + INK + '" stroke-width=".9"/></g>';
        };
        var short = 'M-7.5 -4 q0 -8 7.5 -8 q7.5 0 7.5 8 q-3 -4 -7.5 -4 q-4.5 0 -7.5 4z';
        var long = 'M-8 4 q-2 -16 8 -16 q10 0 8 16 q-1 -9 -8 -11 q-7 2 -8 11z';
        var cap = 'M-8.5 -5 q0 -8 8.5 -8 q8.5 0 8.5 8z M8 -5 h5';
        return svg(
          '<rect width="270" height="100" fill="#FFF8E1"/>' +
          '<g stroke="#E8B923" stroke-width="1" opacity=".35">' + range(30, function (i) { return '<path d="M' + (i * 10 - 30) + ' 100 l40 -100"/>'; }) + '</g>' +
          '<path d="M0 8 h270 M0 92 h270" stroke="' + INK + '" stroke-width="1.5" stroke-dasharray="6 4" opacity=".5"/>' +
          frame(26, 32, -8, '#4D96FF', short) + frame(58, 70, 6, '#FF7AB6', long) + frame(20, 76, 4, '#6BCB77', cap) +
          frame(244, 30, 7, '#FFD93D', cap) + frame(214, 70, -6, '#9B5DE5', short) + frame(252, 76, -3, '#FF9F45', long) +
          '<g class="sparkle">' + star(92, 16, 5, '#E8B923') + star(180, 88, 5, '#E8B923') + star(196, 14, 4, '#E8B923') + star(78, 92, 3.5, '#E8B923') + '</g>'
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

    // Tools
    'tool-tokenomics': {
      font: 'Archivo Black',
      art: function () {
        var slices = [['#FF6B6B', 0, 70], ['#A98BFF', 70, 130], ['#6BCB77', 130, 250], ['#4D9DE0', 250, 310], ['#FFD93D', 310, 360]];
        var arc = function (c, a0, a1) {
          var r = 26;
          var p = function (a) { return [(232 + r * Math.cos((a - 90) * Math.PI / 180)).toFixed(1), (50 + r * Math.sin((a - 90) * Math.PI / 180)).toFixed(1)]; };
          var s = p(a0);
          var e = p(a1);
          return '<path d="M232 50 L' + s[0] + ' ' + s[1] + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + e[0] + ' ' + e[1] + 'Z" fill="' + c + '"/>';
        };
        return svg(
          '<defs><pattern id="gp" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0 H0 V10" fill="none" stroke="#9CCBF0" stroke-width=".6"/></pattern></defs>' +
          '<rect width="270" height="100" fill="#FFFFFF"/><rect width="270" height="100" fill="url(#gp)"/>' +
          '<g class="tk-pie-card" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round">' + slices.map(function (x) { return arc(x[0], x[1], x[2]); }).join('') + '</g>' +
          '<g stroke="' + INK + '" stroke-width="1.6"><rect x="10" y="62" width="12" height="28" fill="#FF6B6B"/><rect x="24" y="50" width="12" height="40" fill="#A98BFF"/><rect x="38" y="70" width="12" height="20" fill="#6BCB77"/></g>' +
          '<path d="M8 90 H58" stroke="' + INK + '" stroke-width="2"/>'
        );
      },
    },
    'tool-mcap-fdv': {
      font: 'Titan One',
      title: function () { return 'Market Cap<br>&amp; FDV'; },
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#DFF3FF"/>' +
          '<rect y="52" width="270" height="48" fill="#4D9DE0"/>' +
          '<g class="mc-berg-card"><path d="M230 18 L242 30 L250 44 L258 62 L248 92 L200 92 L194 64 L206 40 L218 28Z" fill="#fff" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
          '<rect x="190" y="52" width="72" height="44" fill="#1D6FD6" opacity=".45"/></g>' +
          '<path d="M0 52 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="' + INK + '" stroke-width="2"/>' +
          '<g fill="#fff" opacity=".7"><circle cx="30" cy="20" r="8"/><circle cx="44" cy="18" r="10"/><circle cx="58" cy="22" r="7"/></g>'
        );
      },
    },
    academy: {
      font: 'Fredericka the Great',
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#8B5A2B"/><rect x="6" y="6" width="258" height="88" rx="4" fill="#2F4F3A"/>' +
          '<g fill="none" stroke="#E8F0E0" stroke-width="1" opacity=".25"><path d="M20 30 q30 -8 60 0"/><path d="M180 78 q30 6 60 0"/></g>' +
          '<g class="ac-cap" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"><path d="M226 30 L256 42 L226 54 L196 42Z" fill="#1F1B2E"/>' +
          '<path d="M208 47 V60 C214 66 238 66 244 60 V47" fill="#1F1B2E"/><path d="M256 42 V60" stroke="#FFC94D" stroke-width="2.5"/><circle cx="256" cy="62" r="3" fill="#FFC94D"/></g>' +
          star(30, 22, 4, '#FFD93D') + star(44, 76, 3, '#E8F0E0') + '<path d="M14 88 h22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'
        );
      },
    },
    'tool-launch-budget': {
      font: 'Bowlby One',
      title: function () { return 'Launch<br>Budget'; },
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#FF9F43"/>' +
          range(8, function (i) { return '<rect x="' + (i * 36 - 6) + '" y="0" width="14" height="100" fill="#FFB466" transform="skewX(-20)"/>'; }) +
          '<g class="bd-rocket" transform="translate(228 50) rotate(35)" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round">' +
          '<path class="bd-flame" d="M-6 24 Q0 44 6 24Z" fill="#FFD93D"/><path d="M0 -30 C12 -18 14 4 10 24 H-10 C-14 4 -12 -18 0 -30Z" fill="#fff"/>' +
          '<circle cy="-8" r="6" fill="#4D9DE0"/><path d="M-10 12 L-18 28 L-9 25Z M10 12 L18 28 L9 25Z" fill="#FF6B6B"/></g>' +
          '<g stroke="' + INK + '" stroke-width="2"><rect x="14" y="22" width="16" height="60" rx="3" fill="#fff"/><rect x="16" y="54" width="12" height="26" fill="#6BCB77" stroke="none"/><rect x="16" y="40" width="12" height="14" fill="#FFD93D" stroke="none"/><rect x="16" y="26" width="12" height="14" fill="#FF6B6B" stroke="none"/></g>'
        );
      },
    },
    'tool-pitch-deck': {
      font: 'Abril Fatface',
      title: function () { return 'Pitch Deck<br>Builder'; },
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#FBF6EC"/>' +
          '<g stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">' +
          '<path d="M206 86 L222 52 M250 86 L234 52 M228 52 V92" fill="none"/>' +
          '<g class="pd-slides"><rect x="190" y="14" width="76" height="44" rx="3" fill="#FF6B6B"/><rect x="184" y="10" width="76" height="44" rx="3" fill="#4D9DE0"/>' +
          '<rect x="178" y="6" width="76" height="44" rx="3" fill="#fff"/><path d="M186 18 H230 M186 28 H220 M186 36 H226" stroke-width="3"/>' +
          '<path d="M232 42 L240 30 L248 38" fill="none" stroke="#6BCB77" stroke-width="3"/></g></g>' +
          '<path d="M10 92 H120" stroke="#C0392B" stroke-width="3"/>'
        );
      },
    },
    'tool-cap-table': {
      font: 'Bebas Neue',
      title: function () { return 'Cap Table<br>&amp; Dilution'; },
      art: function () {
        var bar = function (y, parts) {
          var x = 176;
          return parts.map(function (p) { var s = '<rect x="' + x + '" y="' + y + '" width="' + p[0] + '" height="14" fill="' + p[1] + '" stroke="' + INK + '" stroke-width="1.8"/>'; x += p[0]; return s; }).join('');
        };
        return svg(
          '<rect width="270" height="100" fill="#F4F1FF"/>' +
          '<g class="cap-bars">' + bar(16, [[84, '#FF6B6B']]) + bar(40, [[60, '#FF6B6B'], [24, '#4D9DE0']]) + bar(64, [[48, '#FF6B6B'], [20, '#4D9DE0'], [16, '#6BCB77']]) + '</g>' +
          '<g fill="#A98BFF" opacity=".5"><circle cx="20" cy="18" r="6"/><circle cx="36" cy="84" r="4"/></g>'
        );
      },
    },
    'tool-agreements': {
      font: 'Playfair Display',
      title: function () { return 'SAFT &amp;<br>Agreements'; },
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#FFF4D6"/>' +
          '<g class="ag-paper" transform="rotate(6 222 52)"><rect x="190" y="20" width="62" height="68" rx="4" fill="#FFFFFF" stroke="' + INK + '" stroke-width="2.5"/>' +
          '<g stroke="' + INK + '" stroke-width="2" stroke-linecap="round"><path d="M200 28h44M200 38h44M200 48h30M200 58h40"/></g>' +
          '<path d="M202 80c6-8 10 4 16-3s8 3 14-2" fill="none" stroke="#4D9DE0" stroke-width="2.5" stroke-linecap="round"/></g>' +
          '<g class="ag-pen"><path d="M168 86 L186 60 L192 64 L174 90 Z" fill="#FF6B6B" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/><path d="M168 86 L166 94 L174 90" fill="' + INK + '"/></g>'
        );
      },
    },
    'tool-meme-kit': {
      font: 'Luckiest Guy',
      title: function () { return 'Meme Coin<br>Launch Kit'; },
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#E8FFE1"/>' +
          '<g class="mk-coin"><circle cx="218" cy="52" r="34" fill="#FFD23F" stroke="' + INK + '" stroke-width="3"/><circle cx="218" cy="52" r="25" fill="none" stroke="' + INK + '" stroke-width="2" stroke-dasharray="4 4"/>' +
          '<text x="218" y="64" text-anchor="middle" font-size="32">🐸</text></g>' +
          star(176, 20, 7, '#6BCB77') + star(256, 88, 6, '#6BCB77') + star(160, 82, 4, '#FFD23F')
        );
      },
    },
    'tool-kol-scorecard': {
      font: 'Rubik Mono One',
      title: function () { return 'KOL<br>Score&shy;card'; },
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#FFEFE6"/>' +
          '<g class="kol-mag"><circle cx="214" cy="46" r="28" fill="#FFFFFF" stroke="' + INK + '" stroke-width="4"/>' +
          '<path d="M234 66 L254 88" stroke="' + INK + '" stroke-width="8" stroke-linecap="round"/>' +
          '<path d="M200 48 l9 9 l17 -20" fill="none" stroke="#6BCB77" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>' +
          '<path d="M168 18 v20 M168 18 h14 l-3 5 l3 5 h-14" fill="#FF6B6B" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>'
        );
      },
    },
    'tool-airdrop-planner': {
      font: 'Chewy',
      title: function () { return 'Airdrop<br>Planner'; },
      art: function () {
        var chute = function (x, y, c) {
          return '<path d="M' + (x - 18) + ' ' + y + ' a18 14 0 0 1 36 0 z" fill="' + c + '" stroke="' + INK + '" stroke-width="2.5"/>' +
            '<path d="M' + (x - 17) + ' ' + y + ' L' + x + ' ' + (y + 22) + ' L' + (x + 17) + ' ' + y + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>' +
            '<circle cx="' + x + '" cy="' + (y + 28) + '" r="7" fill="#FFD23F" stroke="' + INK + '" stroke-width="2.5"/>';
        };
        return svg(
          '<rect width="270" height="100" fill="#E6F4FF"/>' +
          '<g class="ad-chute">' + chute(210, 22, '#FF6B6B') + '</g><g class="ad-chute ad-chute--2">' + chute(244, 48, '#A98BFF') + '</g>' +
          '<path d="M150 92 h120" stroke="' + INK + '" stroke-width="3"/>'
        );
      },
    },
    'tool-links-checker': {
      font: 'Space Mono',
      title: function () { return 'Official<br>Links<br>Checker'; },
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#F0FFF4"/>' +
          '<g class="lk-chain" fill="none" stroke="' + INK + '" stroke-width="7" stroke-linecap="round">' +
          '<rect x="168" y="36" width="44" height="26" rx="13"/><rect x="200" y="36" width="44" height="26" rx="13" stroke="#6BCB77"/>' +
          '<rect x="200" y="36" width="44" height="26" rx="13" fill="none" stroke="' + INK + '" stroke-width="2.5"/></g>' +
          '<circle cx="246" cy="22" r="14" fill="#6BCB77" stroke="' + INK + '" stroke-width="2.5"/><path d="M239 22 l5 5 l9 -10" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'
        );
      },
    },
    'tool-gas-converter': {
      font: 'Righteous',
      title: function () { return 'Gas &amp; Unit<br>Converter'; },
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#FFF0F6"/>' +
          '<g class="gas-pump"><rect x="182" y="22" width="40" height="64" rx="6" fill="#FF6B6B" stroke="' + INK + '" stroke-width="3"/>' +
          '<rect x="190" y="30" width="24" height="16" rx="3" fill="#FFFFFF" stroke="' + INK + '" stroke-width="2.5"/>' +
          '<path d="M222 40 h12 v30 a6 6 0 0 0 12 0 v-34 l-8 -8" fill="none" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<rect x="176" y="84" width="52" height="8" rx="3" fill="' + INK + '"/></g>'
        );
      },
    },
    'tool-launch-checklist': {
      font: 'Black Ops One',
      title: function () { return 'Launch<br>Readiness'; },
      art: function () {
        return svg(
          '<rect width="270" height="100" fill="#EEF0FF"/>' +
          '<g class="lc-rocket"><path d="M222 14 c14 10 18 30 12 50 h-24 c-6 -20 -2 -40 12 -50z" fill="#FFFFFF" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
          '<circle cx="222" cy="36" r="6" fill="#4D9DE0" stroke="' + INK + '" stroke-width="2.5"/>' +
          '<path d="M210 54 l-10 12 h10 M234 54 l10 12 h-10" fill="#FF6B6B" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
          '<path d="M214 66 q8 20 16 0" fill="#FFD23F" stroke="' + INK + '" stroke-width="2.5"/></g>' +
          star(186, 24, 6, '#FFD23F') + star(254, 80, 5, '#A98BFF') + star(194, 84, 4, '#6BCB77')
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
    // Titles with drawn letters or extra words (like the key ring O) carry the
    // plain toy name for screen readers.
    var label = d.title ? ' role="img" aria-label="' + esc(title) + '"' : '';
    return d.art() + '<span class="xtitle"' + label + ' style="font-family:\'' + d.font + '\', var(--font-display)">' + (d.title ? d.title(esc(title)) : esc(title)) + '</span>';
  }

  window.Web3Cards = { card: card, ids: Object.keys(DESIGNS) };
})();
