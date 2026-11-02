// Pitch Deck Builder: turns the answers into slides, kept apart from the
// screen so it can be tested.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeckEngine = factory();
})(this, function () {
  function lines(text, max) {
    return String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, max || 4);
  }

  // "Users: 12,000" becomes { label: 'Users', value: '12,000' }.
  function stats(text) {
    return lines(text, 3).map(function (l) {
      var i = l.indexOf(':');
      return i > -1 ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : { label: '', value: l };
    });
  }

  // One slide per step that has something in it. The cover always shows.
  function slides(steps, answers) {
    var out = [];
    steps.forEach(function (s) {
      var a = answers[s.id] || {};
      var slide = {
        id: s.id,
        kicker: s.title,
        name: (a.name || '').trim(),
        headline: (a.headline || '').trim(),
        points: lines(a.points),
        stats: stats(a.stats),
      };
      var empty = !slide.headline && !slide.points.length && !slide.stats.length && !slide.name;
      if (s.id === 'cover' || !empty) out.push(slide);
    });
    var name = (out[0] && out[0].name) || 'Your project';
    out[0].name = name;
    out.forEach(function (sl, i) {
      sl.number = i + 1;
      sl.project = name;
    });
    return out;
  }

  // A plain text outline of the deck, for Copy.
  function outline(deck) {
    return deck.map(function (s) {
      return (s.id === 'cover' ? s.name : s.number + '. ' + s.kicker) + '\n' +
        (s.headline ? s.headline + '\n' : '') +
        s.stats.map(function (x) { return '  ' + (x.label ? x.label + ': ' : '') + x.value; }).join('\n') + (s.stats.length ? '\n' : '') +
        s.points.map(function (p) { return '  - ' + p; }).join('\n');
    }).join('\n\n');
  }

  return { lines: lines, stats: stats, slides: slides, outline: outline };
});
