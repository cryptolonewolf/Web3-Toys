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

describe('Cap Table and Dilution Simulator', () => {
  const E = require('../js/cap-engine.js');

  it('a SAFE takes amount over cap, a priced round amount over post-money', () => {
    const r = E.simulate([{ name: 'A', pct: 100 }], [
      { type: 'safe', name: 'SAFE', amount: 1e6, cap: 10e6 },
      { type: 'priced', name: 'Seed', amount: 2e6, pre: 8e6 },
    ]);
    const share = (st, n) => st.holders.find((h) => h.name === n).pct;
    assert.ok(Math.abs(share(r.stages[1], 'SAFE') - 10) < 1e-9);
    assert.ok(Math.abs(share(r.stages[2], 'Seed') - 20) < 1e-9);
    assert.ok(Math.abs(share(r.stages[2], 'A') - 72) < 1e-9);
    assert.ok(Math.abs(r.final.reduce((s, h) => s + h.pct, 0) - 100) < 1e-9);
  });

  it('SAFTs and token warrants promise tokens without changing shares', () => {
    const r = E.simulate([{ name: 'A', pct: 50 }, { name: 'B', pct: 50 }], [
      { type: 'saft', name: 'SAFT', amount: 1e6, fdv: 50e6 },
      { type: 'warrant', name: 'W', tokenPct: 10 },
    ]);
    assert.equal(r.final.length, 2);
    assert.deepEqual(r.tokens.map((t) => [t.name, Math.round(t.pct * 100) / 100]), [['SAFT', 2], ['A', 5], ['B', 5]]);
  });
});

describe('SAFT and Agreement Templates', () => {
  const A = require('../js/agreement-engine.js');
  const index = json('data/tools/templates/index.json');

  it('has the lawyer warning and the three templates, all marked for review', () => {
    assert.equal(index.warning, 'Template only. Have a qualified lawyer in your country review it before signing.');
    assert.deepEqual(index.templates.map((t) => t.id), ['saft', 'advisor', 'kol']);
    index.templates.forEach((t) => {
      const tpl = json(`data/tools/templates/${t.id}.json`);
      assert.equal(tpl.review, true);
      const keys = new Set(tpl.fields.map((f) => f.key));
      const used = JSON.stringify(tpl.sections.concat(tpl.signatures)).match(/\{\{(\w+)\}\}/g).map((m) => m.slice(2, -2));
      used.forEach((k) => assert.ok(keys.has(k), t.id + ' uses unknown blank ' + k));
    });
  });

  it('the KOL agreement requires clear disclosure of paid posts', () => {
    const kol = json('data/tools/templates/kol.json');
    const text = JSON.stringify(kol.sections).toLowerCase();
    assert.ok(text.includes('disclosure of paid posts'));
    assert.ok(text.includes('clearly say it is paid'));
  });

  it('fills blanks and leaves empty ones as [Label]', () => {
    const tpl = { title: 'Deal', fields: [{ key: 'a', label: 'Name' }, { key: 'b', label: 'Fee' }], sections: [{ title: 'T', text: ['{{a}} gets {{b}}'] }], signatures: [] };
    assert.equal(A.doc(tpl, { a: 'Ann' }).sections[0].text[0], 'Ann gets [Fee]');
    assert.deepEqual(A.missing(tpl, { a: 'Ann' }), ['Fee']);
    assert.ok(A.text(tpl, {}, 'WARN').startsWith('WARN'));
  });
});

