// Shared pieces for every builder tool: the action bar (Download PDF,
// Download PNG, Copy, Reset), the privacy and disclaimer lines, saving inputs
// in this browser, the print sheet and the email signup and Book a Call
// footer. Nothing a visitor types is sent anywhere.

(function () {
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var PRIVACY = 'Your data stays in your browser.';
  var DISCLAIMER = 'Educational tool, not financial, legal or tax advice.';

  function notes() {
    return '<p class="tool-privacy">' + window.WEB3TOYS.icon('lock') + PRIVACY + '</p>' +
      '<p class="tool-disclaimer">' + DISCLAIMER + '</p>';
  }

  // opts.png: false hides Download PNG. opts.extra: more buttons, as
  // [{ id, label }]; their handlers are passed to bind() under the same id.
  function actions(opts) {
    opts = opts || {};
    return '<div class="tool-actions" role="group" aria-label="Save and share">' +
      '<button type="button" class="btn btn--small btn--ink" data-tool="pdf">Download PDF</button>' +
      (opts.png === false ? '' : '<button type="button" class="btn btn--small" data-tool="png">Download PNG</button>') +
      (opts.extra || []).map(function (b) { return '<button type="button" class="btn btn--small" data-tool="' + esc(b.id) + '">' + esc(b.label) + '</button>'; }).join('') +
      '<button type="button" class="btn btn--small" data-tool="copy">Copy</button>' +
      '<button type="button" class="btn btn--small" data-tool="reset">Reset</button>' +
      '<p class="small-print tool-msg" data-tool-msg aria-live="polite"></p></div>';
  }

  // Email signup and Book a Call at the end of every tool.
  function footer() {
    return '<section class="card stack stack--tight"><h2 class="title-md">Want a second pair of eyes?</h2>' +
      '<p class="text">Book a call with Aki to go through your launch plan together.</p>' +
      '<div class="btn-row">' + ToyKit.callButton('btn--yellow') + '</div>' +
      '<p class="small-print" data-soon-msg aria-live="polite"></p></section>' +
      ToyKit.signupHtml({ heading: 'Get new tools first', line: 'One email when a new builder tool goes live. No spam.', button: 'Keep me posted' }) +
      notes();
  }

  // handlers: { pdf, png, copy, reset } plus any extra buttons. copy returns
  // the text to copy; others may return a message to show. blocked(), if
  // given, returns a message while exports are not allowed yet.
  function bind(root, handlers) {
    var msg = root.querySelector('[data-tool-msg]');
    var say = function (t) {
      if (!msg) return;
      msg.textContent = t;
      clearTimeout(say.t);
      say.t = setTimeout(function () { msg.textContent = ''; }, 3500);
    };
    root.querySelectorAll('[data-tool]').forEach(function (b) {
      b.addEventListener('click', function () {
        var kind = b.getAttribute('data-tool');
        // handlers.blocked() can stop every export (not Reset) with a message.
        var blocked = kind !== 'reset' && handlers.blocked && handlers.blocked();
        if (blocked) {
          say(blocked);
        } else if (kind === 'copy') {
          copyText(handlers.copy()).then(function () { say('Copied.'); }, function () { say('Could not copy. Select the text and copy it yourself.'); });
        } else if (kind === 'reset') {
          if (window.confirm('Start again? This clears what you entered.')) {
            handlers.reset();
            say('Reset.');
          }
        } else if (handlers[kind]) {
          var said = handlers[kind]();
          if (kind === 'png') say('Making your image…');
          if (typeof said === 'string') say(said);
        }
      });
    });
    ToyKit.bind(root, root.querySelector('[data-soon-msg]'));
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand('copy');
      area.remove();
      if (ok) resolve();
      else reject();
    });
  }

  // Inputs are remembered in this browser only.
  function store(key) {
    var full = 'web3toys.tool.' + key + '.v1';
    return {
      load: function () {
        try { return JSON.parse(window.localStorage.getItem(full)); } catch (e) { return null; }
      },
      save: function (data) {
        try { window.localStorage.setItem(full, JSON.stringify(data)); } catch (e) { /* private mode */ }
      },
      clear: function () {
        try { window.localStorage.removeItem(full); } catch (e) { /* private mode */ }
      },
    };
  }

  // Print a one page sheet: the browser's print window can save it as a PDF.
  function printSheet(html) {
    var sheet = document.getElementById('print-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'print-sheet';
      document.body.appendChild(sheet);
    }
    sheet.innerHTML = html + '<p class="print-foot">' + DISCLAIMER + ' Made with web3.toys.</p>';
    document.body.classList.add('is-printing');
    var done = function () {
      document.body.classList.remove('is-printing');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(function () { window.print(); }, 50);
  }

  // An SVG drawing as an image, for drawing on a canvas.
  function svgImage(svg) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      var src = svg.indexOf('xmlns=') > -1 ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    });
  }

  function downloadCanvas(canvas, filename) {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }, 'image/png');
  }

  function fmt(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  function usd(n) {
    return '$' + fmt(n);
  }

  // ---------- One page sheets ----------
  // A tool describes its sheet once and gets the PDF, PNG and Copy text:
  // { title, subtitle, facts: [[label, value]], table: { head: [], rows: [[]] },
  //   charts: [svg], sections: [{ title, lines: [] }] }

  function sheetHtml(m) {
    return '<h1>' + esc(m.title) + '</h1>' + (m.subtitle ? '<p>' + esc(m.subtitle) + '</p>' : '') +
      (m.facts && m.facts.length ? '<table class="tk-table sheet-facts">' + m.facts.map(function (f) { return '<tr><th>' + esc(f[0]) + '</th><td>' + esc(f[1]) + '</td></tr>'; }).join('') + '</table>' : '') +
      (m.table ? '<table class="tk-table"><thead><tr>' + m.table.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        m.table.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>' : '') +
      (m.charts || []).map(function (svg) { return '<div class="sheet-chart">' + svg + '</div>'; }).join('') +
      (m.sections || []).map(function (s) {
        return '<h2>' + esc(s.title) + '</h2><ul>' + s.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
      }).join('');
  }

  function sheetText(m) {
    return m.title + (m.subtitle ? '\n' + m.subtitle : '') + '\n\n' +
      (m.facts || []).map(function (f) { return f[0] + ': ' + f[1]; }).join('\n') +
      (m.table ? '\n\n' + [m.table.head].concat(m.table.rows).map(function (r) { return r.join(' | '); }).join('\n') : '') +
      (m.sections || []).map(function (s) { return '\n\n' + s.title + ':\n' + s.lines.map(function (l) { return '- ' + l; }).join('\n'); }).join('') +
      '\n\n' + DISCLAIMER + ' Made with web3.toys.';
  }

  function wrapLines(ctx, text, max) {
    var lines = [];
    var line = '';
    String(text).split(' ').forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > max && line) {
        lines.push(line);
        line = w;
      } else {
        line = t;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  // Draws the sheet on a tall canvas, then crops it to what was used.
  function sheetPng(m, filename) {
    var W = 1240;
    var X = 60;
    var max = W - 2 * X;
    var big = document.createElement('canvas');
    big.width = W;
    big.height = 9000;
    var ctx = big.getContext('2d');
    var INK = '#1F1B2E';
    return Promise.all((m.charts || []).map(svgImage)).then(function (imgs) {
      ctx.fillStyle = '#FFF8E1';
      ctx.fillRect(0, 0, W, big.height);
      ctx.fillStyle = INK;
      ctx.textBaseline = 'alphabetic';
      var y = 100;
      ctx.font = '700 52px Fredoka, Nunito, sans-serif';
      wrapLines(ctx, m.title, max).forEach(function (l) { ctx.fillText(l, X, y); y += 60; });
      if (m.subtitle) {
        ctx.font = '800 26px Nunito, sans-serif';
        wrapLines(ctx, m.subtitle, max).forEach(function (l) { ctx.fillText(l, X, y); y += 36; });
      }
      y += 20;
      (m.facts || []).forEach(function (f, i) {
        var col = i % 2;
        var fx = X + col * (max / 2);
        ctx.font = '800 22px Nunito, sans-serif';
        ctx.fillStyle = '#5A5470';
        ctx.fillText(f[0], fx, y);
        ctx.fillStyle = INK;
        ctx.font = '700 34px Fredoka, Nunito, sans-serif';
        ctx.fillText(String(f[1]).slice(0, 34), fx, y + 40);
        if (col === 1 || i === m.facts.length - 1) y += 90;
      });
      if (m.table) {
        y += 10;
        var cols = m.table.head.length;
        var cw = max / cols;
        ctx.font = '800 22px Nunito, sans-serif';
        m.table.head.forEach(function (h, i) { ctx.fillText(h, X + i * cw, y); });
        y += 12;
        ctx.fillRect(X, y, max, 3);
        y += 36;
        ctx.font = '700 22px Nunito, sans-serif';
        m.table.rows.forEach(function (r) {
          var h = 1;
          r.forEach(function (c, i) {
            var lines = wrapLines(ctx, c, cw - 14);
            h = Math.max(h, lines.length);
            lines.forEach(function (l, k) { ctx.fillText(l, X + i * cw, y + k * 28); });
          });
          y += h * 28 + 12;
        });
      }
      imgs.forEach(function (img) {
        if (!img) return;
        y += 20;
        // Wide charts fill the width; round ones stay a sensible size.
        var w = max;
        var h = (img.height / img.width) * w || 400;
        if (h > 460) {
          w = w * 460 / h;
          h = 460;
        }
        ctx.drawImage(img, X, y, w, h);
        y += h + 20;
      });
      (m.sections || []).forEach(function (s) {
        y += 30;
        ctx.font = '700 34px Fredoka, Nunito, sans-serif';
        ctx.fillText(s.title, X, y);
        y += 44;
        ctx.font = '700 22px Nunito, sans-serif';
        s.lines.forEach(function (l) {
          wrapLines(ctx, '• ' + l, max).forEach(function (t) { ctx.fillText(t, X, y); y += 30; });
          y += 6;
        });
      });
      y += 50;
      ctx.font = '700 20px Nunito, sans-serif';
      ctx.fillStyle = '#5A5470';
      ctx.fillText(DISCLAIMER + ' Made with web3.toys.', X, y);
      var out = document.createElement('canvas');
      out.width = W;
      out.height = y + 50;
      out.getContext('2d').drawImage(big, 0, 0);
      downloadCanvas(out, filename);
    });
  }

  // The PDF, PNG and Copy handlers for a tool, from a function that returns
  // its sheet. Pass more handlers (like reset) in extra.
  function sheetHandlers(model, filename, extra) {
    var h = {
      pdf: function () { printSheet(sheetHtml(model())); },
      png: function () { sheetPng(model(), filename); },
      copy: function () { return sheetText(model()); },
    };
    Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  // Simple SVG charts shared by the tools.
  function donut(slices, size) {
    size = size || 200;
    var c = size / 2;
    var r = size / 2 - 8;
    var total = slices.reduce(function (s, x) { return s + Math.max(0, x.value); }, 0) || 1;
    var a = -Math.PI / 2;
    var paths = slices.filter(function (x) { return x.value > 0; }).map(function (x, i, arr) {
      var b = a + (x.value / total) * Math.PI * 2;
      var p = arr.length === 1
        ? '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="' + x.color + '" stroke="#1F1B2E" stroke-width="4"/>'
        : '<path d="M' + c + ' ' + c + ' L' + (c + r * Math.cos(a)).toFixed(2) + ' ' + (c + r * Math.sin(a)).toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (b - a > Math.PI ? 1 : 0) + ' 1 ' +
          (c + r * Math.cos(b)).toFixed(2) + ' ' + (c + r * Math.sin(b)).toFixed(2) + 'Z" fill="' + x.color + '" stroke="#1F1B2E" stroke-width="4" stroke-linejoin="round"/>';
      a = b;
      return p;
    }).join('');
    return '<svg class="tk-pie" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Chart">' +
      (paths || '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="#F1E9CF" stroke="#1F1B2E" stroke-width="4"/>') +
      '<circle cx="' + c + '" cy="' + c + '" r="' + (r * 0.45).toFixed(1) + '" fill="#FFF8E1" stroke="#1F1B2E" stroke-width="4"/></svg>';
  }

  function legend(items) {
    return '<ul class="tk-legend">' + items.map(function (x) {
      return '<li><span class="tk-dot" style="--c:' + x.color + '"></span>' + esc(x.label) + (x.note ? ' <b>' + esc(x.note) + '</b>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  window.ToolKit = {
    esc: esc,
    notes: notes,
    actions: actions,
    footer: footer,
    bind: bind,
    copyText: copyText,
    store: store,
    printSheet: printSheet,
    svgImage: svgImage,
    downloadCanvas: downloadCanvas,
    fmt: fmt,
    usd: usd,
    sheetHtml: sheetHtml,
    sheetText: sheetText,
    sheetPng: sheetPng,
    sheetHandlers: sheetHandlers,
    donut: donut,
    legend: legend,
    PRIVACY: PRIVACY,
    DISCLAIMER: DISCLAIMER,
  };
})();
