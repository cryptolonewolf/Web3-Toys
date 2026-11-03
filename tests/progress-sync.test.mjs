// Tests for Part 2: certificates are checked before saving, coin rules and
// extras match between the database and the site, and coins have no cash value.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const json = (p) => JSON.parse(read(p));
const lib = require('../api/_lib.js');
const saveCert = require('../api/save-cert.js');

function call(handler, { method = 'POST', headers = {}, body = {} } = {}) {
  return new Promise((resolve) => {
    const req = require('node:stream').Readable.from([JSON.stringify(body)]);
    req.method = method;
    req.headers = headers;
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}

describe('Saving certificates to an account', () => {
  const env = { CERT_SECRET: 'test-secret', SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' };
  const quiz = lib.loadQuiz(lib.quizIndex()[0].id);
  const { code } = lib.issue(env.CERT_SECRET, quiz, 90, 'Sleepy Frog');

  async function withEnv(fn) {
    const old = { ...process.env };
    Object.assign(process.env, env);
    const calls = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts = {}) => {
      calls.push({ url, opts });
      if (url.endsWith('/auth/v1/user')) {
        return opts.headers.Authorization === 'Bearer good' ? { ok: true, json: async () => ({ id: 'user-1' }) } : { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => null };
    };
    try { return await fn(calls); } finally { globalThis.fetch = realFetch; process.env = old; }
  }

  it('checks the code, then saves it for the logged-in person only', () => withEnv(async (calls) => {
    const r = await call(saveCert, { headers: { authorization: 'Bearer good' }, body: { code, name: 'Sleepy Frog' } });
    assert.equal(r.status, 200);
    const rpc = calls.find((c) => c.url.endsWith('/rest/v1/rpc/record_certificate'));
    const sent = JSON.parse(rpc.opts.body);
    assert.equal(sent.p_user, 'user-1');
    assert.equal(sent.p_toy, quiz.id);
    assert.equal(sent.p_score, 90);
    assert.equal(rpc.opts.headers.apikey, 'sb_secret_test');
  }));

  it('refuses a wrong name, a fake code, or no login', () => withEnv(async (calls) => {
    assert.equal((await call(saveCert, { headers: { authorization: 'Bearer good' }, body: { code, name: 'Someone Else' } })).status, 400);
    assert.equal((await call(saveCert, { headers: { authorization: 'Bearer good' }, body: { code: 'W3T-AAAA-AAAA-AAAA-AAAA', name: 'Sleepy Frog' } })).status, 400);
    assert.equal((await call(saveCert, { body: { code, name: 'Sleepy Frog' } })).status, 401);
    assert.equal((await call(saveCert, { headers: { authorization: 'Bearer expired' }, body: { code, name: 'Sleepy Frog' } })).status, 401);
    assert.ok(!calls.some((c) => c.url.includes('record_certificate')));
  }));

  it('is switched off until the Vercel settings exist', async () => {
    const old = { ...process.env };
    delete process.env.SUPABASE_SECRET_KEY;
    const r = await call(saveCert, { headers: { authorization: 'Bearer good' }, body: { code, name: 'Sleepy Frog' } });
    process.env = old;
    assert.equal(r.status, 503);
  });
});

describe('Coins and extras rules', () => {
  const sql = read('supabase/003_progress.sql');

  it('turns on database rules for every table and gives the browser no way to write coins or certificates', () => {
    [...sql.matchAll(/create table if not exists public\.(\w+)/g)].forEach((m) => assert.ok(sql.includes(`alter table public.${m[1]} enable row level security`), m[1]));
    assert.ok(!/for (insert|update|delete|all)/i.test(sql), 'no write policies');
    assert.ok(sql.includes('grant execute on function public.record_certificate(uuid, text, text, int, text, text, date) to service_role'));
    assert.ok(sql.includes("revoke all on function public.record_certificate(uuid, text, text, int, text, text, date) from public, anon, authenticated"));
  });

  it('uses the same coin amounts as config.js', () => {
    const points = JSON.parse(read('config.js').match(/points: (\{[^}]*\})/)[1].replace(/(\w+):/g, '"$1":'));
    const rules = Object.fromEntries([...sql.matchAll(/\('(\w+)', (\d+), \d+\)/g)].map((m) => [m[1], Number(m[2])]));
    assert.deepEqual(rules, points);
  });

  it('uses the same extras and prices as data/cosmetics.json', () => {
    const items = json('data/cosmetics.json').items;
    const dbItems = Object.fromEntries([...sql.matchAll(/\('((?:cert|frame|theme)-\w+)', '(\w+)', (\d+)\)/g)].map((m) => [m[1], [m[2], Number(m[3])]]));
    assert.deepEqual(Object.fromEntries(items.map((i) => [i.id, [i.slot, i.coins]])), dbItems);
  });

  it('says coins have no cash value, and nothing can be bought or swapped with coins except extras', () => {
    assert.ok(json('data/cosmetics.json').noCash.includes('no cash value'));
    assert.ok(!existsSync(new URL('../data/rewards.json', import.meta.url)));
    assert.ok(!/"coins":/.test(read('data/shop.json') + read('data/books.json')));
    assert.ok(!/redeem/.test(read('config.js') + read('js/profile.js')));
  });
});
