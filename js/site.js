// Small helpers shared by every page.

(function () {
  // When a page is opened straight from the computer (double-clicked) instead
  // of from a website, links to a folder like "simulator/" would show a file
  // list. Point them at the folder's index.html instead. Online, nothing changes.
  function fixFolderLinks(root) {
    if (location.protocol !== 'file:') return;
    root.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (/^[a-z]+:|^#/i.test(href)) return;
      if (href === '' || href === '.' || href === './') href = './';
      if (href.slice(-1) === '/') a.setAttribute('href', href + 'index.html');
    });
  }

  window.WEB3TOYS = { fixFolderLinks: fixFolderLinks };

  document.addEventListener('DOMContentLoaded', function () {
    fixFolderLinks(document);
  });
})();
