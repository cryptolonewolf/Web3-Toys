// Random cartoon profile pictures and fun display names, pump.fun style.
// The same seed always gives the same picture and name, so only the seed
// is saved. Works in the browser (window.Web3Avatar) and in Node tests.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Web3Avatar = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var INK = '#1F1B2E';
  var BG = ['#FFD93D', '#4D9DE0', '#FF6B6B', '#6BCB77', '#A98BFF', '#FF9F45', '#7FE3D4', '#FFB3D1', '#C9F06B', '#FFF1A8'];
  var BODY = ['#FF6B6B', '#6BCB77', '#4D9DE0', '#A98BFF', '#FFD93D', '#FF9F45', '#F7F7F7', '#8E7DFF', '#3DC8B4', '#FF8FB8', '#B7E36A', '#C68B59'];

  var ADJ = ['Sleepy', 'Lucky', 'Based', 'Turbo', 'Sneaky', 'Jolly', 'Cosmic', 'Crispy', 'Fluffy', 'Spicy', 'Chill', 'Wobbly', 'Shiny', 'Brave',
    'Giga', 'Tiny', 'Zippy', 'Cheeky', 'Fancy', 'Bouncy', 'Mighty', 'Snazzy', 'Dizzy', 'Frosty', 'Sunny', 'Witty', 'Jumbo', 'Pixel', 'Laser',
    'Diamond', 'Golden', 'Rainbow', 'Hyper', 'Mellow', 'Rowdy', 'Sassy', 'Comfy', 'Zesty', 'Plucky', 'Nimble'];
  var NOUN = ['Frog', 'Penguin', 'Hamster', 'Whale', 'Doge', 'Kitty', 'Panda', 'Otter', 'Llama', 'Goblin', 'Pickle', 'Taco', 'Noodle', 'Muffin',
    'Rocket', 'Pepper', 'Walrus', 'Sloth', 'Bean', 'Yeti', 'Koala', 'Dino', 'Nugget', 'Bagel', 'Gecko', 'Moose', 'Toad', 'Wizard', 'Robot',
    'Alien', 'Donut', 'Mango', 'Crab', 'Duck', 'Beaver', 'Hippo', 'Owl', 'Shiba', 'Lobster', 'Ape'];

  function hash(s) {
    var h = 2166136261;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function rng(seed) {
    var a = hash(seed) || 1;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(r, list) {
    return list[Math.floor(r() * list.length)];
  }

  // A fresh random seed (crypto when available).
  function newSeed() {
    var a = new Uint32Array(2);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
    else { a[0] = Math.random() * 4294967296; a[1] = Date.now(); }
    return a[0].toString(36) + a[1].toString(36);
  }

  // "SleepyFrog42": two words and a number from 10 to 99.
  function name(seed) {
    var r = rng('name:' + seed);
    return pick(r, ADJ) + pick(r, NOUN) + (10 + Math.floor(r() * 90));
  }

  // ---------- Drawing parts (a 128 by 128 picture) ----------

  function bodyShape(kind, fill) {
    var s = ' fill="' + fill + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"';
    if (kind === 'ears') return '<path d="M30 52 L30 22 L52 40 Z M98 52 L98 22 L76 40 Z"' + s + '/><rect x="24" y="36" width="80" height="78" rx="36"' + s + '/>';
    if (kind === 'frog') return '<circle cx="42" cy="40" r="15"' + s + '/><circle cx="86" cy="40" r="15"' + s + '/><ellipse cx="64" cy="78" rx="42" ry="36"' + s + '/>';
    if (kind === 'ghost') return '<path d="M24 112 V64 a40 40 0 0 1 80 0 V112 l-10 -8 l-10 8 l-10 -8 l-10 8 l-10 -8 l-10 8 l-10 -8 Z"' + s + '/>';
    if (kind === 'bear') return '<circle cx="34" cy="38" r="13"' + s + '/><circle cx="94" cy="38" r="13"' + s + '/><circle cx="64" cy="74" r="42"' + s + '/>';
    if (kind === 'square') return '<rect x="22" y="30" width="84" height="84" rx="22"' + s + '/>';
    return '<ellipse cx="64" cy="74" rx="44" ry="42"' + s + '/>';
  }

  function eyes(kind, y) {
    var L = 50, R = 78;
    if (kind === 'big') return [L, R].map(function (x) { return '<circle cx="' + x + '" cy="' + y + '" r="10" fill="#fff" stroke="' + INK + '" stroke-width="3"/><circle cx="' + (x + 2) + '" cy="' + (y + 1) + '" r="5" fill="' + INK + '"/><circle cx="' + (x + 4) + '" cy="' + (y - 2) + '" r="1.8" fill="#fff"/>'; }).join('');
    if (kind === 'sleepy') return [L, R].map(function (x) { return '<path d="M' + (x - 8) + ' ' + y + ' q8 7 16 0" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>'; }).join('');
    if (kind === 'shades') return '<path d="M36 ' + (y - 6) + ' h56 v6 a10 9 0 0 1 -20 4 l-4 -6 l-4 6 a10 9 0 0 1 -20 -4 z" fill="' + INK + '"/><path d="M42 ' + (y - 3) + ' h8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>';
    if (kind === 'wink') return '<circle cx="' + L + '" cy="' + y + '" r="5" fill="' + INK + '"/><path d="M' + (R - 8) + ' ' + y + ' q8 -7 16 0" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
    if (kind === 'stars') return [L, R].map(function (x) { return '<path d="M' + x + ' ' + (y - 8) + ' l2.5 5.5 l6 .7 l-4.5 4 l1.3 6 l-5.3 -3 l-5.3 3 l1.3 -6 l-4.5 -4 l6 -.7 z" fill="' + INK + '"/>'; }).join('');
    return [L, R].map(function (x) { return '<circle cx="' + x + '" cy="' + y + '" r="5" fill="' + INK + '"/>'; }).join('');
  }

  function mouth(kind, y) {
    var line = ' fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"';
    if (kind === 'open') return '<path d="M52 ' + y + ' q12 16 24 0 z" fill="' + INK + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M58 ' + (y + 7) + ' q6 -4 12 0" fill="#FF6B6B"/>';
    if (kind === 'tongue') return '<path d="M50 ' + y + ' q14 10 28 0"' + line + '/><path d="M60 ' + (y + 4) + ' q4 10 9 0" fill="#FF6B6B" stroke="' + INK + '" stroke-width="2.5"/>';
    if (kind === 'grin') return '<path d="M48 ' + (y - 2) + ' h32 a16 14 0 0 1 -32 0 z" fill="#fff" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M56 ' + (y - 2) + ' v6 M64 ' + (y - 2) + ' v8 M72 ' + (y - 2) + ' v6" stroke="' + INK + '" stroke-width="2"/>';
    if (kind === 'o') return '<ellipse cx="64" cy="' + (y + 2) + '" rx="5" ry="6" fill="' + INK + '"/>';
    if (kind === 'smirk') return '<path d="M54 ' + (y + 2) + ' q10 6 22 -4"' + line + '/>';
    return '<path d="M50 ' + y + ' q14 12 28 0"' + line + '/>';
  }

  function hat(kind, top) {
    var s = ' stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"';
    if (kind === 'crown') return '<path d="M42 ' + (top + 2) + ' l4 -20 l10 12 l8 -16 l8 16 l10 -12 l4 20 z" fill="#FFD93D"' + s + '/>';
    if (kind === 'party') return '<path d="M52 ' + (top + 4) + ' l12 -24 l12 24 z" fill="#4D9DE0"' + s + '/><circle cx="64" cy="' + (top - 21) + '" r="4.5" fill="#FF6B6B"' + s + '/>';
    if (kind === 'cap') return '<path d="M36 ' + (top + 6) + ' a28 20 0 0 1 56 0 z" fill="#FF6B6B"' + s + '/><path d="M84 ' + (top + 6) + ' h22" stroke="' + INK + '" stroke-width="6" stroke-linecap="round"/>';
    if (kind === 'beanie') return '<path d="M38 ' + (top + 8) + ' a26 22 0 0 1 52 0 z" fill="#6BCB77"' + s + '/><circle cx="64" cy="' + (top - 14) + '" r="6" fill="#FFF1A8"' + s + '/>';
    if (kind === 'sprout') return '<path d="M64 ' + (top + 4) + ' v-14" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/><path d="M64 ' + (top - 10) + ' q-14 -12 -20 -2 q10 8 20 2 q14 -12 20 -2 q-10 8 -20 2" fill="#6BCB77"' + s + '/>';
    return '';
  }

  var SHAPES = ['round', 'ears', 'frog', 'ghost', 'bear', 'square'];
  var TOP = { round: 34, ears: 38, frog: 44, ghost: 32, bear: 34, square: 32 };
  var EYES = ['dots', 'big', 'sleepy', 'shades', 'wink', 'stars', 'big', 'dots'];
  var MOUTHS = ['smile', 'open', 'tongue', 'grin', 'o', 'smirk'];
  var HATS = ['', '', '', 'crown', 'party', 'cap', 'beanie', 'sprout'];

  function parts(seed) {
    var r = rng('face:' + seed);
    var shape = pick(r, SHAPES);
    var body = pick(r, BODY);
    var bg = pick(r, BG);
    while (bg === body) bg = pick(r, BG);
    return { bg: bg, body: body, shape: shape, eyes: pick(r, EYES), mouth: pick(r, MOUTHS), hat: pick(r, HATS), blush: r() < 0.5 };
  }

  // The picture as an SVG string. size is the width and height in pixels.
  function svg(seed, size) {
    var p = parts(seed);
    var ey = p.shape === 'frog' ? 42 : 66;
    var my = p.shape === 'frog' ? 84 : 86;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="' + (size || 128) + '" height="' + (size || 128) + '" role="img" aria-label="Profile picture">' +
      '<rect width="128" height="128" fill="' + p.bg + '"/>' +
      '<g opacity=".35" fill="#fff"><circle cx="20" cy="22" r="6"/><circle cx="110" cy="100" r="9"/><circle cx="108" cy="24" r="3"/></g>' +
      bodyShape(p.shape, p.body) +
      (p.blush ? '<ellipse cx="38" cy="' + (ey + 14) + '" rx="7" ry="4" fill="#FF6B6B" opacity=".45"/><ellipse cx="90" cy="' + (ey + 14) + '" rx="7" ry="4" fill="#FF6B6B" opacity=".45"/>' : '') +
      eyes(p.eyes, ey) + mouth(p.mouth, my) + hat(p.hat, TOP[p.shape]) +
      '</svg>';
  }

  function dataUri(seed) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(seed, 128));
  }

  return { newSeed: newSeed, name: name, svg: svg, dataUri: dataUri, parts: parts };
});
