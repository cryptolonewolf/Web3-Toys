// The verify page: checks a certificate code and name with /api/verify.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var params = new URLSearchParams(location.search);

  app.innerHTML =
    '<div class="title-row"><h1 class="title-lg">Verify a certificate</h1>' +
    '<img class="mascot" src="../assets/aki-thinking.svg" alt="" width="84" height="84" /></div>' +
    '<p class="text">Enter the code and the name exactly as they appear on the certificate.</p>' +
    '<form class="card stack stack--tight" data-form>' +
    '<label class="label" for="code">Certificate code</label>' +
    '<input id="code" class="field" name="code" placeholder="W3T-XXXX-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" required />' +
    '<label class="label" for="name">Name on the certificate</label>' +
    '<input id="name" class="field" name="name" autocomplete="off" required />' +
    '<button class="btn btn--ink btn--block" type="submit">Check it</button></form>' +
    '<div data-result aria-live="polite"></div>';

  var form = app.querySelector('[data-form]');
  var out = app.querySelector('[data-result]');
  form.code.value = params.get('code') || '';
  form.name.value = params.get('name') || '';

  function check() {
    var code = form.code.value.trim();
    var name = form.name.value.trim();
    if (!code || !name) return;
    out.innerHTML = '<p class="text center">Checking…</p>';
    fetch('../api/verify?code=' + encodeURIComponent(code) + '&name=' + encodeURIComponent(name))
      .then(function (r) { return r.json().then(function (body) { return { status: r.status, body: body }; }); })
      .then(function (r) {
        if (r.status === 503) {
          out.innerHTML = '<section class="card card--warning"><p class="text text--ink">' + esc(r.body.error) + '</p></section>';
        } else if (r.body.valid) {
          var c = r.body.certificate;
          out.innerHTML = '<section class="card card--good stack stack--tight"><div class="chips"><span class="chip is-mint">✓ Genuine</span></div>' +
            '<h2 class="title-md">' + esc(c.name) + '</h2><p class="text text--ink">passed <strong>' + esc(c.title) + '</strong> on web3.toys with ' + c.score + '% on ' + esc(c.date) + '.</p>' +
            '<p class="small-print">Code ' + esc(c.code) + '</p></section>';
        } else {
          out.innerHTML = '<section class="card card--warning stack stack--tight"><div class="chips"><span class="chip is-coral">Not found</span></div>' +
            '<p class="text text--ink">No certificate matches this code and name. Check both carefully, including the spelling of the name.</p></section>';
        }
      })
      .catch(function () {
        out.innerHTML = '<section class="card card--warning"><p class="text text--ink">The check could not run. Please try again in a moment.</p></section>';
      });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); check(); });
  if (form.code.value && form.name.value) check();
})();
