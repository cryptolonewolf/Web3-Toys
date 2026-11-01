// Tests for The Vault Dive: guess scoring, the slider scale and the hack data.
// Run: node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const V = require('../js/vault-engine.js');
const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const T = json('data/web3-hacks.json');

describe('Vault Dive scoring', () => {
  it('gives 100 points within 10 percent, either way', () => {
    assert.equal(V.points(105e6, 100e6, 1.1, 4), 100);
    assert.equal(V.points(92e6, 100e6, 1.1, 4), 100);
  });

  it('gives 0 points at 4 times off, and something in between', () => {
    assert.equal(V.points(400e6, 100e6, 1.1, 4), 0);
    assert.equal(V.points(25e6, 100e6, 1.1, 4), 0);
    const mid = V.points(200e6, 100e6, 1.1, 4);
    assert.ok(mid > 0 && mid < 100, String(mid));
    assert.equal(V.points(200e6, 100e6, 1.1, 4), V.points(50e6, 100e6, 1.1, 4));
  });

  it('the slider covers $1 million to $3 billion and can land near every hack', () => {
    assert.equal(V.sliderToAmount(0), 1e6);
    assert.equal(V.sliderToAmount(V.STEPS), 3e9);
    for (const h of json('data/hacks.json').hacks) {
      const near = V.sliderToAmount(V.amountToSlider(h.amountUsd));
      assert.equal(V.points(near, h.amountUsd, T.closeRatio, T.farRatio), 100, h.id);
    }
  });

  it('ranks rise with the share of points', () => {
    assert.equal(V.rankFor(0, 1200, T.ranks).name, 'Vault Tourist');
    assert.equal(V.rankFor(1200, 1200, T.ranks).name, 'Vault Oracle');
  });

  it('writes amounts in millions and billions', () => {
    assert.equal(V.money(190e6), '$190M');
    assert.equal(V.money(1.5e9), '$1.5B');
  });
});

describe('Vault Dive data', () => {
  const data = json('data/hacks.json');

  it('has about 12 hacks, smallest first, each with a source and marked for review', () => {
    assert.ok(data.hacks.length >= 10 && data.hacks.length <= 14);
    data.hacks.forEach((h, i) => {
      assert.ok(h.name && h.year && h.what && h.lesson, h.id);
      assert.match(h.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(h.amountUsd > 0);
      if (i) assert.ok(h.amountUsd >= data.hacks[i - 1].amountUsd, `${h.id} out of order`);
      assert.ok(h.sources.length && h.sources.every((s) => /^https:\/\//.test(s.url)), `${h.id} source`);
      assert.ok('review' in h, `${h.id} review flag`);
    });
  });

  it('keeps each text piece short', () => {
    for (const h of data.hacks) {
      for (const t of [h.what, h.lesson]) assert.ok(t.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length <= 2, `${h.id}: ${t}`);
    }
  });

  it('has a certificate entry and a quiz', () => {
    const entry = json('quizzes/index.json').toys.find((t) => t.id === 'web3-hacks');
    assert.ok(entry && entry.letter === 'E');
    const q = json('quizzes/web3-hacks.json').questions;
    assert.ok(q.length >= 5 && q.length <= 8);
    for (const x of q) assert.equal(x.options.filter((o) => o === x.answer).length, 1, x.id);
  });
});
