// Placeholder covers for the home page cards: the toy's own colour and one
// big cartoon object. A real picture in images/covers/<toy_id>.png replaces
// it automatically. Web3Covers.svg('rocket', '#FF9F43') returns the drawing.

(function () {
  var INK = '#1F1B2E';

  // Each object is drawn in a 200 by 200 box, centred near the middle.
  var OBJECTS = {
    cube:
      '<path d="M100 44 L152 70 L100 96 L48 70Z" fill="#FFE98A"/>' +
      '<path d="M48 70 L100 96 V158 L48 132Z" fill="#FFD93D"/>' +
      '<path d="M152 70 L100 96 V158 L152 132Z" fill="#E8B800"/>',
    key:
      '<g transform="rotate(-32 100 100)"><circle cx="64" cy="100" r="32" fill="#FFD93D"/><circle cx="64" cy="100" r="11" fill="#fff"/>' +
      '<path d="M96 91 H170 V109 H96Z M142 109 V128 H154 V109 M160 109 V122 H170 V109" fill="#FFD93D"/></g>',
    skull:
      '<path d="M100 38 C60 38 44 68 47 98 C49 117 58 126 66 131 V156 H134 V131 C142 126 151 117 153 98 C156 68 140 38 100 38Z" fill="#fff"/>' +
      '<ellipse cx="78" cy="98" rx="14" ry="16" fill="' + INK + '"/><ellipse cx="122" cy="98" rx="14" ry="16" fill="' + INK + '"/>' +
      '<path d="M100 114 L92 128 H108Z" fill="' + INK + '"/><path d="M86 140 V156 M100 140 V156 M114 140 V156" fill="none"/>',
    coins:
      [146, 126, 106, 86].map(function (y) {
        return '<path d="M54 ' + y + ' v12 a46 14 0 0 0 92 0 v-12Z" fill="#E8B800"/><ellipse cx="100" cy="' + y + '" rx="46" ry="14" fill="#FFD93D"/>';
      }).join('') + '<ellipse cx="100" cy="86" rx="26" ry="7" fill="none" stroke-width="4"/>',
    magnifier:
      '<path d="M122 122 L162 162" stroke-width="22"/><path d="M122 122 L162 162" stroke="#FF6B6B" stroke-width="10"/>' +
      '<circle cx="88" cy="88" r="44" fill="#BFE0FA" stroke-width="9"/><path d="M64 74 C70 62 82 56 92 58" fill="none" stroke="#fff" stroke-width="7"/>',
    lock:
      '<path d="M70 96 V72 C70 52 84 40 100 40 C112 40 122 46 127 56" fill="none" stroke-width="12"/>' +
      '<path d="M140 70 L134 84" fill="none" stroke-width="12"/>' +
      '<rect x="52" y="94" width="96" height="72" rx="14" fill="#FFD93D"/><path d="M100 94 L90 116 L106 130 L95 166" fill="none" stroke-width="5"/>',
    briefcase:
      '<path d="M80 72 V60 A8 8 0 0 1 88 52 H112 A8 8 0 0 1 120 60 V72" fill="none"/>' +
      '<rect x="36" y="72" width="128" height="86" rx="14" fill="#FF6B6B"/><path d="M36 106 H164" fill="none"/>' +
      '<rect x="90" y="98" width="20" height="18" rx="4" fill="#FFD93D"/>',
    badge:
      '<path d="M78 20 L100 54 L122 20" fill="none" stroke="#4D9DE0" stroke-width="10"/>' +
      '<rect x="58" y="56" width="84" height="112" rx="14" fill="#fff"/><rect x="86" y="48" width="28" height="16" rx="5" fill="#B8C4D6"/>' +
      '<circle cx="100" cy="100" r="20" fill="#FFD93D"/><path d="M76 138 H124 M84 152 H116" fill="none" stroke-width="5"/>',
    trophy:
      '<path d="M66 64 H48 C48 92 58 100 70 100 M134 64 H152 C152 92 142 100 130 100" fill="none" stroke-width="7"/>' +
      '<path d="M64 46 H136 V84 C136 110 120 126 100 126 C80 126 64 110 64 84Z" fill="#FFD93D"/>' +
      '<rect x="91" y="126" width="18" height="18" fill="#E8B800"/><rect x="66" y="144" width="68" height="18" rx="5" fill="#FF6B6B"/>' +
      '<path d="M100 64 L106 77 L120 78 L109 87 L113 101 L100 93 L87 101 L91 87 L80 78 L94 77Z" fill="#fff" stroke-width="3.5"/>',
    moneybag:
      '<path d="M78 68 L66 44 L88 54 L100 38 L112 54 L134 44 L122 68" fill="#E8C27A"/>' +
      '<path d="M78 68 C44 94 42 162 100 162 C158 162 156 94 122 68Z" fill="#E8C27A"/><path d="M76 68 H124" fill="none" stroke-width="8"/>' +
      '<text x="100" y="138" text-anchor="middle" font-family="\'Luckiest Guy\', sans-serif" font-size="52" fill="' + INK + '" stroke="none">$</text>',
    pie:
      '<circle cx="100" cy="102" r="58" fill="#fff"/>' +
      '<path d="M100 102 L100 44 A58 58 0 0 1 155 120Z" fill="#FF6B6B"/><path d="M100 102 L155 120 A58 58 0 0 1 68 150Z" fill="#4D9DE0"/>',
    moon:
      '<path d="M118 36 A66 66 0 1 0 166 128 A54 54 0 1 1 118 36Z" fill="#FFE98A"/>' +
      '<circle cx="78" cy="112" r="9" fill="#FFD93D" stroke-width="4"/><circle cx="96" cy="146" r="6" fill="#FFD93D" stroke-width="4"/><circle cx="62" cy="82" r="5" fill="#FFD93D" stroke-width="4"/>',
    button:
      '<rect x="40" y="118" width="120" height="40" rx="10" fill="#B8C4D6"/>' +
      '<path d="M58 120 V100 A42 18 0 0 1 142 100 V120" fill="#FF6B6B"/><ellipse cx="100" cy="100" rx="42" ry="18" fill="#FF9B9B"/>',
    pizza:
      '<path d="M100 166 L48 60 Q100 40 152 60Z" fill="#FFD93D"/>' +
      '<path d="M48 60 Q100 40 152 60 L146 46 Q100 26 54 46Z" fill="#E8A050"/>' +
      '<circle cx="100" cy="80" r="10" fill="#FF6B6B" stroke-width="4"/><circle cx="84" cy="108" r="8" fill="#FF6B6B" stroke-width="4"/><circle cx="108" cy="128" r="7" fill="#FF6B6B" stroke-width="4"/>',
    rod:
      '<path d="M44 168 L150 40" stroke-width="16"/><path d="M44 168 L150 40" stroke="#B9814F" stroke-width="7"/>' +
      '<circle cx="72" cy="134" r="13" fill="#FFD93D"/>' +
      '<path d="M150 40 Q170 90 152 128" fill="none" stroke-width="3"/>' +
      '<path d="M152 126 V142 A10 10 0 0 1 134 146" fill="none" stroke-width="5"/>',
    rocket:
      '<path d="M100 28 C132 54 140 96 128 136 H72 C60 96 68 54 100 28Z" fill="#fff"/>' +
      '<circle cx="100" cy="80" r="15" fill="#4D9DE0"/>' +
      '<path d="M72 108 L48 146 L74 140Z M128 108 L152 146 L126 140Z" fill="#FF6B6B"/>' +
      '<path d="M84 136 Q100 178 116 136Z" fill="#FFD93D"/>',
  };

  function svg(object, color) {
    var art = OBJECTS[object] || OBJECTS.coins;
    return '<svg class="tile-art" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
      '<rect width="200" height="200" fill="' + color + '"/>' +
      '<g fill="#fff" opacity=".28"><circle cx="30" cy="34" r="20"/><circle cx="176" cy="150" r="26"/><circle cx="168" cy="30" r="9"/></g>' +
      '<g fill="#fff" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"><path d="M30 92 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z"/><path d="M160 66 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/></g>' +
      '<ellipse cx="100" cy="152" rx="50" ry="9" fill="' + INK + '" opacity=".18"/>' +
      '<g transform="translate(100 86) scale(.74) translate(-100 -100)" stroke="' + INK + '" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">' + art + '</g></svg>';
  }

  window.Web3Covers = { svg: svg, objects: Object.keys(OBJECTS) };
})();
