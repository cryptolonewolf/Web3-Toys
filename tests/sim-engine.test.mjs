import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { data, engine } from './sim-load.mjs';
import { STRONGEST, WEAKEST, bestAnswer, playGame, worstAnswer } from './sim-helpers.mjs';

const { MARKET_MAKERS, PRIMING_PLANS, PROJECT_TYPES, RAISES, ROUTES } = data;

const half = () => 0.5; // random swing of exactly 0

describe('daily rules', () => {
  const base = { price: 100, hype: 60, trust: 70, liquidity: 50, runway: 50 };
  const split = { team: 15, investors: 20, community: 30, liquidity: 35 };

  it('drops hype by 5, then moves price by 0.3 x (hype - 50) + 0.2 x (trust - 50)', () => {
    const { stats } = engine.applyDailyRules(base, { day: 1, split }, half);
    assert.equal(stats.hype, 55);
    assert.equal(stats.price, 105.5); // 0.3 * 5 + 0.2 * 20
  });

  it('adds sell pressure of 3 from day 4 when Team is above 25', () => {
    const heavy = { ...split, team: 26, liquidity: 24 };
    assert.equal(engine.applyDailyRules(base, { day: 3, split: heavy }, half).stats.price, 105.5);
    assert.equal(engine.applyDailyRules(base, { day: 4, split: heavy }, half).stats.price, 102.5);
  });

  it('adds sell pressure of 3 from day 4 when Investors is above 30', () => {
    const heavy = { ...split, investors: 31, liquidity: 24 };
    assert.equal(engine.applyDailyRules(base, { day: 4, split: heavy }, half).stats.price, 102.5);
    const edge = { ...split, investors: 30, liquidity: 25 };
    assert.equal(engine.applyDailyRules(base, { day: 4, split: edge }, half).stats.price, 105.5);
  });

  it('doubles the move when Liquidity is below 30', () => {
    const thin = { ...base, liquidity: 29 };
    assert.equal(engine.applyDailyRules(thin, { day: 1, split }, half).stats.price, 111);
    const atEdge = { ...base, liquidity: 30 };
    assert.equal(engine.applyDailyRules(atEdge, { day: 1, split }, half).stats.price, 105.5);
  });

  it('adds a random swing between -8 and +8', () => {
    const flat = { price: 100, hype: 55, trust: 50, liquidity: 50, runway: 50 }; // drift 0 after decay
    assert.equal(engine.applyDailyRules(flat, { day: 1, split }, () => 0).stats.price, 92);
    assert.equal(engine.applyDailyRules(flat, { day: 1, split }, () => 0.999999).stats.price, 108);
  });

  it('keeps price between 0 and 200 and stats between 0 and 100', () => {
    const high = { price: 199, hype: 100, trust: 100, liquidity: 10, runway: 100 };
    const r1 = engine.applyDailyRules(high, { day: 1, split }, () => 0.999999);
    assert.equal(r1.stats.price, 200);
    const low = { price: 3, hype: 0, trust: 0, liquidity: 0, runway: 0 };
    const r2 = engine.applyDailyRules(low, { day: 5, split: { ...split, team: 50 } }, () => 0);
    assert.equal(r2.stats.price, 0);
    assert.equal(r2.stats.hype, 0);
  });

  it('does not change the input object', () => {
    const copy = { ...base };
    engine.applyDailyRules(base, { day: 1, split }, half);
    assert.deepEqual(base, copy);
  });
});

