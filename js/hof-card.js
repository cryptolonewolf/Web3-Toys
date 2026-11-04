// Who Built It? portraits and share cards, shared by the game
// (js/hof-app.js), the person pages (js/hof-person.js) and the X preview
// images (tools/hof-cards.mjs makes images/people/cards/ID.png).
//
//   Web3HofCard.sketch(p, color, standalone)  pencil sketch SVG (initials)
//   Web3HofCard.portrait(p, color, cls, root) portrait: drawing or sketch
//   Web3HofCard.draw(canvas, p, cat, opts)    the 1200 x 675 card; Promise
//   Web3HofCard.COLORS

(function () {
  var COLORS = { blue: '#4D96FF', violet: '#9B5DE5', mint: '#6BCB77', yellow: '#FFD93D', orange: '#FF9F45', teal: '#2EC4B6', pink: '#FF7AB6', coral: '#FF6B6B' };
  var INK = '#1F1B2E';
  var CREAM = '#FFF8E1';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function initials(name) {
    return name.replace(/\(.*?\)/g, '').trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  }

  // A coloured-pencil style sketch. standalone: carries its own pencil
  // filter (for pictures); otherwise it uses the page's #hof-pencil.
  function sketch(p, color, standalone) {
    var col = COLORS[color] || COLORS.yellow;
    var fid = standalone ? 'pf' : 'hof-pencil';
    var face = p.anon
      ? '<path d="M50 14c-20 0-32 16-32 34v40h64V48c0-18-12-34-32-34z" fill="#3B3552"/><ellipse cx="50" cy="52" rx="17" ry="20" fill="' + INK + '"/>' +
        '<text x="50" y="60" text-anchor="middle" font-size="22" font-weight="800" fill="#FFD93D" font-family="Fredoka, sans-serif">?</text>'
      : '<text x="50" y="62" text-anchor="middle" font-size="30" font-weight="700" fill="' + INK + '" font-family="Chewy, Fredoka, sans-serif">' + esc(initials(p.name)) + '</text>';
    return '<svg class="hof-sketch" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true"><defs>' +
      (standalone ? '<filter id="pf"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter>' : '') +
      '<pattern id="hatch-' + esc(p.id) + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="6" stroke="' + col + '" stroke-width="2.4" opacity=".75"/></pattern></defs>' +
      '<g filter="url(#' + fid + ')"><circle cx="50" cy="50" r="44" fill="' + CREAM + '"/><circle cx="50" cy="50" r="44" fill="url(#hatch-' + esc(p.id) + ')"/>' +
      '<circle cx="50" cy="50" r="44" fill="none" stroke="' + INK + '" stroke-width="2.5"/>' + face + '</g></svg>';
  }

  function portrait(p, color, cls, root) {
    return '<span class="hof-face ' + (cls || '') + '">' + (p.photo
      ? '<img src="' + (root || '../') + 'images/people/' + esc(p.id) + '.webp" alt="" loading="lazy" onerror="this.remove()" />'
      : '') + sketch(p, color) + '</span>';
  }

  function loadImg(src) {
    return new Promise(function (ok, fail) {
      var i = new Image();
      i.onload = function () { ok(i); };
      i.onerror = fail;
      i.src = src;
    });
  }

  function wrap(ctx, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    words.forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  function fonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['64px "Luckiest Guy"', '700 30px Fredoka', '800 30px Nunito'].map(function (f) { return document.fonts.load(f).catch(function () {}); }));
  }

  // opts: { root: path to the site root, pct: % who named them, w, h }
  function draw(canvas, p, cat, opts) {
    opts = opts || {};
    var root = opts.root || '../';
    var W = canvas.width = opts.w || 1200;
    var H = canvas.height = opts.h || 675;
    var ctx = canvas.getContext('2d');
    var color = COLORS[(cat || {}).color] || COLORS.yellow;
    var face = p.photo ? loadImg(root + 'images/people/' + p.id + '.webp').catch(function () { return null; }) : Promise.resolve(null);
    var sk = loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sketch(p, (cat || {}).color, true)));
    var logo = loadImg(root + 'images/brand/web3toys-icon.svg').catch(function () { return null; });
    return Promise.all([fonts(), face, sk, logo]).then(function (r) {
      var photo = r[1], drawn = r[2], icon = r[3];
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, W, H);
      // A soft hatch in the person's colour.
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      for (var x = -H; x < W; x += 22) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke(); }
      ctx.restore();
      // The card.
      ctx.fillStyle = INK;
      round(ctx, 34, 40, W - 60, H - 72, 36); ctx.fill();
      ctx.fillStyle = p.caution ? '#FFE3DF' : '#FFFFFF';
      round(ctx, 26, 30, W - 60, H - 72, 36); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
      // Portrait.
      var cx = 230, cy = 300, rad = 165;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = color; ctx.fill(); ctx.clip();
      if (photo) {
        var s = Math.max(rad * 2 / photo.width, rad * 2 / photo.height);
        ctx.drawImage(photo, cx - photo.width * s / 2, cy - photo.height * s / 2, photo.width * s, photo.height * s);
      } else {
        ctx.drawImage(drawn, cx - rad - 8, cy - rad - 8, rad * 2 + 16, rad * 2 + 16);
      }
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
      // Label and name.
      var x0 = 440, maxW = W - x0 - 80;
      ctx.fillStyle = p.caution ? '#B3261E' : INK;
      ctx.font = '800 26px Nunito, sans-serif';
      ctx.fillText(p.caution ? 'A CAUTIONARY TALE' : 'INDUCTED INTO THE HALL OF FAME', x0, 108);
      ctx.fillStyle = INK;
      var size = 64;
      ctx.font = size + 'px "Luckiest Guy", sans-serif';
      while (ctx.measureText(p.name).width > maxW && size > 36) { size -= 4; ctx.font = size + 'px "Luckiest Guy", sans-serif'; }
      ctx.fillText(p.name, x0, 108 + size + 6);
      var y = 108 + size + 50;
      ctx.font = '700 28px Fredoka, sans-serif';
      ctx.fillStyle = '#4A4560';
      wrap(ctx, p.role, maxW).slice(0, 2).forEach(function (l) { ctx.fillText(l, x0, y); y += 36; });
      y += 10;
      ctx.fillStyle = INK;
      ctx.font = '700 27px Nunito, sans-serif';
      wrap(ctx, p.why, maxW).slice(0, 4).forEach(function (l) { ctx.fillText(l, x0, y); y += 36; });
      // The fun fact, on a sticky note in the person's colour.
      ctx.font = '700 24px Nunito, sans-serif';
      var fun = wrap(ctx, 'Fun fact: ' + p.fun, maxW - 40).slice(0, 3);
      var boxH = fun.length * 32 + 28;
      if (y + 16 + boxH < H - 120) {
        y += 16;
        ctx.save();
        ctx.globalAlpha = 0.35; ctx.fillStyle = color;
        round(ctx, x0 - 4, y, maxW + 8, boxH, 18); ctx.fill();
        ctx.restore();
        ctx.fillStyle = INK;
        fun.forEach(function (l, i) { ctx.fillText(l, x0 + 16, y + 40 + i * 32); });
      }
      // Footer: who got it right, the logo and the address.
      ctx.font = '800 24px Nunito, sans-serif';
      ctx.fillStyle = INK;
      var foot = opts.pct != null ? 'Only ' + opts.pct + '% of players named them. Can you?' : 'Can you name all 50 web3 builders?';
      ctx.fillText(foot, 80, H - 80);
      if (icon) ctx.drawImage(icon, W - 330, H - 128, 64, 64);
      ctx.font = '26px "Luckiest Guy", sans-serif';
      ctx.fillText('web3.toys', W - 256, H - 82);
      return canvas;
    });
  }

  function round(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  window.Web3HofCard = { COLORS: COLORS, sketch: sketch, portrait: portrait, draw: draw, initials: initials };
})();
