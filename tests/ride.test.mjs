// Tests for Ride the Chart: the hold or sell rules, the result numbers and
// the price files. Run: node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const R = require('../js/ride-engine.js');
const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const T = json('data/invest-100.json');

// 10 -> 20 (peak) -> 13 (-35%) -> 7 (-65%) -> 3 (-85%) -> 6 -> 25 (new peak) -> 30
const PRICES = [10, 20, 13, 7, 3, 6, 25, 30].map((p, i) => [`2020-${String(i + 1).padStart(2, '0')}`, p]);

function rideTo(choices) {
  const s = R.create(PRICES, 0, { tiers: [30, 60, 80], rejoinRise: 50 });
  const pauses = [];
  while (!R.done(s)) {
    const pause = R.step(s);
    if (pause) {
      pauses.push(pause);
      R.decide(s, pause, choices.shift() || 'hold');
    }
  }
  return { s, pauses, sum: R.summary(s, T.ranks) };
}

describe('Ride the Chart rules', () => {
  it('pauses at each drop tier: 30, 60 and 80 percent below the peak', () => {
    const { pauses } = rideTo(['hold', 'hold', 'hold']);
    assert.deepEqual(pauses.map((p) => p.type), ['drop', 'drop', 'drop']);
    assert.deepEqual(pauses.map((p) => p.pct), [35, 65, 85]);
  });

  it('holding all the way matches simply holding and scores 100, Diamond Hands', () => {
    const { sum } = rideTo(['hold', 'hold', 'hold']);
    assert.equal(Math.round(sum.finalValue), 300);
    assert.equal(sum.score, 100);
    assert.equal(sum.rank.name, 'Diamond Hands');
    assert.equal(sum.biggestDrop, 85);
    assert.equal(Math.round(sum.worstValue), 30);
    assert.equal(sum.bigDrops, 1);
  });

  it('selling at the bottom and staying out keeps the low value and ranks low', () => {
    const { sum } = rideTo(['hold', 'hold', 'sell', 'stay-out']);
    assert.equal(Math.round(sum.finalValue), 30);
    assert.equal(sum.score, 10);
    assert.equal(sum.rank.name, 'Steady Hands');
  });

  it('offers one chance to jump back in after a 50 percent bounce', () => {
    const { pauses, sum } = rideTo(['sell', 'rejoin']);
    assert.deepEqual(pauses.map((p) => p.type), ['drop', 'rejoin']);
    // Sold at 13 ($130), bought back at 6 (a 100% bounce off 3), rode to 30.
    assert.equal(Math.round(sum.finalValue), 650);
    assert.ok(sum.beatHold);
    assert.equal(sum.score, 100);
    assert.equal(sum.rank.name, 'Paper Hands');
  });

  it('a calm ride with no big drops is a Smooth Rider', () => {
    const calm = [1, 1.1, 1.2, 1.3].map((p, i) => [`2021-0${i + 1}`, p]);
    const s = R.create(calm, 0, {});
    while (!R.done(s)) assert.equal(R.step(s), null);
    assert.equal(R.summary(s, T.ranks).rank.name, 'Smooth Rider');
  });

  it('leaves at least minMonths of ride when picking a start', () => {
    assert.equal(R.lastStart(PRICES, 3), 4);
    assert.equal(R.lastStart(PRICES.slice(0, 2), 12), 0);
  });
});

describe('Ride the Chart data', () => {
  const index = json('data/prices/index.json');

  it('ranks go from Paper Hands to Diamond Hands, in order', () => {
    const list = T.ranks.list;
    assert.equal(list[0].name, 'Paper Hands');
    assert.equal(list.at(-1).name, 'Diamond Hands');
    list.forEach((r, i) => i && assert.ok(r.min > list[i - 1].min));
  });

  it('says past results do not predict the future', () => {
    assert.match(T.pastNote, /past results do not predict the future/i);
  });

  it('every token has a price file with months in order and real prices', () => {
    for (const t of index.tokens) {
      assert.ok(existsSync(new URL(`../data/prices/${t.id}.json`, import.meta.url)), t.id);
      const f = json(`data/prices/${t.id}.json`);
      assert.ok(f.monthly.length >= 13, `${t.id}: needs at least 13 months`);
      f.monthly.forEach(([m, p], i) => {
        assert.match(m, /^\d{4}-\d{2}$/);
        assert.ok(p > 0, `${t.id} ${m}`);
        if (i) assert.ok(m > f.monthly[i - 1][0], `${t.id}: ${m} out of order`);
      });
      if (!index.sample) assert.ok(f.source && f.sourceUrl && f.snapshot && 'review' in f, `${t.id}: source, snapshot and review`);
    }
  });

  it('real price lists have a source and are marked for review', () => {
    if (index.sample) return;
    assert.ok(index.source && index.sourceUrl && index.snapshot);
    assert.equal(index.tokens.length, 15);
  });
});