describe('scoring', () => {
  const withStats = (stats, ownership) => ({ ...engine.createGame(1), stats: { ...stats }, ownership });

  it('gives 100 for maxed stats and ownership', () => {
    const s = withStats({ price: 150, hype: 0, trust: 100, liquidity: 100, runway: 100 }, 25);
    assert.equal(engine.computeScore(s).total, 100);
    assert.equal(engine.computeScore(s).rank.label, 'Launch Legend');
  });

  it('caps price at 150', () => {
    const a = withStats({ price: 150, hype: 0, trust: 50, liquidity: 50, runway: 50 }, 15);
    const b = withStats({ price: 200, hype: 0, trust: 50, liquidity: 50, runway: 50 }, 15);
    assert.equal(engine.computeScore(a).total, engine.computeScore(b).total);
  });

  it('matches the formula from the spec', () => {
    const s = withStats({ price: 120, hype: 40, trust: 55, liquidity: 45, runway: 60 }, 15);
    // 0.30*80 + 0.25*55 + 0.20*60 + 0.15*45 + 0.10*60 = 24 + 13.75 + 12 + 6.75 + 6
    assert.equal(engine.computeScore(s).total, 63);
  });

  it('takes 20 off ownership when Trust is below 40', () => {
    const ok = withStats({ price: 0, hype: 0, trust: 40, liquidity: 0, runway: 0 }, 25);
    const low = withStats({ price: 0, hype: 0, trust: 39, liquidity: 0, runway: 0 }, 25);
    assert.equal(engine.computeScore(ok).parts.ownership, 100);
    assert.equal(engine.computeScore(low).parts.ownership, 80);
  });

  it('never gives a negative ownership score', () => {
    const s = withStats({ price: 0, hype: 0, trust: 0, liquidity: 0, runway: 0 }, 2);
    assert.equal(engine.computeScore(s).parts.ownership, 0);
    assert.equal(engine.computeScore(s).total, 0);
  });

  it('maps score bands to ranks', () => {
    const cases = [
      [0, 'Rekt Founder'],
      [24, 'Rekt Founder'],
      [25, 'Survived Day One'],
      [44, 'Survived Day One'],
      [45, 'Steady Launcher'],
      [64, 'Steady Launcher'],
      [65, 'Sharp Operator'],
      [84, 'Sharp Operator'],
      [85, 'Launch Legend'],
      [100, 'Launch Legend'],
    ];
    for (const [score, label] of cases) assert.equal(engine.rankFor(score).label, label, `score ${score}`);
  });
});

describe('setup steps', () => {
  it('sets the starting stats from the project type', () => {
    const s = engine.createGame(1);
    engine.chooseProject(s, 'meme');
    assert.deepEqual(s.stats, { price: 100, hype: 65, trust: 30, liquidity: 40, runway: 55 });
  });

  it('rejects a split that does not add to 100', () => {
    const s = engine.createGame(1);
    engine.chooseProject(s, 'defi');
    engine.chooseRaise(s, '2m');
    assert.throws(() => engine.setSplit(s, { team: 15, investors: 20, community: 30, liquidity: 30 }), /add up to 100/);
  });

  it('enforces 25 percent for investors with a 5M raise', () => {
    const s = engine.createGame(1);
    engine.chooseProject(s, 'defi');
    engine.chooseRaise(s, '5m');
    assert.throws(() => engine.setSplit(s, { team: 15, investors: 20, community: 30, liquidity: 35 }), /at least 25/);
    assert.deepEqual(engine.defaultSplit('5m'), { team: 15, investors: 25, community: 30, liquidity: 30 });
  });

  it('applies split rules and sets founder ownership from Team', () => {
    const s = engine.createGame(1);
    engine.chooseProject(s, 'defi');
    engine.chooseRaise(s, '2m');
    const { deltas } = engine.setSplit(s, { team: 30, investors: 51, community: 9, liquidity: 10 });
    assert.deepEqual(deltas, { trust: -10, hype: -10, liquidity: -15 });
    assert.equal(s.ownership, 30);
  });

  it('exchange route lowers founder ownership by 3', () => {
    const s = engine.createGame(1);
    engine.chooseProject(s, 'defi');
    engine.chooseRaise(s, '2m');
    engine.setSplit(s, engine.defaultSplit('2m'));
    engine.chooseRoute(s, 'exchange');
    assert.equal(s.ownership, 12);
  });

  it('only asks about the contract for deals that have one', () => {
    const s = engine.createGame(1);
    engine.chooseProject(s, 'defi');
    engine.chooseRaise(s, '2m');
    engine.setSplit(s, engine.defaultSplit('2m'));
    engine.chooseRoute(s, 'dex');
    assert.equal(engine.chooseMarketMaker(s, 'none').needsContract, false);
    assert.throws(() => engine.chooseContract(s, 'lawyer'), /no contract/);
  });

  it('keeps community priming within the 3 point budget', () => {
    const s = engine.createGame(1);
    assert.throws(() => engine.choosePriming(s, ['influencer', 'builders']), /budget/);
    assert.throws(() => engine.choosePriming(s, ['quest', 'quest']), /once/);
  });
});

