import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { data } from './sim-load.mjs';

const EFFECT_KEYS = new Set(['price', 'hype', 'trust', 'liquidity', 'runway', 'ownership']);
const TRIGGER_KEYS = new Set(['route', 'mm', 'contract', 'priming', 'split', 'stats', 'flag']);

function checkEffects(effects, where) {
  for (const [k, v] of Object.entries(effects)) {
    assert.ok(EFFECT_KEYS.has(k), `${where}: unknown stat "${k}"`);
    assert.ok(Number.isFinite(v), `${where}: ${k} is not a number`);
  }
}

describe('content data', () => {
  it('bucket defaults add up to 100', () => {
    assert.equal(data.BUCKETS.reduce((s, b) => s + b.default, 0), 100);
  });

  it('has the 16 events with unique ids, two responses and a lesson', () => {
    assert.equal(data.EVENTS.length, 16);
    assert.equal(new Set(data.EVENTS.map((e) => e.id)).size, 16);
    for (const e of data.EVENTS) {
      assert.ok(e.title && e.lesson, `event ${e.id}`);
      for (const k of ['a', 'b']) {
        assert.ok(e[k].label && e[k].short, `event ${e.id}${k}`);
        checkEffects(e[k].effects, `event ${e.id}${k}`);
      }
      for (const k of Object.keys(e.trigger)) assert.ok(TRIGGER_KEYS.has(k), `event ${e.id}: unknown trigger "${k}"`);
      for (const d of e.days || []) assert.ok(d >= 1 && d <= data.DAYS, `event ${e.id}: bad day ${d}`);
    }
  });

  it('triggers only name choices that exist', () => {
    const ids = {
      route: data.ROUTES.map((r) => r.id),
      mm: data.MARKET_MAKERS.map((m) => m.id),
      contract: data.CONTRACT_CHOICES.map((c) => c.id),
      priming: data.PRIMING_PLANS.map((p) => p.id),
      split: data.BUCKETS.map((b) => b.id),
      stats: data.STATS.map((s) => s.id),
    };
    for (const e of data.EVENTS) {
      const t = e.trigger;
      for (const k of ['route', 'mm', 'contract']) for (const v of t[k] || []) assert.ok(ids[k].includes(v), `event ${e.id}: ${k} ${v}`);
      if (t.priming) assert.ok(ids.priming.includes(t.priming), `event ${e.id}: priming ${t.priming}`);
      for (const k of Object.keys(t.split || {})) assert.ok(ids.split.includes(k), `event ${e.id}: split ${k}`);
      for (const k of Object.keys(t.stats || {})) assert.ok(ids.stats.includes(k), `event ${e.id}: stat ${k}`);
    }
  });

  it('every choice has valid effects and a short label', () => {
    const lists = [data.RAISES, data.ROUTES, data.MARKET_MAKERS, data.CONTRACT_CHOICES, data.PRIMING_PLANS, [data.PRIMING_NOTHING]];
    for (const list of lists) {
      for (const item of list) {
        assert.ok(item.short, `${item.id} has no short label`);
        checkEffects(item.effects, item.id);
      }
    }
  });

  it('every priming plan costs 1 or 2 points', () => {
    for (const p of data.PRIMING_PLANS) assert.ok(p.cost === 1 || p.cost === 2, p.id);
  });

  it('score weights add up to 1', () => {
    const sum = Object.values(data.SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });
});
