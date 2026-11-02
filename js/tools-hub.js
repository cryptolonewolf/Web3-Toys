// The Tools page: every builder tool from data/tools/tools.json. Live tools
// link to their page; the rest show as coming soon.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');

  C.loadJson('../data/tools/tools.json').then(function (data) {
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">' + esc(data.title) + '</h1>' +
      '<p class="text text--ink">' + esc(data.line) + '</p>' + window.ToolKitNotes() + '</section>' +
      '<ol class="tool-list">' + data.tools.map(function (t, i) {
        var live = t.status === 'live';
        var inner = '<span class="tool-num">' + (i + 1) + '</span><span class="tool-list-body"><b class="title-sm">' + esc(t.title) + '</b>' +
          '<span class="small-print">' + esc(t.blurb) + '</span></span>' + (live ? '<span class="go">Open →</span>' : '<span class="chip is-white">Soon</span>');
        return '<li>' + (live ? '<a class="card tool-item" href="' + esc(t.path) + '">' + inner + '</a>' : '<div class="card tool-item is-soon">' + inner + '</div>') + '</li>';
      }).join('') + '</ol>';
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  // The privacy and disclaimer lines, without loading the whole tool kit.
  window.ToolKitNotes = function () {
    return '<p class="tool-privacy">' + site.icon('lock') + 'Your data stays in your browser.</p>' +
      '<p class="tool-disclaimer">Educational tool, not financial, legal or tax advice.</p>';
  };
})();