describe('launch week events', () => {
  const plan = (over) => ({ ...STRONGEST, ...over });

  it('day 1 includes the sniping event for a DEX launch with a thin liquidity bucket', () => {
    const { seen } = playGame(7, plan({ route: 'dex', split: { team: 20, investors: 20, community: 50, liquidity: 10 } }), bestAnswer);
    assert.ok(seen.some((e) => e.day === 1 && e.id === 1));
  });

  it('no sniping event when the liquidity bucket is 15 or more', () => {
    const { seen } = playGame(7, plan({ route: 'hybrid' }), bestAnswer);
    assert.ok(!seen.some((e) => e.id === 1));
  });

  it('day 1 includes the listing delay for the exchange route', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { seen } = playGame(seed, plan({ route: 'exchange' }), bestAnswer);
      assert.ok(seen.some((e) => e.day === 1 && e.id === 2), `seed ${seed}`);
    }
  });

  it('a signed loan deal triggers the market maker dump on day 3, a lawyer prevents it', () => {
    const signed = playGame(3, plan({ mm: 'loan', contract: 'sign' }), bestAnswer);
    assert.ok(signed.seen.some((e) => e.day === 3 && e.id === 5));
    const reviewed = playGame(3, plan({ mm: 'loan', contract: 'lawyer' }), bestAnswer);
    assert.ok(!reviewed.seen.some((e) => e.id === 5));
  });

  it('no market maker triggers the liquidity crunch on day 3 or 4', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { seen } = playGame(seed, plan({ mm: 'none' }), bestAnswer);
      const hit = seen.find((e) => e.id === 6);
      assert.ok(hit && (hit.day === 3 || hit.day === 4), `seed ${seed}`);
    }
  });

  it('priming choices unlock their events', () => {
    const { seen } = playGame(5, plan({ priming: ['influencer', 'quest'] }), bestAnswer);
    assert.ok(seen.some((e) => e.id === 3));
    assert.ok(seen.some((e) => e.id === 4));
  });

  it('never shows an event twice, never more than 2 a day, and fills every day', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { seen } = playGame(seed, seed % 2 ? STRONGEST : WEAKEST, seed % 3 ? bestAnswer : worstAnswer);
      const ids = seen.map((e) => e.id);
      assert.equal(new Set(ids).size, ids.length);
      for (let day = 1; day <= 7; day++) {
        const n = seen.filter((e) => e.day === day).length;
        assert.ok(n >= 1 && n <= 2, `seed ${seed} day ${day} had ${n} events`);
      }
    }
  });

  it('cannot end a day with unanswered events', () => {
    const s = engine.createGame(1);
    engine.chooseProject(s, 'defi');
    engine.chooseRaise(s, '2m');
    engine.setSplit(s, engine.defaultSplit('2m'));
    engine.chooseRoute(s, 'exchange');
    engine.chooseMarketMaker(s, 'retainer');
    engine.chooseContract(s, 'lawyer');
    engine.choosePriming(s, []);
    engine.startDay(s);
    assert.throws(() => engine.endDay(s), /Answer every event/);
  });

  it('hybrid route lands the later listing on day 5 only if Trust was above 50', () => {
    const good = engine.createGame(1);
    engine.chooseProject(good, 'infra');
    engine.chooseRaise(good, '2m');
    engine.setSplit(good, engine.defaultSplit('2m'));
    engine.chooseRoute(good, 'hybrid');
    engine.chooseMarketMaker(good, 'retainer');
    engine.chooseContract(good, 'lawyer');
    engine.choosePriming(good, ['community']);
    assert.equal(good.flags.hybridListing, true);

    const bad = engine.createGame(1);
    engine.chooseProject(bad, 'meme');
    engine.chooseRaise(bad, '2m');
    engine.setSplit(bad, engine.defaultSplit('2m'));
    engine.chooseRoute(bad, 'hybrid');
    engine.chooseMarketMaker(bad, 'none');
    engine.choosePriming(bad, []);
    assert.equal(bad.flags.hybridListing, false);
  });
});

