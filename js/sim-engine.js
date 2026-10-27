// Game state and rules for Launch a Token Simulator. No screen code here, so
// everything can be tested in Node. Content comes from data/simulator.js.
//
// In the browser: SimEngine.create(window.WEB3TOYS_SIM) returns the functions.
// In Node: require('./js/sim-engine.js').create(data).

(function (root) {
  function create(DATA) {
    const { BUCKETS, CONTRACT_CHOICES, CONTRACT_LESSON, DAILY, DAYS, EVENTS, EVENTS_PER_DAY, HYBRID_LISTING, MARKET_MAKERS, PRIMING_BUDGET, PRIMING_LESSON, PRIMING_NOTHING, PRIMING_PLANS, PROJECT_LESSON, PROJECT_TYPES, RAISES, RANKS, ROUTES, ROUTE_LESSON, SCORE_WEIGHTS, SPLIT_LESSON, SPLIT_RULES, START_PRICE } = DATA;

    const STAT_MIN = 0;
    const STAT_MAX = 100;
    const PRICE_MAX = 200;

    // How much one point of each stat is worth when ranking decisions.
    // Roughly follows the score weights; hype counts because it moves price.
    const VALUE_WEIGHTS = {
      price: 0.2,
      trust: 0.25,
      runway: 0.2,
      liquidity: 0.15,
      ownership: 0.4,
      hype: 0.15,
    };

    const byId = (list, id) => {
      const item = list.find((x) => x.id === id);
      if (!item) throw new Error(`Unknown id: ${id}`);
      return item;
    };

    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
    const round1 = (n) => Math.round(n * 10) / 10;

    function clampStat(key, value) {
      if (key === 'price') return round1(clamp(value, STAT_MIN, PRICE_MAX));
      return Math.round(clamp(value, STAT_MIN, STAT_MAX));
    }

    // Seeded random (mulberry32) so a game can be replayed and tested.
    function nextRandom(state) {
      state.rng = (state.rng + 0x6d2b79f5) >>> 0;
      let t = state.rng;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function createGame(seed = Date.now()) {
      return {
        rng: seed >>> 0,
        stats: { price: START_PRICE, hype: 0, trust: 0, liquidity: 0, runway: 0 },
        ownership: 0,
        choices: {
          project: null,
          raise: null,
          split: null,
          route: null,
          mm: null,
          contract: null,
          priming: null,
        },
        flags: {},
        day: 0,
        today: [],
        resolvedToday: [],
        usedEvents: [],
        decisions: [],
        priceHistory: [START_PRICE],
        done: false,
      };
    }

    function getValue(state, key) {
      return key === 'ownership' ? state.ownership : state.stats[key];
    }

    function setValue(state, key, value) {
      if (key === 'ownership') state.ownership = clampStat(key, value);
      else state.stats[key] = clampStat(key, value);
    }

    // Applies stat changes, clamping as it goes. Returns the changes that actually happened.
    function applyEffects(state, effects = {}) {
      const deltas = {};
      for (const [key, change] of Object.entries(effects)) {
        if (!change) continue;
        const before = getValue(state, key);
        setValue(state, key, before + change);
        const actual = round1(getValue(state, key) - before);
        if (actual) deltas[key] = actual;
      }
      return deltas;
    }

    function decisionValue(deltas) {
      let v = 0;
      for (const [key, d] of Object.entries(deltas)) v += (VALUE_WEIGHTS[key] || 0) * d;
      return round1(v);
    }

    function record(state, { step, label, short, lesson, deltas }) {
      const d = { step, label, short, lesson, deltas, value: decisionValue(deltas), knockOn: 0 };
      state.decisions.push(d);
      return d;
    }

    // Step 1
    function chooseProject(state, id) {
      const type = byId(PROJECT_TYPES, id);
      state.choices.project = id;
      Object.assign(state.stats, type.stats, { price: START_PRICE });
      return { lesson: PROJECT_LESSON, deltas: {} };
    }

    // Step 2a
    function chooseRaise(state, id) {
      const raise = byId(RAISES, id);
      state.choices.raise = id;
      const deltas = applyEffects(state, raise.effects);
      record(state, { step: 'raise', label: raise.label, short: raise.short, lesson: raise.desc, deltas });
      return { deltas };
    }

    function defaultSplit(raiseId) {
      const split = Object.fromEntries(BUCKETS.map((b) => [b.id, b.default]));
      const min = raiseId ? byId(RAISES, raiseId).minInvestors : 0;
      if (min && split.investors < min) {
        // Take the difference from the biggest bucket so the total stays at 100.
        const diff = min - split.investors;
        split.investors = min;
        split.liquidity -= diff;
      }
      return split;
    }

    function validateSplit(split, raiseId) {
      const errors = [];
      let total = 0;
      for (const b of BUCKETS) {
        const v = split[b.id];
        if (!Number.isInteger(v) || v < 0 || v > 100) errors.push(`${b.label} must be a whole number from 0 to 100.`);
        total += v;
      }
      if (total !== 100) errors.push(`The split must add up to 100 percent (now ${total}).`);
      const min = raiseId ? byId(RAISES, raiseId).minInvestors : 0;
      if (min && split.investors < min) errors.push(`With this raise, investors need at least ${min} percent.`);
      return errors;
    }

    // Step 2b
    function setSplit(state, split) {
      const errors = validateSplit(split, state.choices.raise);
      if (errors.length) throw new Error(errors.join(' '));
      state.choices.split = { ...split };
      state.ownership = split.team;
      const effects = {};
      const triggered = [];
      for (const rule of SPLIT_RULES) {
        const v = split[rule.bucket];
        if ((rule.gt != null && v > rule.gt) || (rule.lt != null && v < rule.lt)) {
          triggered.push(rule);
          for (const [k, d] of Object.entries(rule.effects)) effects[k] = (effects[k] || 0) + d;
        }
      }
      const deltas = applyEffects(state, effects);
      record(state, {
        step: 'split',
        label: `Split ${BUCKETS.map((b) => split[b.id]).join(' / ')}`,
        short: triggered.length ? triggered[0].short : 'a balanced token split',
        lesson: SPLIT_LESSON,
        deltas,
      });
      return { deltas, triggered, lesson: SPLIT_LESSON };
    }

    // Step 3
    function chooseRoute(state, id) {
      const route = byId(ROUTES, id);
      state.choices.route = id;
      const deltas = applyEffects(state, route.effects);
      record(state, { step: 'route', label: route.label, short: route.short, lesson: route.lesson, deltas });
      return { deltas, lesson: route.lesson, pattern: ROUTE_LESSON };
    }

    // Step 4a
    function chooseMarketMaker(state, id) {
      const mm = byId(MARKET_MAKERS, id);
      state.choices.mm = id;
      const deltas = applyEffects(state, mm.effects);
      record(state, { step: 'mm', label: mm.label, short: mm.short, lesson: mm.lesson, deltas });
      return { deltas, lesson: mm.lesson, needsContract: mm.hasContract };
    }

    // Step 4b, only for deals with a contract
    function chooseContract(state, id) {
      const choice = byId(CONTRACT_CHOICES, id);
      if (!byId(MARKET_MAKERS, state.choices.mm).hasContract) throw new Error('This deal has no contract to review.');
      state.choices.contract = id;
      const deltas = applyEffects(state, choice.effects);
      record(state, { step: 'contract', label: choice.label, short: choice.short, lesson: CONTRACT_LESSON, deltas });
      return { deltas, lesson: CONTRACT_LESSON };
    }

    function primingCost(ids) {
      return ids.reduce((sum, id) => sum + byId(PRIMING_PLANS, id).cost, 0);
    }

    // Step 5. An empty list means "Do nothing".
    function choosePriming(state, ids) {
      if (new Set(ids).size !== ids.length) throw new Error('Each plan can be picked once.');
      if (primingCost(ids) > PRIMING_BUDGET) throw new Error(`The budget is ${PRIMING_BUDGET} points.`);
      state.choices.priming = [...ids];
      const results = [];
      const plans = ids.length ? ids.map((id) => byId(PRIMING_PLANS, id)) : [PRIMING_NOTHING];
      for (const plan of plans) {
        const deltas = applyEffects(state, plan.effects);
        record(state, { step: `priming:${plan.id}`, label: plan.label, short: plan.short, lesson: plan.lesson, deltas });
        results.push({ plan, deltas });
      }
      if (state.choices.route === 'hybrid') state.flags.hybridListing = state.stats.trust > HYBRID_LISTING.minTrust;
      return { results, lesson: PRIMING_LESSON };
    }

    function compare(value, cond) {
      if (cond.lt != null && !(value < cond.lt)) return false;
      if (cond.gt != null && !(value > cond.gt)) return false;
      return true;
    }

    // Pass day = null to ignore the day window.
    function eventMatches(event, state, day = state.day) {
      const t = event.trigger || {};
      const c = state.choices;
      if (day != null && event.days && !event.days.includes(day)) return false;
      if (t.route && !t.route.includes(c.route)) return false;
      if (t.mm && !t.mm.includes(c.mm)) return false;
      if (t.contract && !t.contract.includes(c.contract)) return false;
      if (t.priming && !(c.priming || []).includes(t.priming)) return false;
      if (t.flag && !state.flags[t.flag]) return false;
      for (const [k, cond] of Object.entries(t.split || {})) if (!compare(c.split?.[k], cond)) return false;
      for (const [k, cond] of Object.entries(t.stats || {})) if (!compare(state.stats[k], cond)) return false;
      return true;
    }

    // An event is tied to an earlier choice if its trigger names one.
    function isTied(event) {
      const t = event.trigger || {};
      return Boolean(t.route || t.mm || t.contract || t.priming || t.split || t.flag);
    }

    // Which earlier decision an event follows from, so its cost can be traced back.
    function causeStep(event) {
      const t = event.trigger || {};
      if (t.contract) return 'contract';
      if (t.priming) return `priming:${t.priming}`;
      if (t.mm) return 'mm';
      if (t.split) return 'split';
      if (t.route) return 'route';
      return null;
    }

    const lastDayOf = (e) => (e.days ? Math.max(...e.days) : DAYS);

    // How many of the remaining days are sure to get at least one event.
    // Events that depend on live stats are left out, since stats can move away
    // from their trigger. Greedy: each day takes the event whose window closes soonest.
    function futureCoverage(state, exclude = [], events = EVENTS) {
      const pool = events.filter(
        (e) =>
          !state.usedEvents.includes(e.id) &&
          !exclude.includes(e.id) &&
          !e.trigger?.stats &&
          eventMatches(e, state, null),
      );
      let covered = 0;
      for (let day = state.day + 1; day <= DAYS; day++) {
        const options = pool.filter((e) => !e.days || e.days.includes(day));
        if (!options.length) continue;
        options.sort((x, y) => lastDayOf(x) - lastDayOf(y));
        pool.splice(pool.indexOf(options[0]), 1);
        covered++;
      }
      return covered;
    }

    // Picks today's events. Events whose window closes today go first, then
    // events tied to an earlier choice, then the rest at random. An event is
    // skipped if taking it would leave a later day with nothing to draw, unless
    // the day would otherwise be empty.
    function drawEvents(state, events = EVENTS) {
      const eligible = events
        .filter((e) => !state.usedEvents.includes(e.id) && eventMatches(e, state))
        .map((e) => {
          const lastDay = lastDayOf(e);
          return { e, lastDay, key: [lastDay === state.day ? 0 : 1, isTied(e) ? 0 : 1, lastDay, nextRandom(state)] };
        });
      eligible.sort((x, y) => {
        for (let i = 0; i < x.key.length; i++) if (x.key[i] !== y.key[i]) return x.key[i] - y.key[i];
        return 0;
      });
      const picked = [];
      for (const { e, lastDay } of eligible) {
        if (picked.length >= EVENTS_PER_DAY) break;
        if (lastDay !== state.day) {
          const taken = picked.map((p) => p.id);
          if (futureCoverage(state, [...taken, e.id], events) < futureCoverage(state, taken, events)) continue;
        }
        picked.push(e);
      }
      if (!picked.length && eligible.length) picked.push(eligible[0].e);
      return picked;
    }

    function startDay(state) {
      if (state.day >= DAYS) throw new Error('Launch week is over.');
      state.day += 1;
      let milestone = null;
      if (state.choices.route === 'hybrid' && state.day === HYBRID_LISTING.day) {
        if (state.flags.hybridListing) {
          const deltas = applyEffects(state, HYBRID_LISTING.effects);
          milestone = { title: HYBRID_LISTING.title, text: HYBRID_LISTING.text, deltas };
        } else {
          milestone = { title: 'No exchange listing this week.', text: HYBRID_LISTING.missedText, deltas: {} };
        }
      }
      const drawn = drawEvents(state);
      state.today = drawn.map((e) => e.id);
      state.resolvedToday = [];
      state.usedEvents.push(...state.today);
      return { day: state.day, events: drawn, milestone };
    }

    function resolveEvent(state, eventId, answer) {
      if (!state.today.includes(eventId)) throw new Error(`Event ${eventId} is not on today's list.`);
      if (state.resolvedToday.includes(eventId)) throw new Error(`Event ${eventId} was already answered.`);
      if (answer !== 'a' && answer !== 'b') throw new Error('Answer must be "a" or "b".');
      const event = EVENTS.find((e) => e.id === eventId);
      const response = event[answer];
      const deltas = applyEffects(state, response.effects);
      const decision = record(state, {
        step: `event:${eventId}`,
        label: response.label,
        short: response.short,
        lesson: event.lesson,
        deltas,
      });
      // A bad outcome also counts against the choice that set this event up.
      const cause = causeStep(event);
      if (cause && decision.value < 0) {
        const origin = state.decisions.find((d) => d.step === cause);
        if (origin) origin.knockOn = round1(origin.knockOn + decision.value);
      }
      state.resolvedToday.push(eventId);
      return { deltas, lesson: event.lesson, response };
    }

    // The six daily rules. Pure: takes stats and returns new stats.
    function applyDailyRules(stats, { day, split }, rand = Math.random) {
      const s = { ...stats };
      // 1. Hype falls.
      s.hype = clampStat('hype', s.hype - DAILY.hypeDecay);
      // 2. Price follows hype and trust.
      const drift = DAILY.hypeWeight * (s.hype - 50) + DAILY.trustWeight * (s.trust - 50);
      // 3. Sell pressure from heavy insider buckets, from day 4.
      const heavy = split && (split.investors > DAILY.investorSellAbove || split.team > DAILY.teamSellAbove);
      const pressure = heavy && day >= DAILY.sellPressureFromDay ? -DAILY.sellPressure : 0;
      // 5. Random swing.
      const swing = (rand() * 2 - 1) * DAILY.randomSwing;
      // 4. Thin liquidity doubles every swing, up and down (including the random one).
      const multiplier = s.liquidity < DAILY.thinLiquidityBelow ? 2 : 1;
      const move = (drift + pressure + swing) * multiplier;
      // 6. Keep everything in range.
      s.price = clampStat('price', s.price + move);
      for (const k of ['hype', 'trust', 'liquidity', 'runway']) s[k] = clampStat(k, s[k]);
      return { stats: s, parts: { drift: round1(drift), pressure, swing: round1(swing), multiplier }, move: round1(s.price - stats.price) };
    }

    function endDay(state) {
      if (state.resolvedToday.length !== state.today.length) throw new Error('Answer every event before ending the day.');
      const before = { ...state.stats };
      const result = applyDailyRules(state.stats, { day: state.day, split: state.choices.split }, () => nextRandom(state));
      state.stats = result.stats;
      state.priceHistory.push(state.stats.price);
      if (state.day >= DAYS) state.done = true;
      return { day: state.day, before, after: { ...state.stats }, parts: result.parts, move: result.move, done: state.done };
    }

    function rankFor(score) {
      return RANKS.find((r) => score >= r.min);
    }

    function computeScore(state) {
      const { price, trust, runway, liquidity } = state.stats;
      const priceScore = Math.min(price, 150) / 1.5;
      const ownershipScore = Math.max(0, Math.min(100, state.ownership * 4) - (trust < 40 ? 20 : 0));
      const parts = {
        price: priceScore,
        trust,
        runway,
        liquidity,
        ownership: ownershipScore,
      };
      let total = 0;
      for (const [k, w] of Object.entries(SCORE_WEIGHTS)) total += w * parts[k];
      total = Math.round(clamp(total, 0, 100));
      return { total, parts, rank: rankFor(total) };
    }

    // Most expensive and best decisions, counting knock-on events.
    function summarizeDecisions(state) {
      const ranked = state.decisions
        .map((d) => ({ ...d, total: round1(d.value + d.knockOn) }))
        .sort((a, b) => a.total - b.total);
      const worst = ranked.filter((d) => d.total < 0).slice(0, 3);
      const positive = ranked.filter((d) => d.total > 0);
      const best = positive.length ? positive[positive.length - 1] : null;
      return { worst, best };
    }

    return { STAT_MIN, STAT_MAX, PRICE_MAX, clampStat, nextRandom, createGame, applyEffects, decisionValue, chooseProject, chooseRaise, defaultSplit, validateSplit, setSplit, chooseRoute, chooseMarketMaker, chooseContract, primingCost, choosePriming, eventMatches, isTied, futureCoverage, drawEvents, startDay, resolveEvent, applyDailyRules, endDay, rankFor, computeScore, summarizeDecisions };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SimEngine = api;
})(this);
