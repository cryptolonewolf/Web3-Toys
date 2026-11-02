// Tests for the builder tools: the Tokenomics Generator maths and warnings,
// and the tools list. Run: node --test tests/*.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const E = require('../js/tokenomics-engine.js');
const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const cfg = json('data/tools/tokenomics.json');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

const groupsOf = (t) => cfg.groups.map((g) => ({ id: g.id, ...t.groups[g.id] }));

describe('Tokenomics Generator maths', () => {
  it('unlocks the launch share at month 0, waits the cliff, then vests evenly', () => {
    const u = E.groupUnlocks({ pct: 20, tge: 10, cliff: 12, vest: 36 }, 48);
    near(u[0], 2);
    for (let m = 1; m <= 12; m++) near(u[m], 0);
    near(u[13], 18 / 36);
    near(u[48], 18 / 36);
    near(u.reduce((a, b) => a + b, 0), 2 + (18 / 36) * 36);
  });

  it('with no vesting months, the rest unlocks at once when the cliff ends', () => {
    const u = E.groupUnlocks({ pct: 10, tge: 0, cliff: 6, vest: 0 }, 48);
    near(u[6], 10);
    near(u.reduce((a, b) => a + b, 0), 10);
  });

  it('circulating supply reaches 100% once everything has vested', () => {
    for (const t of cfg.templates) {
      const s = E.schedule(groupsOf(t), 120);
      near(s.circulating[120], 100);
      s.circulating.forEach((v, i) => i && assert.ok(v >= s.circulating[i - 1] - 1e-9));
    }
  });

  it('warns about a team with no vesting, too many insiders and a total that is not 100', () => {
    const groups = [
      { id: 'team', pct: 40, tge: 100, cliff: 0, vest: 0 },
      { id: 'investors', pct: 20, tge: 0, cliff: 12, vest: 24 },
      { id: 'community', pct: 30, tge: 0, cliff: 0, vest: 24 },
    ];
    const ids = E.warnings(groups, E.schedule(groups, 48), cfg).map((w) => w.id);
    for (const id of ['notHundred', 'teamNoVesting', 'teamHigh', 'insiders', 'lowLiquidity']) assert.ok(ids.includes(id), id);
  });

  it('balances the groups to exactly 100%', () => {
    const out = E.balance([{ id: 'a', pct: 30 }, { id: 'b', pct: 30 }, { id: 'c', pct: 30 }]);
    assert.equal(out.reduce((s, g) => s + g.pct, 0), 100);
  });
});

describe('Tokenomics Generator settings', () => {
  it('every template covers every group and adds up to 100%', () => {
    for (const t of cfg.templates) {
      assert.deepEqual(Object.keys(t.groups).sort(), cfg.groups.map((g) => g.id).sort(), t.id);
      assert.equal(Object.values(t.groups).reduce((s, g) => s + g.pct, 0), 100, t.id);
    }
  });

  it('every warning rule has its message', () => {
    for (const id of ['notHundred', 'teamNoVesting', 'teamHigh', 'insiders', 'firstYear', 'bigMonth', 'lowLiquidity', 'lowCommunity', 'tgeHigh', 'noTge', 'allGood']) {
      assert.ok(cfg.warnings[id], id);
    }
  });
});

describe('Tools list', () => {
  const tools = json('data/tools/tools.json').tools;
  const home = json('data/home.json');

  it('has the 13 tools in order, live ones with a page and a homepage card', () => {
    assert.equal(tools.length, 13);
    assert.equal(tools[0].id, 'tokenomics');
    const shelf = home.shelves.find((s) => s.id === 'tools');
    for (const t of tools.filter((x) => x.status === 'live')) {
      assert.ok(existsSync(new URL(`../builder/${t.path}index.html`, import.meta.url)), t.id);
      assert.ok(shelf.cards.some((c) => c.path === `builder/${t.path}`), `${t.id} homepage card`);
    }
  });

  it('every tool page says data stays in the browser and is not advice', () => {
    const kit = readFileSync(new URL('../js/tool-kit.js', import.meta.url), 'utf8');
    assert.match(kit, /Your data stays in your browser\./);
    assert.match(kit, /Educational tool, not financial, legal or tax advice\./);
    for (const t of tools.filter((x) => x.status === 'live')) {
      assert.match(readFileSync(new URL(`../builder/${t.path}index.html`, import.meta.url), 'utf8'), /tool-kit\.js/, t.id);
    }
  });
});

