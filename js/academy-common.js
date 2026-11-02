// Project Academy: which courses to show, and the progress kept in this
// browser (lessons seen, retry lock). Shared by the Academy pages.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Academy = factory();
})(this, function () {
  var KEY = 'web3toys.academy.v1';
  var LOCK_MINUTES = 10;

  // Shown only when vetted and the sponsorship has not ended yet.
  function visible(course, today) {
    today = today || new Date().toISOString().slice(0, 10);
    return Boolean(course && course.vetted === true && course.sponsored_until && course.sponsored_until >= today);
  }

  function filterCourses(courses, chain, category) {
    return courses.filter(function (c) {
      return (!chain || c.chain === chain) && (!category || c.category === category);
    });
  }

  function load(storage) {
    try { return JSON.parse(storage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }

  function save(storage, data) {
    try { storage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }

  function entry(data, id) {
    data[id] = data[id] || { seen: [], lockUntil: 0 };
    return data[id];
  }

  function allSeen(e, lessons) {
    for (var i = 0; i < lessons; i++) if (e.seen.indexOf(i) === -1) return false;
    return true;
  }

  // After a failed attempt the quiz waits LOCK_MINUTES before a retry.
  function lock(e, now) {
    e.lockUntil = (now || Date.now()) + LOCK_MINUTES * 60000;
  }

  function msLeft(e, now) {
    return Math.max(0, (e.lockUntil || 0) - (now || Date.now()));
  }

  // n random questions from the pool, each with its options shuffled.
  function draw(pool, n, rand) {
    rand = rand || Math.random;
    var shuffle = function (list) {
      var a = list.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var t = a[i];
        a[i] = a[j];
        a[j] = t;
      }
      return a;
    };
    return shuffle(pool).slice(0, n).map(function (q) {
      return { id: q.id, question: q.question, options: shuffle(q.options) };
    });
  }

  return { visible: visible, filterCourses: filterCourses, load: load, save: save, entry: entry, allSeen: allSeen, lock: lock, msLeft: msLeft, draw: draw, LOCK_MINUTES: LOCK_MINUTES };
});