describe('Meme Coin Launch Kit', () => {
  const M = require('../js/meme-engine.js');
  const kit = json('data/tools/meme-kit.json');

  it('makes 10 different names and tickers from a theme, the same each time', () => {
    const a = M.names('a frog who loves coffee', kit, 0);
    assert.equal(a.length, 10);
    assert.equal(new Set(a.map((x) => x.name)).size, 10);
    assert.equal(new Set(a.map((x) => x.ticker)).size, 10);
    a.forEach((x) => assert.match(x.ticker, /^\$[A-Z]{3,5}$/));
    assert.deepEqual(M.names('a frog who loves coffee', kit, 0), a);
    assert.notDeepEqual(M.names('a frog who loves coffee', kit, 1), a);
    assert.equal(M.names('', kit, 0).length, 10);
  });

  it('never promises returns in its own words', () => {
    const all = [kit.descriptions, kit.stories, kit.bios, kit.posts].flat().join(' ');
    assert.deepEqual(M.banned(all, kit), []);
    assert.deepEqual(M.banned('This will 100x, guaranteed', kit), ['guarantee', 'guaranteed', '100x']);
  });

  it('has the four required Launch responsibly checks and the pump.fun fields', () => {
    assert.equal(kit.review, true);
    const text = kit.checklist.map((c) => c.text).join(' ').toLowerCase();
    ['hidden team wallets', 'team holdings', 'never promise', 'go to zero'].forEach((w) => assert.ok(text.includes(w), w));
    assert.deepEqual(kit.pumpFields.slice(0, 4).map((f) => f.key), ['name', 'ticker', 'description', 'image']);
    assert.ok(M.copy('cats', { name: 'Cat', ticker: '$CAT' }, kit, 0).bio.length <= 160);
  });
});

describe('KOL Vetting Scorecard', () => {
  const Kol = require('../js/kol-engine.js');
  const kc = json('data/tools/kol-scorecard.json');
  const good = { followers: 50000, likes: 1200, replies: 150, growth: 4, paidShare: 10, disclosure: 'always', promoted: 5, died: 0 };

  it('points add up to 100 and a clean account scores 100', () => {
    assert.equal(kc.review, true);
    assert.equal(kc.checks.reduce((a, c) => a + Math.max(...(c.options || c.bands).map((b) => b.points)), 0), 100);
    const s = Kol.score(good, kc);
    assert.equal(s.total, 100);
    assert.equal(s.flags.length, 0);
    assert.equal(s.grade.label, 'Looks solid');
  });

  it('flags bought followers and undisclosed promos', () => {
    const s = Kol.score({ ...good, likes: 40, replies: 0, growth: 120, disclosure: 'never', paidShare: 80, died: 4 }, kc);
    const ids = s.flags.map((f) => f.id);
    ['engagement', 'replyRatio', 'growth', 'disclosure', 'paidShare', 'deadShare'].forEach((id) => assert.ok(ids.includes(id), id));
    assert.ok(s.flags.find((f) => f.id === 'growth').reason.includes('bought followers'));
    assert.equal(s.grade.label, 'Walk away');
  });

  it('works out views, clicks, cost per 1,000 views and per click', () => {
    const r = Kol.roi({ followers: 100000, viewPct: 10, clickPct: 2, cost: 1000 });
    assert.deepEqual(r, { views: 10000, clicks: 200, cpm: 100, cpc: 5 });
    assert.equal(Kol.roi({ followers: 0, viewPct: 10, clickPct: 2, cost: 1000 }).cpc, null);
  });
});

describe('Airdrop Campaign Planner', () => {
  const A = require('../js/airdrop-engine.js');
  const ac = json('data/tools/airdrop.json');

  it('tiers share the whole airdrop and the timeline follows the snapshot', () => {
    assert.equal(ac.review, true);
    assert.equal(ac.tiers.reduce((s, t) => s + t.walletPct, 0), 100);
    assert.equal(ac.tiers.reduce((s, t) => s + t.tokenPct, 0), 100);
    const p = A.plan({ ...ac.defaults, snapshot: '2026-12-01' }, ac);
    assert.equal(p.tokens, 50e6);
    assert.ok(Math.abs(p.shares.reduce((s, x) => s + x.tokens, 0) - 50e6) < 1e-6);
    assert.equal(p.steps[0].date, '2026-12-01');
    assert.equal(p.steps.find((s) => s.label === 'Claim closes').date, A.addDays('2026-12-01', 21 + 60));
  });

  it('warns about a huge airdrop, a short claim window and no anti-farming', () => {
    const p = A.plan({ ...ac.defaults, airdropPct: 30, claimDays: 7, anti: {}, atClaimPct: 100 }, ac);
    assert.equal(p.warnings.length, 4);
    assert.equal(A.plan({ ...ac.defaults, snapshot: '2026-12-01' }, ac).warnings.length, 0);
  });
});

