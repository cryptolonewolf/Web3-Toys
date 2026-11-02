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

  function actions() {
    return '<div class="tool-actions" role="group" aria-label="Save and share">' +
      '<button type="button" class="btn btn--small btn--ink" data-tool="pdf">Download PDF</button>' +
      '<button type="button" class="btn btn--small" data-tool="png">Download PNG</button>' +
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

  // handlers: { pdf, png, copy, reset }. Each returns nothing; copy returns
  // the text to copy.
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
        if (kind === 'copy') {
          copyText(handlers.copy()).then(function () { say('Copied.'); }, function () { say('Could not copy. Select the text and copy it yourself.'); });
        } else if (kind === 'reset') {
          if (window.confirm('Start again? This clears what you entered.')) {
            handlers.reset();
            say('Reset.');
          }
        } else if (handlers[kind]) {
          handlers[kind]();
          if (kind === 'png') say('Making your image…');
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
    PRIVACY: PRIVACY,
    DISCLAIMER: DISCLAIMER,
  };
})();
