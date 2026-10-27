// The "Play the game" logic for Spot the Scam: picking rounds and scoring.
// No screen code here, so it can be tested on its own.

(function (root) {
  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // Picks `settings.rounds` scenarios at random, with at least minScams scams
  // and minLegit legit ones, in a random order.
  function pickRounds(scenarios, settings, rand) {
    rand = rand || Math.random;
    var scams = shuffle(scenarios.filter(function (s) { return s.answer === 'scam'; }), rand);
    var legit = shuffle(scenarios.filter(function (s) { return s.answer === 'legit'; }), rand);
    var picked = scams.slice(0, settings.minScams).concat(legit.slice(0, settings.minLegit));
    var rest = shuffle(scams.slice(settings.minScams).concat(legit.slice(settings.minLegit)), rand);
    picked = picked.concat(rest.slice(0, Math.max(0, settings.rounds - picked.length)));
    return shuffle(picked, rand);
  }

  // verdict: 'scam' or 'legit'. tags: the rule ids the player tagged.
  function scoreRound(scenario, verdict, tags, settings) {
    var p = settings.points;
    var real = scenario.flags || [];
    var spotted = tags.filter(function (t) { return real.indexOf(t) !== -1; });
    var missed = real.filter(function (f) { return tags.indexOf(f) === -1; });
    var extra = tags.filter(function (t) { return real.indexOf(t) === -1; });
    var correct = verdict === scenario.answer;

    var flagPoints = 0;
    if (correct) {
      if (real.length) flagPoints = Math.round((Math.max(0, spotted.length - extra.length) / real.length) * p.redFlags);
      else flagPoints = extra.length ? 0 : p.redFlags;
    }

    return {
      correct: correct,
      points: (correct ? p.rightAnswer : 0) + flagPoints,
      spotted: spotted,
      missed: missed,
      extra: extra,
    };
  }

  function rankFor(score, ranks) {
    for (var i = 0; i < ranks.length; i++) if (score >= ranks[i].min) return ranks[i];
    return ranks[ranks.length - 1];
  }

  var api = { pickRounds: pickRounds, scoreRound: scoreRound, rankFor: rankFor, shuffle: shuffle };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScamGame = api;
})(this);
