// Builds the toy cards on the home page from data/toys.js.

(function () {
  var list = document.getElementById('toy-list');
  var toys = window.WEB3TOYS_TOYS || [];

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  list.textContent = '';

  toys.forEach(function (toy) {
    var live = toy.status === 'live';
    var item = el('li');
    var card = el(live ? 'a' : 'div', 'card toy-card' + (live ? '' : ' toy-card--soon'));
    if (toy.color === 'yellow') card.classList.add('card--yellow');

    if (live) {
      card.href = toy.path;
    } else {
      card.setAttribute('aria-label', toy.title + ', coming soon');
    }

    var chips = el('div', 'chips');
    (toy.tags || []).forEach(function (tag) {
      chips.appendChild(el('span', 'chip is-' + (tag.color || 'white'), tag.text));
    });

    card.appendChild(chips);
    card.appendChild(el('h3', 'title-sm', toy.title));
    card.appendChild(el('p', 'text', toy.description));
    if (live) card.appendChild(el('span', 'go', 'Play now →'));

    item.appendChild(card);
    list.appendChild(item);
  });

  if (window.WEB3TOYS) window.WEB3TOYS.fixFolderLinks(list);
})();
