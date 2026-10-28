// The shop panel on toy pages: reports, books and services for that toy.
// Items come from data/shop.json. The page has <aside id="shop" data-toy="...">.

(function () {
  var box = document.getElementById('shop');
  var site = window.WEB3TOYS;
  if (!box || !site) return;

  var COLORS = { blue: '#4D9DE0', coral: '#FF6B6B', mint: '#6BCB77', violet: '#A98BFF', yellow: '#FFD93D' };
  var ICONS = { Report: 'report', Book: 'book', Service: 'call' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Drawn cover (colour, icon and kind), or a picture when one is set.
  function cover(item, cls) {
    if (item.cover) return '<div class="' + cls + '"><img src="' + site.root + esc(item.cover) + '" alt="" loading="lazy" /></div>';
    return '<div class="' + cls + '" style="--c:' + (COLORS[item.color] || COLORS.yellow) + '">' +
      site.icon(item.icon || ICONS[item.kind] || 'star') + '<span>' + esc(item.kind) + '</span></div>';
  }

  // Empty url: a placeholder that says Coming soon.
  function button(item, cls) {
    if (!item.url) return '<span class="btn ' + cls + '" aria-disabled="true">Coming soon</span>';
    return '<a class="btn btn--yellow ' + cls + '" href="' + esc(item.url) + '" target="_blank" rel="noopener" data-item="' + esc(item.title) + '">' + esc(item.button || 'Get it') + '</a>';
  }

  function track(item) {
    if (window.Web3Common) window.Web3Common.track('shop_clicked', { item: item, toy: box.getAttribute('data-toy') });
  }

  window.Web3Shop = { cover: cover, button: button, esc: esc };

  fetch(site.root + 'data/shop.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (shop) {
      var items = shop.toys[box.getAttribute('data-toy')] || shop['default'] || [];
      if (!items.length) return;
      box.innerHTML =
        '<div class="shop-head">' + site.icon('bag', 'icon--lg') + '<div><h2 class="section-title">' + esc(shop.heading) + '</h2>' +
        '<p class="small-print">' + esc(shop.line) + '</p></div></div>' +
        '<ul class="shop-list">' + items.map(function (item) {
          return '<li class="card shop-item">' + cover(item, 'shop-cover') +
            '<div class="shop-info"><h3 class="shop-title">' + esc(item.title) + '</h3>' +
            (item.blurb ? '<p class="small-print">' + esc(item.blurb) + '</p>' : '') +
            '<p class="price">' + esc(item.price) + '</p>' + button(item, 'btn--small') + '</div></li>';
        }).join('') + '</ul>';
      box.querySelectorAll('[data-item]').forEach(function (a) {
        a.addEventListener('click', function () { track(a.getAttribute('data-item')); });
      });
    })
    .catch(function () {
      // The shop is extra; if it cannot load, the toy works without it.
    });
})();
