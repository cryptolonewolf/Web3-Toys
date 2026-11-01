// Tests for Fish the Dead Projects: which catch bites, the reeling bar,
// scoring and the catch data. Run: node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const F = require('../js/fish-engine.js');
const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const T = json('data/dead-projects.json');
const catches = json('data/dead_projects.json').catches;

describe('Fish the Dead Projects rules', () => {
  it('a strong cast makes legendary catches more likely', () => {
    assert.ok(F.weight(3, 1) / F.weight(1, 1) > F.weight(3, 0) / F.weight(1, 0));
  });

  it('never repeats a catch in a game while others remain', () => {
    const taken = {};
    for (let i = 0; i < catches.length; i++) {
      const c = F.pickCatch(catches, Math.random(), taken);
      assert.ok(!taken[c.id], c.id);
      taken[c.id] = true;
    }
  });

  it('the green zone fits on the bar and is narrower for rarer catches', () => {
    for (let i = 0; i < 100; i++) {
      for (const r of [1, 2, 3]) {
        const z = F.zone(r);
        assert.ok(z.start >= 0 && z.end <= 1, JSON.stringify(z));
      }
    }
    const w = (r) => { const z = F.zone(r, () => 0.5); return z.end - z.start; };
    assert.ok(w(1) > w(2) && w(2) > w(3));
  });

  it('the marker slides from one end to the other and back', () => {
    assert.equal(F.marker(0, 1000), 0);
    assert.equal(F.marker(500, 1000), 1);
    assert.equal(F.marker(250, 1000), 0.5);
  });

  it('scores rarity plus a streak bonus, and ranks by score', () => {
    assert.equal(F.points(1, 1, T.points, T.streakBonus), 100);
    assert.equal(F.points(3, 3, T.points, T.streakBonus), 500);
    assert.equal(F.rankFor(0, T.ranks).name, 'Bait Dangler');
    assert.equal(F.rankFor(2000, T.ranks).name, 'Kraken Catcher');
  });
});

describe('Fish the Dead Projects catches', () => {
  it('has about 20 real catches, each with a source and marked for review', () => {
    assert.ok(catches.filter((c) => !c.fresh).length >= 18);
    assert.equal(new Set(catches.map((c) => c.id)).size, catches.length);
    for (const c of catches) {
      assert.ok(c.name && c.kind && c.died, c.id);
      if (!c.fresh) assert.ok(c.promised && c.peak, `${c.id}: promised and peak`);
      assert.ok([1, 2, 3].includes(c.rarity), c.id);
      assert.ok(c.year >= 2009 && c.year <= 2026, c.id);
      assert.ok(c.sources.length && c.sources.every((s) => s.label && (c.fresh ? s.url === '' || /^https:\/\//.test(s.url) : /^https:\/\//.test(s.url))), `${c.id} source`);
      assert.ok('review' in c, `${c.id} review`);
      assert.ok(c.died.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length <= 2, `${c.id}: keep it short`);
    }
  });

  it('has the 75 shutdowns from 2026, biting less often than the classics', () => {
    const fresh = catches.filter((c) => c.fresh);
    assert.equal(fresh.length, 75);
    assert.ok(fresh.every((c) => c.year === 2026 && c.weight < 1));
    let classic = 0;
    for (let i = 0; i < 2000; i++) if (!F.pickCatch(catches, 0.5, {}).fresh) classic++;
    assert.ok(classic > 1000, `classic catches bite ${classic} of 2000 times`);
  });

  it('has catches of every rarity', () => {
    for (const r of [1, 2, 3]) assert.ok(catches.some((c) => c.rarity === r), String(r));
  });
});
