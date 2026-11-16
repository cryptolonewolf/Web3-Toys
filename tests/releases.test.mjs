// Scheduled releases: data/releases.json, the rule in js/releases.js and
// the server lock in middleware.js.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const json = (p) => JSON.parse(read(p));
const require = createRequire(import.meta.url);
const browser = require('../js/releases.js');
const mw = await import('data:text/javascript;base64,' + Buffer.from(read('middleware.js')).toString('base64'));

const rel = browser.expand(json('data/releases.json'));
const cards = {};
json('data/home.json').shelves.forEach((s) => s.cards.forEach((c) => { cards[c.id] = c; }));

describe('Release schedule', () => {
  it('has the agreed schedule (16 Nov 2026), each item once, with a hook and a persona', () => {
    const want = [
      ['2026-11-16', ['crypto-in-5', 'scam', 'invest-100', 'dead-projects', 'builder/tokenomics']],
      ['2026-11-19', ['web3-hacks']],
      ['2026-11-23', ['dont-lose-money']],
      ['2026-11-26', ['builder/pitch-deck', 'builder/launch-budget']],
      ['2026-11-30', ['token-split', 'builder/kol-scorecard']],
      ['2026-12-03', ['getting-started', 'builder/links-checker']],
      ['2026-12-07', ['earn-small', 'builder/launch-checklist']],
      ['2026-12-10', ['builder/cap-table', 'builder/agreements', 'builder/airdrop-planner', 'builder/mcap-fdv', 'builder/gas-converter', 'builder/meme-kit']],
      ['2026-12-14', ['roles-in-web3']],
    ];
    assert.deepEqual(rel.schedule.map((s) => [s.date, s.items]), want);
    assert.deepEqual(rel.schedule.filter((s) => s.onlyIfReady).map((s) => s.date), ['2026-12-14']);
    assert.equal(new Set(rel.toys.map((t) => t.id)).size, rel.toys.length);
    const names = rel.toys.map((t) => t.name);
    rel.schedule.forEach((s) => s.items.forEach((n) => assert.ok(names.includes(n), n + ' needs an entry in toys')));
    rel.toys.forEach((t) => {
      assert.ok(cards[t.id], t.id + ' has a card in data/home.json');
      if (t.date) assert.match(t.date, /^\d{4}-\d{2}-\d{2}T10:00:00\+05:30$/, t.id);
      assert.ok(t.hook && t.persona, t.id);
      assert.equal(typeof t.ready, 'boolean', t.id);
    });
    // No date: Coming soon, except the two that stay open.
    const undated = rel.toys.filter((t) => !t.date).map((t) => t.name).sort();
    assert.deepEqual(undated, ['first-web3-job', 'hall-of-fame', 'raise-your-first-round', 'token-simulator', 'tokenomics-basics', 'ways-to-the-moon']);
    assert.deepEqual(rel.toys.filter((t) => t.playableNow).map((t) => t.id).sort(), ['hall-of-fame', 'token-simulator']);
  });

  it('never locks the For Projects, Quests, account and info pages or the home page', () => {
    const never = ['launch-your-toy', 'test-your-product', 'advertise', 'academy', 'academy/list-your-project', 'book-a-call', 'leaderboard', 'progress', 'verify', 'books', 'about', 'real-toys', 'privacy', 'terms', 'refunds', 'contact', 'builder', 'soon', 'admin'];
    const hit = (p) => mw.config.matcher.some((m) => ('/' + p + '/').startsWith(m.replace(':path*', '')) || m === '/' || m.startsWith('/:'));
    never.forEach((p) => assert.ok(!hit(p), p + ' must never be locked'));
    assert.ok(!mw.config.matcher.some((m) => m === '/' || m === '/:path*'), 'the home page is never locked');
    rel.toys.forEach((t) => never.forEach((p) => assert.notEqual(t.path.replace(/\/$/, ''), p, p + ' is in the schedule')));
  });

  it('a ready item has a page, and every scheduled folder is locked on the server', () => {
    rel.toys.filter((t) => t.ready).forEach((t) => assert.ok(cards[t.id].path, t.id + ' needs a path in data/home.json'));
    rel.toys.filter((t) => !t.playableNow).forEach((t) => {
      assert.ok(t.path, t.id + ' needs a path in releases.json');
      assert.equal(t.path, cards[t.id].path || t.path, t.id + ' path matches data/home.json');
      assert.ok(mw.config.matcher.includes('/' + t.path + ':path*'), 'add /' + t.path + ':path* to the matcher in middleware.js');
    });
  });

  it('the browser, the server and the launch emails fill in dates the same way', () => {
    const fresh = () => json('data/releases.json');
    const a = browser.expand(fresh()), b = mw.expand(fresh());
    assert.deepEqual(a, b);
    const ts = read('supabase/functions/launch-emails/index.ts');
    assert.ok(ts.includes("s.date + 'T10:00:00+05:30', only: s.onlyIfReady === true"));
    assert.ok(ts.includes('const on = Boolean(toy.ready) && (!toy.onlyIfReady || Boolean(o && (o.ready === true || o.action === \'release\')));'));
    assert.ok(ts.includes('.then(expand)'));
  });

  it('onlyIfReady items wait for Switch on, even after their date', () => {
    const t = rel.toys.find((x) => x.name === 'roles-in-web3');
    assert.equal(t.id, 'web3-roles');
    assert.equal(t.onlyIfReady, true);
    const after = Date.parse(t.date) + 864e5, before = Date.parse(t.date) - 864e5;
    [browser, mw].forEach((m) => {
      assert.equal(m.decide(t, after, null, 7).status, 'delayed');
      assert.equal(m.decide(t, before, { ready: true, action: null }, 7).status, 'locked');
      assert.equal(m.decide(t, after, { ready: true, action: null }, 7).status, 'live');
      assert.equal(m.decide(t, before, { action: 'release' }, 7).status, 'live');
    });
    const sql = read('supabase/023_release_schedule.sql');
    assert.ok(sql.includes('create or replace function public.admin_set_ready'));
    assert.ok(sql.includes("if not public.is_admin() then raise exception 'Admins only'"));
  });

  it('unlocks at 10:00 India time on its day, with a New sticker for 7 days', () => {
    const t = rel.toys.find((x) => x.name === 'web3-hacks');
    const at = Date.parse('2026-11-19T04:30:00Z');
    assert.equal(Date.parse(t.date), at);
    assert.equal(browser.decide(t, at - 1000, null, 7).status, 'locked');
    const open = browser.decide(t, at, null, 7);
    assert.equal(open.status, 'live');
    assert.equal(open.isNew, true);
    assert.equal(browser.decide(t, at + 7 * 864e5, null, 7).isNew, false);
    assert.equal(browser.decide(rel.toys.find((x) => x.id === 'tokenomics-basics'), at + 365 * 864e5, null, 7).status, 'locked');
    assert.equal(browser.decide(rel.toys.find((x) => x.id === 'hall-of-fame'), at, null, 7).status, 'live');
  });

  it('the browser and the server use the same rule', () => {
    const toy = { id: 'x', date: '2026-11-17T10:00:00+05:30', ready: true };
    const at = Date.parse(toy.date);
    const cases = [
      [toy, at - 1000, null, 'locked', false],
      [toy, at, null, 'live', true],
      [toy, at + 8 * 864e5, null, 'live', false],
      [{ ...toy, ready: false }, at + 1000, null, 'delayed', false],
      [{ ...toy, ready: false }, at - 1000, null, 'locked', false],
      [toy, at - 864e5, { action: 'release', updated_at: new Date(at - 2 * 864e5).toISOString() }, 'live', true],
      [toy, at + 1000, { action: 'delay', until: '2026-11-20T10:00:00+05:30' }, 'delayed', false],
      [toy, Date.parse('2026-11-20T10:00:00+05:30'), { action: 'delay', until: '2026-11-20T10:00:00+05:30' }, 'live', true],
      [toy, at + 1000, { action: 'delay', until: null }, 'delayed', false],
      [{ ...toy, playableNow: true }, at - 864e5, null, 'live', false],
      [{ ...toy, date: null }, at, null, 'locked', false],
      [{ ...toy, date: null }, at, { action: 'release', updated_at: new Date(at).toISOString() }, 'live', true],
      [{ ...toy, onlyIfReady: true }, at + 1000, null, 'delayed', false],
      [{ ...toy, onlyIfReady: true }, at + 1000, { ready: true, action: null }, 'live', true],
    ];
    cases.forEach(([t, now, o, status, isNew], i) => {
      const a = browser.decide(t, now, o, 7);
      const b = mw.decide(t, now, o, 7);
      assert.equal(a.status, status, 'case ' + i);
      assert.equal(a.isNew, isNew, 'case ' + i + ' new');
      assert.deepEqual({ ...a, at: String(a.at) }, { ...b, at: String(b.at) }, 'case ' + i + ' same on server');
    });
  });

  it('middleware sends locked toys to the teaser and lets live ones through', async () => {
    const real = globalThis.fetch;
    const toys = [{ id: 'web3-roles', path: 'web3-roles/', date: '2099-01-01T10:00:00+05:30', ready: true },
      { id: 'hall-of-fame', path: 'hall-of-fame/', date: '2000-01-01T10:00:00+05:30', ready: true }];
    globalThis.fetch = async (u) => {
      if (String(u).endsWith('/data/releases.json')) return new Response(JSON.stringify({ newDays: 7, toys }));
      return new Response('[]');
    };
    try {
      const locked = await mw.default(new Request('https://web3.toys/web3-roles/'));
      assert.equal(locked.status, 307);
      assert.equal(locked.headers.get('location'), 'https://web3.toys/soon/?toy=web3-roles');
      const data = await mw.default(new Request('https://web3.toys/web3-roles/data.json'));
      assert.equal(data.status, 307);
      assert.equal(await mw.default(new Request('https://web3.toys/hall-of-fame/')), undefined);
      process.env.PREVIEW_KEY = 'preview-key-123456';
      const set = await mw.default(new Request('https://web3.toys/web3-roles/?preview=preview-key-123456'));
      assert.equal(set.status, 307);
      assert.equal(set.headers.get('location'), 'https://web3.toys/web3-roles/');
      assert.match(set.headers.get('set-cookie'), /^w3preview=preview-key-123456;.*HttpOnly/);
      assert.equal(await mw.default(new Request('https://web3.toys/web3-roles/', { headers: { cookie: 'a=1; w3preview=preview-key-123456' } })), undefined);
      assert.equal((await mw.default(new Request('https://web3.toys/web3-roles/?preview=wrong'))).status, 307);
      assert.equal((await mw.default(new Request('https://web3.toys/web3-roles/', { headers: { cookie: 'w3preview=wrong' } }))).headers.get('location'), 'https://web3.toys/soon/?toy=web3-roles');
      delete process.env.PREVIEW_KEY;
      globalThis.fetch = async () => { throw new Error('offline'); };
      assert.equal((await mw.default(new Request('https://web3.toys/hall-of-fame/'))).status, 307);
    } finally {
      globalThis.fetch = real;
    }
  });

  it('the database keeps overrides admin only and needs consent for Notify me', () => {
    const sql = read('supabase/010_releases.sql');
    assert.ok(sql.includes("if not public.is_admin() then raise exception 'Admins only'"));
    assert.ok(sql.includes('p_consent is not true'));
    assert.ok(!/create policy[^;]*for (insert|update|delete|all)/i.test(sql));
  });

  it('Web3 Hall of Famers has 50 people with every field', () => {
    const d = json('data/hall-of-fame-people.json');
    const cats = new Set(d.categories.map((c) => c.id));
    const words = json('data/hall-of-fame.json');
    assert.equal(d.people.length, 50);
    assert.equal(new Set(d.people.map((p) => p.id)).size, 50);
    d.people.forEach((p) => {
      assert.match(p.id, /^[a-z0-9-]+$/);
      assert.ok(p.name && p.role && p.why && p.fun && p.story && p.known && p.known.length, p.id);
      assert.ok(cats.has(p.cat), p.id);
      assert.ok(['easy', 'medium', 'hard'].includes(p.level), p.id);
      if (p.photo) assert.ok(existsSync(new URL(`../images/people/${p.id}.webp`, import.meta.url)), p.id + ' photo missing');
    });
    Object.entries(words.rounds).forEach(([lv, n]) => assert.ok(d.people.filter((p) => p.level === lv).length >= n, lv));
    assert.ok(json('quizzes/index.json').toys.some((t) => t.id === 'hall-of-fame'));
  });

  it('Hall of Fame person pages, cards and posts are up to date (node tools/hof-build.mjs)', async () => {
    const { build } = await import('../tools/hof-build.mjs');
    const files = build(false);
    Object.entries(files).forEach(([f, body]) => assert.equal(read(f), body, f + ' is out of date: run node tools/hof-build.mjs'));
    json('data/hall-of-fame-people.json').people.forEach((p) => {
      assert.ok(existsSync(new URL(`../images/people/cards/${p.id}.png`, import.meta.url)), p.id + ' card: run node tools/hof-cards.mjs');
      if (p.x) assert.match(p.x, /^[A-Za-z0-9_]{1,15}$/, p.id);
      if (p.caution) assert.ok(!p.x, p.id + ' is never tagged');
    });
    const sql = read('supabase/011_hall_of_fame.sql');
    assert.ok(sql.includes("raise exception 'Log in to vote.'"));
    assert.ok(!/create policy[^;]*for (insert|update|delete|all)/i.test(sql));
  });

  it('Early Bird starts on each toy\'s own unlock date, and every scheduled toy ends with a certificate', () => {
    const sql = read('supabase/012_early_bird.sql');
    const upd = read('supabase/023_release_schedule.sql');
    const quizIds = json('quizzes/index.json').toys.map((t) => t.id);
    rel.toys.filter((t) => !/^tool-/.test(t.id)).forEach((t) => {
      const start = (t.playableNow ? rel.launch : t.date || '2099-01-01T10:00:00+05:30').replace('T', ' ');
      assert.ok(sql.includes(`('${t.id}', '${start}', 1000,`), t.id + ': Early Bird start in 012_early_bird.sql must match releases.json');
      assert.ok(upd.includes(`('${t.id}', '${start}')`), t.id + ': Early Bird start in 023_release_schedule.sql must match releases.json');
      if (t.ready) {
        assert.ok(quizIds.includes(t.id), t.id + ' needs a quiz and certificate (quizzes/index.json)');
        const q = json(`quizzes/${t.id}.json`).questions;
        assert.ok(q.length >= 5 && q.length <= 8, t.id);
        q.forEach((x) => assert.equal(x.options.filter((o) => o === x.answer).length, 1, t.id + ' ' + x.id));
      }
    });
    assert.ok(!/delete from public.early_birds/i.test(upd), 'spots players already earned are kept');
    assert.ok(sql.includes('for update'), 'spots are handed out one at a time');
    assert.ok(sql.includes('unique (toy, user_id)'));
  });

  it('launch kits are up to date with every picture (node tools/launch-kit.mjs, tools/launch-images.mjs)', async () => {
    const { build } = await import('../tools/launch-kit.mjs');
    Object.entries(build(false)).forEach(([f, body]) => assert.equal(read(f), body, f + ' is out of date: run node tools/launch-kit.mjs'));
    rel.toys.filter((t) => t.date && !/^tool-/.test(t.id)).forEach((t) => ['teaser-x', 'launch-x', 'teaser-story', 'launch-story'].forEach((k) =>
      assert.ok(existsSync(new URL(`../marketing/launches/img/${t.id}-${k}.png`, import.meta.url)), `${t.id}-${k}.png: run node tools/launch-images.mjs`)));
  });
});
