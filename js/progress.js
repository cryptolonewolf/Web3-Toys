// Progress and ranks. Saved only in this visitor's browser (localStorage).
// Clearing browser data clears it. No screen code here, so it can be tested.

(function (root) {
  var KEY = 'web3toys.progress.v1';

  function empty() {
    return { name: '', certificates: {} };
  }

  // storage: anything with getItem/setItem (the browser's localStorage).
  function load(storage) {
    try {
      var data = JSON.parse(storage.getItem(KEY) || 'null');
      if (data && typeof data === 'object' && data.certificates) return data;
    } catch (e) {
      // Private windows and blocked storage land here; start fresh.
    }
    return empty();
  }

  function save(storage, data) {
    try {
      storage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  // cert: { toy, title, name, score, date, code }
  // Keeps the best score if the same toy is passed again.
  function addCertificate(data, cert) {
    var old = data.certificates[cert.toy];
    if (!old || cert.score >= old.score) data.certificates[cert.toy] = cert;
    if (cert.name) data.name = cert.name;
    return data;
  }

  function count(data) {
    return Object.keys(data.certificates).length;
  }

  // ranks: [{ min, name, line }] lowest first.
  function rankFor(n, ranks) {
    var rank = ranks[0];
    for (var i = 0; i < ranks.length; i++) if (n >= ranks[i].min) rank = ranks[i];
    return rank;
  }

  function nextRank(n, ranks) {
    for (var i = 0; i < ranks.length; i++) if (ranks[i].min > n) return ranks[i];
    return null;
  }

  // Position of a rank in the list, starting at 1, for the badge.
  function level(rank, ranks) {
    return ranks.indexOf(rank) + 1;
  }

  var api = { KEY: KEY, load: load, save: save, addCertificate: addCertificate, count: count, rankFor: rankFor, nextRank: nextRank, level: level };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Web3Progress = api;
})(this);