describe('Market Cap and FDV Calculator', () => {
  const M = require('../js/mcap-engine.js');
  const cfg = json('data/tools/mcap-fdv.json');

  it('works out market cap, FDV and the gap', () => {
    const r = M.calc(0.5, 200e6, 1e9);
    assert.equal(r.mcap, 100e6);
    assert.equal(r.fdv, 500e6);
    assert.equal(r.gap, 400e6);
    assert.equal(r.circulatingPct, 20);
    assert.ok(r.valid);
    assert.ok(!M.calc(1, 2e9, 1e9).valid, 'circulating above total is not valid');
  });

  it('picks the plain explanation by the share circulating', () => {
    assert.match(M.band(10, cfg.bands).line, /selling pressure/);
    assert.match(M.band(98, cfg.bands).line, /little left to unlock/);
    for (let p = 0; p <= 100; p += 5) assert.ok(M.band(p, cfg.bands).line.includes('{pct}'));
  });

  it('writes money short and readable', () => {
    assert.equal(M.money(100e6), '$100M');
    assert.equal(M.money(2.5e9), '$2.5B');
    assert.equal(M.money(0.42), '$0.42');
  });

  it('example presets are valid', () => {
    for (const p of cfg.presets) assert.ok(M.calc(p.price, p.circulating, p.total).valid, p.label);
  });
});

describe('Launch Budget Planner', () => {
  const B = require('../js/budget-engine.js');
  const cfg = json('data/tools/budget_ranges.json');

  it('works out runway from team and runway reserve', () => {
    assert.equal(B.runway(1000000, { team: 30, runway: 20 }, 50000), 10);
    assert.equal(B.runway(1000000, { team: 30 }, 0), null);
  });

  it('templates add up to 100 and every line has a range', () => {
    for (const t of cfg.templates) assert.equal(Object.values(t.split).reduce((a, b) => a + b, 0), 100, t.id);
    for (const l of cfg.lines) assert.ok(l.min < l.max, l.id);
    assert.equal(cfg.review, true, 'ranges stay marked for review');
  });

  it('warns about no audit, short runway and hype spending', () => {
    const split = { legal: 0, audit: 0, mm: 10, listings: 10, marketing: 30, kols: 20, team: 20, runway: 10 };
    const ids = B.warnings(1000000, split, 100000, cfg).map((w) => w.id);
    for (const id of ['noAudit', 'noLegal', 'hype', 'shortRunway', 'outside']) assert.ok(ids.includes(id), id);
  });
});

describe('Pitch Deck Builder', () => {
  const D = require('../js/deck-engine.js');
  const steps = json('data/tools/pitch-deck.json').steps;
  const templates = json('data/tools/deck_templates.json').templates;

  it('covers every section you asked for, one slide each', () => {
    const ids = steps.map((s) => s.id);
    for (const id of ['problem', 'solution', 'product', 'market', 'traction', 'model', 'token', 'team', 'competition', 'roadmap', 'ask']) assert.ok(ids.includes(id), id);
  });

  it('has 10 templates, each with fonts, colours and a decoration', () => {
    assert.equal(templates.length, 10);
    assert.equal(new Set(templates.map((t) => t.id)).size, 10);
    for (const t of templates) for (const k of ['title', 'body', 'bg', 'fg', 'accent', 'accent2', 'deco']) assert.ok(t[k], `${t.id} ${k}`);
  });

  it('skips empty slides, keeps the cover, numbers them and reads big numbers', () => {
    const deck = D.slides(steps, { cover: { name: 'Lumen' }, traction: { headline: 'Growing', stats: 'Users: 12,000\nDeposits: $4M' } });
    assert.deepEqual(deck.map((s) => s.id), ['cover', 'traction']);
    assert.equal(deck[1].number, 2);
    assert.deepEqual(deck[1].stats[0], { label: 'Users', value: '12,000' });
    assert.equal(D.slides(steps, {})[0].name, 'Your project');
  });
});
