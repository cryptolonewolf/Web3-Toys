// The Privacy, Terms, Refunds and Contact pages. Each page sets data-doc on
// <body>; its words come from data/legal/<doc>.json. The Contact page adds
// the details from config.js (contact).

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var doc = document.body.getAttribute('data-doc');
  var contact = (window.WEB3TOYS_CONFIG || {}).contact || {};

  C.loadJson('../data/legal/' + doc + '.json').then(function (d) {
    var line = function (t) { return /^TODO/.test(t) ? '<span class="todo">' + esc(t) + '</span>' : esc(t); };
    app.innerHTML = '<article class="card legal stack stack--tight">' +
      '<h1 class="title-xl">' + esc(d.title) + '</h1>' +
      (d.updated ? '<p class="small-print">Last updated: ' + esc(d.updated) + '</p>' : '') +
      '<p class="text text--ink">' + esc(d.intro) + '</p>' +
      (doc === 'contact' ? contactBox() + contactForm() : '') +
      d.sections.map(function (s) {
        return '<h2 class="title-md"' + (s.id ? ' id="' + esc(s.id) + '"' : '') + '>' + esc(s.title) + '</h2><ul>' + s.list.map(function (l) { return '<li>' + line(l) + '</li>'; }).join('') + '</ul>';
      }).join('') +
      '<p class="small-print legal-links"><a href="../privacy/">Privacy</a> · <a href="../terms/">Terms</a> · <a href="../refunds/">Refunds and delivery</a> · <a href="../contact/">Contact</a></p>' +
      '</article>';
    if (doc === 'contact') bindForm();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  // The contact form: saved for the team (send_contact, supabase/017_ops.sql).
  var SB = (window.WEB3TOYS_CONFIG || {}).supabase || {};
  function contactForm() {
    if (!SB.url) return '';
    return '<form class="stack stack--tight ct-form" novalidate><h2 class="title-md">Send us a message</h2>' +
      '<label class="label" for="ct-name">Your name</label><input class="field" id="ct-name" maxlength="100" autocomplete="name" required />' +
      '<label class="label" for="ct-email">Your email (we reply here)</label><input class="field" id="ct-email" type="email" maxlength="200" autocomplete="email" required />' +
      '<label class="label" for="ct-topic">About</label><select class="field" id="ct-topic"><option value="general">Something else</option><option value="payment">A payment or refund</option><option value="project">My project</option><option value="privacy">My data and privacy</option><option value="bug">Something is broken</option></select>' +
      '<label class="label" for="ct-msg">Message</label><textarea class="field field--area" id="ct-msg" rows="5" maxlength="3000" required></textarea>' +
      '<div class="ct-trap" aria-hidden="true"><label>Leave this empty <input tabindex="-1" autocomplete="off" id="ct-web" /></label></div>' +
      '<p class="small-print">Never send a recovery phrase, private key or password. We will never ask for them.</p>' +
      '<button type="submit" class="btn btn--ink">Send message</button><p class="small-print" data-ct-msg aria-live="polite"></p></form>';
  }
  function bindForm() {
    var f = app.querySelector('.ct-form');
    if (!f) return;
    var A = window.Web3Auth;
    var u = A && A.user && A.user();
    if (u && u.email) f.querySelector('#ct-email').value = u.email;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var say = function (t) { f.querySelector('[data-ct-msg]').textContent = t; };
      var v = function (id) { return f.querySelector(id).value.trim(); };
      if (!v('#ct-name') || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('#ct-email')) || v('#ct-msg').length < 5) return say('Please fill in your name, a valid email and your message.');
      if (/([a-z]{3,8} ){11,}[a-z]{3,8}/i.test(v('#ct-msg')) || /[0-9a-f]{64}/i.test(v('#ct-msg'))) return say('That looks like a recovery phrase or private key. Never share those with anyone, including us. Please remove it.');
      var btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      say('Sending…');
      var headers = { apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey, 'Content-Type': 'application/json' };
      var sess = A && A.client && A.session && A.session();
      if (sess && sess.access_token) headers.Authorization = 'Bearer ' + sess.access_token;
      fetch(SB.url.replace(/\/$/, '') + '/rest/v1/rpc/send_contact', {
        method: 'POST', headers: headers,
        body: JSON.stringify({ p_name: v('#ct-name'), p_email: v('#ct-email'), p_topic: f.querySelector('#ct-topic').value, p_message: v('#ct-msg'), p_trap: f.querySelector('#ct-web').value }),
      }).then(function (r) {
        if (r.ok) { f.innerHTML = '<p class="tk-warn is-good">✅ Thanks! Your message reached us. We reply by email.</p>'; return; }
        return r.json().then(function (j) { throw new Error((j && j.message) || 'Could not send.'); });
      }).catch(function (err) { btn.disabled = false; say(err.message + ' You can also email us directly.'); });
    });
  }

  function contactBox() {
    var row = function (label, value, html) {
      return '<tr><th>' + label + '</th><td>' + (value ? html || esc(value) : '<span class="todo">TODO: add in config.js (contact)</span>') + '</td></tr>';
    };
    return '<table class="tk-table">' +
      row('Email', contact.email, contact.email && '<a href="mailto:' + esc(contact.email) + '">' + esc(contact.email) + '</a>') +
      row('Business name', contact.business) + row('Address', contact.address) + '</table>';
  }
})();