describe('Official Links Checker', () => {
  const L = require('../js/links-engine.js');
  const od = json('data/tools/official_domains.json');
  const kind = (u) => L.check(u, od).kind;

  it('matches official domains and their subdomains', () => {
    assert.equal(od.review, true);
    ['binance.com', 'https://www.binance.com/en/login', 'accounts.binance.com', 'jup.ag', 'phantom.app'].forEach((u) => assert.equal(kind(u), 'match', u));
  });

  it('spots look-alikes', () => {
    ['binance-support.com', 'blnance.com', 'binance.org', 'metamsk.io', 'rnetamask.io', 'https://binance.com@evil.io', 'etherscan.io.verify-wallet.xyz', 'https://xn--bnance-zta.com', '192.168.1.1']
      .forEach((u) => assert.equal(kind(u), 'similar', u));
  });

  it('says not on our list otherwise, and never calls a link safe', () => {
    assert.equal(kind('example.org'), 'unknown');
    assert.equal(kind('hello'), 'invalid');
    assert.ok(!JSON.stringify(od.results).toLowerCase().includes('safe'));
    assert.ok(od.always.includes('cannot tell if a page, message or request is safe'));
    assert.equal(od.results.match.title, 'Matches the official domain');
    assert.equal(od.results.similar.title, 'Looks similar, be careful');
    assert.equal(od.results.unknown.title, 'Not on our list');
  });
});

describe('Gas and Unit Converter', () => {
  const G = require('../js/gas-engine.js');
  const gc = json('data/tools/gas.json');

  it('converts exactly, with no rounding errors', () => {
    assert.equal(G.toBase('0.1', 18), 100000000000000000n);
    assert.equal(G.fromBase(G.toBase('0.1', 18), 9), '100000000');
    assert.equal(G.fromBase(1n, 18), '0.000000000000000001');
    assert.equal(G.toBase('1,234.5', 9), 1234500000000n);
    assert.equal(G.toBase('1e-9', 18), 1000000000n);
    assert.equal(G.toBase('abc', 9), null);
    assert.equal(G.group('1234567.891'), '1,234,567.891');
  });

  it('estimates fees from gas price and signatures', () => {
    assert.equal(gc.review, true);
    assert.equal(gc.actions.find((a) => a.id === 'send').gas, 21000);
    assert.equal(G.fromBase(G.evmFee(21000, 5), 18), '0.000105');
    assert.equal(G.fromBase(G.evmFee(21000, 0.5), 9), '10500');
    assert.equal(G.solFee(2, gc.sol.baseFeeLamports, 1000), 11000n);
  });
});

describe('Launch Readiness Checklist', () => {
  const LE = require('../js/launch-engine.js');
  const lc = json('data/tools/launch-checklist.json');

  it('has about 30 checks across the six areas, and a report link to fill in', () => {
    assert.equal(lc.review, true);
    assert.ok(lc.checks.length >= 28 && lc.checks.length <= 32);
    assert.deepEqual(lc.categories.map((c) => c.id), ['token', 'legal', 'security', 'community', 'marketing', 'liquidity']);
    lc.categories.forEach((c) => assert.ok(lc.checks.some((x) => x.category === c.id), c.id));
    assert.equal(new Set(lc.checks.map((c) => c.id)).size, lc.checks.length);
    assert.equal(lc.reportLabel, 'Get the full Launch Readiness Report');
    assert.ok('reportUrl' in lc);
  });

  it('scores yes, partly and no, and lists gaps biggest first', () => {
    const all = (a) => Object.fromEntries(lc.checks.map((c) => [c.id, a]));
    assert.equal(LE.score(all('yes'), lc).score, 100);
    assert.equal(LE.score(all('yes'), lc).gaps.length, 0);
    assert.equal(LE.score(all('partly'), lc).score, 50);
    assert.equal(LE.score({}, lc).score, 0);
    const r = LE.score({ ...all('yes'), s1: 'no', t5: 'partly' }, lc);
    assert.deepEqual(r.gaps.map((g) => g.id), ['s1', 't5']);
    assert.equal(r.categories.find((c) => c.id === 'security').pct, Math.round(12 / 17 * 100));
  });
});
