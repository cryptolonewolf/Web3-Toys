// Shared pieces for every toy: the share card, the share button, the email
// signup and the "Get the full report" and "Book a call" buttons.
// Settings come from data/site.js.

(function () {
  var SITE = window.WEB3TOYS_SITE || {};
  var INK = '#1F1B2E';
  var YELLOW = '#FFD93D';
  var CREAM = '#FFF8E1';
  var DISPLAY = "'Fredoka', 'Nunito', sans-serif";
  var BODY = "'Nunito', sans-serif";

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- Share card ----------

  function wrap(ctx, text, maxWidth) {
    var words = String(text).split(' ');
    var lines = [];
    var line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) return resolve(null);
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function paintCard(canvas, d, mascot) {
    var S = 1080;
    canvas.width = S;
    canvas.height = S;
    var ctx = canvas.getContext('2d');
    var x = 40;
    var y = 40;
    var w = S - 100;
    var pad = 64;

    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, S, S);
    // Card with flat offset shadow, like the mockup.
    ctx.fillStyle = INK;
    roundRect(ctx, x + 20, y + 20, w, w, 72);
    ctx.fill();
    ctx.fillStyle = YELLOW;
    roundRect(ctx, x, y, w, w, 72);
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = INK;
    ctx.stroke();

    ctx.textBaseline = 'top';
    ctx.fillStyle = INK;

    // Header: web3.toys and the byline pill.
    ctx.font = '700 60px ' + DISPLAY;
    ctx.fillText(SITE.site || 'web3.toys', x + pad, y + pad);
    ctx.font = '800 34px ' + BODY;
    var by = 'by ' + (SITE.byline || 'BuildWithAki');
    var bw = ctx.measureText(by).width + 56;
    var bx = x + w - pad - bw;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, bx, y + pad + 4, bw, 58, 29);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillText(by, bx + 28, y + pad + 15);

    // Title
    var ty = y + pad + 120;
    ctx.font = '700 80px ' + DISPLAY;
    wrap(ctx, d.title, 640).slice(0, 3).forEach(function (line) {
      ctx.fillText(line, x + pad, ty);
      ty += 86;
    });

    // Big number and rank
    ty += 20;
    ctx.font = '700 170px ' + DISPLAY;
    var big = String(d.big);
    ctx.fillText(big, x + pad, ty);
    var nx = x + pad + ctx.measureText(big).width + 28;
    ctx.font = '800 46px ' + BODY;
    if (d.bigLabel) ctx.fillText(d.bigLabel, nx, ty + 46);
    ctx.fillText(d.rank, nx, ty + (d.bigLabel ? 104 : 80));
    ty += 196;

    // One line
    ctx.font = '800 40px ' + BODY;
    wrap(ctx, d.line, mascot ? 560 : 820).slice(0, 3).forEach(function (line) {
      ctx.fillText(line, x + pad, ty);
      ty += 52;
    });

    // Call to action pill at the bottom left
    ctx.font = '600 52px ' + DISPLAY;
    var cta = d.cta || 'Can you do better?';
    var cw = ctx.measureText(cta).width + 86;
    var cy = y + w - pad - 92;
    ctx.fillStyle = INK;
    roundRect(ctx, x + pad, cy, cw, 92, 36);
    ctx.fill();
    ctx.fillStyle = YELLOW;
    ctx.fillText(cta, x + pad + 43, cy + 18);

    if (mascot) ctx.drawImage(mascot, x + w - 30 - 330, y + w - 30 - 330, 330, 330);
  }

  // data: { title, big, bigLabel, rank, line, cta, mascotSrc }
  // Draws the square card. Pasted text never goes on it; only these fields.
  function drawShareCard(canvas, data) {
    var fonts = document.fonts
      ? Promise.all([
          document.fonts.load('700 60px Fredoka'),
          document.fonts.load('600 52px Fredoka'),
          document.fonts.load('800 40px Nunito'),
        ]).catch(function () {})
      : Promise.resolve();
    return fonts.then(function () { return loadImage(data.mascotSrc); }).then(function (mascot) {
      paintCard(canvas, data, mascot);
      // Opened straight from the computer, browsers block saving a canvas that
      // has a picture on it. Draw it again without the mascot in that case.
      try {
        canvas.toDataURL();
      } catch (e) {
        paintCard(canvas, data, null);
      }
      return canvas;
    });
  }

  // ---------- Share button ----------

  function share(canvas, text, filename) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); }).then(function (blob) {
      var file = typeof File === 'function' ? new File([blob], filename, { type: 'image/png' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: text }).catch(function (err) {
          if (err && err.name !== 'AbortError') shareModal(blob, text, filename);
        });
      }
      shareModal(blob, text, filename);
    });
  }

  function shareModal(blob, text, filename) {
    var url = URL.createObjectURL(blob);
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="card stack stack--tight" role="dialog" aria-modal="true" aria-labelledby="share-title">' +
      '<h2 id="share-title" class="title-md">Share your result</h2>' +
      '<img class="share-preview" src="' + url + '" alt="Your share card" />' +
      '<a class="btn btn--yellow btn--block" href="' + url + '" download="' + esc(filename) + '">Save the image</a>' +
      '<label class="label" for="share-post">Your post</label>' +
      '<textarea id="share-post" class="field field--area" rows="3" readonly>' + esc(text) + '</textarea>' +
      '<button type="button" class="btn btn--block" data-copy>Copy the post</button>' +
      '<button type="button" class="btn btn--ink btn--block" data-close>Close</button>' +
      '</div>';
    document.body.appendChild(modal);
    function close() {
      URL.revokeObjectURL(url);
      modal.remove();
    }
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('[data-close]').addEventListener('click', close);
    modal.querySelector('[data-copy]').addEventListener('click', function (e) {
      var area = modal.querySelector('textarea');
      var done = function () { e.target.textContent = 'Copied'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { area.select(); document.execCommand('copy'); done(); });
      } else {
        area.select();
        document.execCommand('copy');
        done();
      }
    });
    modal.querySelector('[data-close]').focus();
  }

  // ---------- Email signup ----------

  // copy: { heading, line, button }
  function signupHtml(copy) {
    var cfg = SITE.signup || {};
    var ready = Boolean(cfg.action);
    var hidden = Object.keys(cfg.hidden || {}).map(function (k) {
      return '<input type="hidden" name="' + esc(k) + '" value="' + esc(cfg.hidden[k]) + '" />';
    }).join('');
    return (
      '<form class="card stack stack--tight" data-signup' +
      (ready ? ' action="' + esc(cfg.action) + '" method="post" target="_blank"' : '') + '>' +
      '<h2 class="title-md">' + esc(copy.heading) + '</h2>' +
      '<p class="text">' + esc(copy.line) + '</p>' +
      '<label class="label" for="signup-email">Your email</label>' +
      '<input id="signup-email" class="field" type="email" name="' + esc(cfg.emailField || 'email') + '" placeholder="you@example.com" autocomplete="email" required />' +
      hidden +
      '<button class="btn btn--yellow btn--block" type="submit">' + esc(copy.button) + '</button>' +
      '<p class="small-print" data-signup-msg aria-live="polite"></p>' +
      '</form>'
    );
  }

  // ---------- Report and call buttons ----------

  function linkButton(kind, label, cls) {
    var url = kind === 'report' ? SITE.reportUrl : SITE.callUrl;
    if (url) return '<a class="btn ' + cls + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + '</a>';
    return '<button type="button" class="btn ' + cls + '" data-soon="' + kind + '">' + esc(label) + '</button>';
  }

  function reportButton(cls) { return linkButton('report', 'Get the full report', cls || ''); }
  function callButton(cls) { return linkButton('call', 'Book a call', cls || ''); }

  function callLink(text) {
    if (SITE.callUrl) return '<a href="' + esc(SITE.callUrl) + '" target="_blank" rel="noopener">' + esc(text) + '</a>';
    return '<button type="button" class="text-button" data-soon="call">' + esc(text) + '</button>';
  }

  var SOON = {
    report: 'The full report is coming soon. Leave your email below and you will get it first.',
    call: 'Booking a call opens soon. Leave your email below and you will hear first.',
  };

  // Wires up the signup form and any "coming soon" buttons inside `root`.
  // `msg` is an element for the coming soon message.
  function bind(root, msg) {
    var form = root.querySelector('[data-signup]');
    if (form) {
      form.addEventListener('submit', function (e) {
        if (!(SITE.signup && SITE.signup.action)) {
          e.preventDefault();
          form.querySelector('[data-signup-msg]').textContent = 'Signups open soon. Thanks for your patience.';
        }
      });
    }
    root.querySelectorAll('[data-soon]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (msg) msg.textContent = SOON[btn.getAttribute('data-soon')];
      });
    });
  }

  window.ToyKit = {
    esc: esc,
    drawShareCard: drawShareCard,
    share: share,
    signupHtml: signupHtml,
    reportButton: reportButton,
    callButton: callButton,
    callLink: callLink,
    bind: bind,
  };
})();
