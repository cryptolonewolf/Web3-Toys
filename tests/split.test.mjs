// Tests for Rug or Real: picking cards, scoring and the made up tokens.
// Run: node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const S = require('../js/split-engine.js');
const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const T = json('data/token-split.json');
const tokens = json('data/token_splits.json').tokens;

describe('Rug or Real rules', () => {
  it('picks 8 different cards with at least 3 of each kind', () => {
    for (let run = 0; run < 50; run++) {
      const cards = S.pick(tokens, T.rounds);
      assert.equal(cards.length, 8);
      assert.equal(new Set(cards.map((c) => c.id)).size, 8);
      assert.ok(cards.filter((c) => c.verdict === 'rug').length >= 3);
      assert.ok(cards.filter((c) => c.verdict === 'real').length >= 3);
    }
  });

  it('scores right answers with a speed bonus, and nothing for wrong or slow', () => {
    assert.equal(S.points('rug', 'rug', 10000, 10000, 100, 50), 150);
    assert.equal(S.points('rug', 'rug', 0, 10000, 100, 50), 100);
    assert.equal(S.points('real', 'rug', 9000, 10000, 100, 50), 0);
    assert.equal(S.points(null, 'rug', 0, 10000, 100, 50), 0);
  });

  it('ranks go from Rugged to Tokenomics Hawk', () => {
    assert.equal(S.rankFor(0, 1200, T.ranks).name, 'Rugged');
    assert.equal(S.rankFor(1200, 1200, T.ranks).name, 'Tokenomics Hawk');
  });
});

describe('Rug or Real tokens', () => {
  it('has about 20 made up tokens, each split adding up to 100', () => {
    assert.ok(tokens.length >= 16);
    assert.equal(new Set(tokens.map((t) => t.id)).size, tokens.length);
    for (const t of tokens) {
      assert.equal(t.slices.reduce((a, s) => a + s.pct, 0), 100, t.name);
      assert.ok(['rug', 'real'].includes(t.verdict), t.name);
      assert.ok(t.why && t.why.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length === 1, `${t.name}: one line`);
    }
  });

  it('has enough of each kind for a game', () => {
    assert.ok(tokens.filter((t) => t.verdict === 'rug').length >= T.rounds);
    assert.ok(tokens.filter((t) => t.verdict === 'real').length >= T.rounds);
  });
});