describe('fixed scenarios', () => {
  it('all strongest choices reach a high rank', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { score } = playGame(seed, STRONGEST, bestAnswer);
      assert.ok(score.total >= 65, `seed ${seed} scored ${score.total}`);
    }
  });

  it('all weakest choices end low', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { score } = playGame(seed, WEAKEST, worstAnswer);
      assert.ok(score.total < 45, `seed ${seed} scored ${score.total}`);
    }
  });

  it('strongest beats weakest on the same seed', () => {
    for (let seed = 1; seed <= 25; seed++) {
      assert.ok(playGame(seed, STRONGEST, bestAnswer).score.total > playGame(seed, WEAKEST, worstAnswer).score.total);
    }
  });

  it('the same seed and choices give the same game', () => {
    assert.deepEqual(playGame(42, STRONGEST, bestAnswer).state, playGame(42, STRONGEST, bestAnswer).state);
  });

  it('weakest play names a most expensive decision; strongest names a best one', () => {
    const weak = engine.summarizeDecisions(playGame(9, WEAKEST, worstAnswer).state);
    assert.ok(weak.worst.length > 0 && weak.worst.length <= 3);
    assert.ok(weak.worst.every((d, i, a) => i === 0 || a[i - 1].total <= d.total));
    const strong = engine.summarizeDecisions(playGame(9, STRONGEST, bestAnswer).state);
    assert.ok(strong.best && strong.best.total > 0);
  });
});

describe('ranges', () => {
  it('no stat ever leaves its range, across random play', () => {
    const pick = (s, list) => list[Math.floor(engine.nextRandom(s) * list.length)];
    const primingOptions = [[], ['influencer'], ['quest', 'community'], ['builders', 'quest'], ['influencer', 'community'], ['community']];
    const inRange = (state) => {
      for (const [k, v] of Object.entries(state.stats)) {
        const max = k === 'price' ? 200 : 100;
        assert.ok(v >= 0 && v <= max && Number.isFinite(v), `${k} = ${v}`);
      }
      assert.ok(state.ownership >= 0 && state.ownership <= 100, `ownership = ${state.ownership}`);
    };
    for (let seed = 1; seed <= 500; seed++) {
      const r = { rng: seed * 7919 };
      const raise = pick(r, RAISES).id;
      const team = Math.floor(engine.nextRandom(r) * 60);
      const min = raise === '5m' ? 25 : 0;
      const investors = min + Math.floor(engine.nextRandom(r) * (100 - team - min));
      const community = Math.floor(engine.nextRandom(r) * (100 - team - investors + 1));
      const plan = {
        project: pick(r, PROJECT_TYPES).id,
        raise,
        split: { team, investors, community, liquidity: 100 - team - investors - community },
        route: pick(r, ROUTES).id,
        mm: pick(r, MARKET_MAKERS).id,
        contract: pick(r, ['lawyer', 'sign']),
        priming: pick(r, primingOptions),
      };
      const { score } = playGame(seed, plan, () => pick(r, ['a', 'b']), inRange);
      assert.ok(score.total >= 0 && score.total <= 100);
    }
    assert.ok(PRIMING_PLANS.length > 0);
  });
});
