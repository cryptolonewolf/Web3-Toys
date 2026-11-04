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

const rel = json('data/releases.json');
const cards = {};
json('data/home.json').shelves.forEach((s) => s.cards.forEach((c) => { cards[c.id] = c; }));

describe('Release schedule', () => {
  it('lists real toys with a 10:00 India time date, a hook and a persona', () => {
    assert.equal(new Set(rel.toys.map((t) => t.id)).size, rel.toys.length);
    rel.toys.forEach((t) => {
      assert.ok(cards[t.id], t.id + ' has a card in data/home.json');
      assert.match(t.date, /^\d{4}-\d{2}-\d{2}T10:00:00\+05:30$/, t.id);
      assert.ok(t.hook && t.persona, t.id);
      assert.equal(typeof t.ready, 'boolean', t.id);
    });
  });

  it('launch day toys stay playable and are live on the home page', () => {
    const live = rel.toys.filter((t) => t.playableNow);
    assert.equal(live.length, 11);
    live.forEach((t) => {
      assert.equal(t.date, rel.launch, t.id);
      assert.ok(t.ready && cards[t.id].path, t.id);
    });
  });

  it('a ready toy has a page, and every scheduled toy folder is locked on the server', () => {
    rel.toys.filter((t) => t.ready).forEach((t) => assert.ok(cards[t.id].path, t.id + ' needs a path in data/home.json'));
    rel.toys.filter((t) => !t.playableNow).forEach((t) => {
      assert.ok(t.path, t.id + ' needs a path in releases.json');
      assert.ok(mw.config.matcher.includes('/' + t.path + ':path*'), 'add /' + t.path + ':path* to the matcher in middleware.js');
    });
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

  it('Who Built It? has 50 people with every field', () => {
    const d = json('data/hall-of-fame-people.json');
    const cats = new Set(d.categories.map((c) => c.id));
    const words = json('data/hall-of-fame.json');
    assert.equal(d.people.length, 50);
    assert.equal(new Set(d.people.map((p) => p.id)).size, 50);
    d.people.forEach((p) => {
      assert.match(p.id, /^[a-z0-9-]+$/);
      assert.ok(p.name && p.role && p.why && p.fun, p.id);
      assert.ok(cats.has(p.cat), p.id);
      assert.ok(['easy', 'medium', 'hard'].includes(p.level), p.id);
      if (p.photo) assert.ok(existsSync(new URL(`../images/people/${p.id}.webp`, import.meta.url)), p.id + ' photo missing');
    });
    Object.entries(words.rounds).forEach(([lv, n]) => assert.ok(d.people.filter((p) => p.level === lv).length >= n, lv));
    assert.ok(json('quizzes/index.json').toys.some((t) => t.id === 'hall-of-fame'));
  });
});
