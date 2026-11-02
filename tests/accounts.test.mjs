// Tests for accounts (Part 1): keys stay public-only, the database rules are
// on, and the legal pages exist with their key promises.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const json = (p) => JSON.parse(read(p));

describe('Accounts setup', () => {
  it('config.js has only public Supabase settings', () => {
    const cfg = read('config.js');
    assert.match(cfg, /supabase: \{\s*url: '[^']*',\s*anonKey: '[^']*',/);
    assert.ok(!/service_role|serviceRole|secretKey|sb_secret_/i.test(cfg.replace(/\/\/.*$/gm, '')), 'no secret keys in config.js');
    assert.ok(!/service_role|sb_secret_/.test(read('js/auth.js')));
  });

  it('turns on database rules for every table and offers account deletion', () => {
    const sql = read('supabase/001_accounts.sql');
    const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
    assert.ok(tables.length >= 2);
    tables.forEach((t) => assert.ok(sql.includes(`alter table public.${t} enable row level security`), t));
    assert.ok(sql.includes('on delete cascade'));
    assert.ok(sql.includes('function public.delete_my_account()'));
  });

  it('asks for consent before login and links the privacy page', () => {
    const auth = read('js/auth.js');
    assert.ok(auth.includes('data-consent'));
    assert.ok(auth.includes("privacy/"));
    assert.ok(/b\.disabled = !consent\.checked/.test(auth));
  });

  it('has the legal pages, and they say what Razorpay and users need', () => {
    ['privacy', 'terms', 'refunds', 'contact'].forEach((d) => {
      assert.ok(existsSync(new URL(`../${d}/index.html`, import.meta.url)), d);
      assert.ok(read(`${d}/index.html`).includes(`data-doc="${d}"`));
      json(`data/legal/${d}.json`);
    });
    const terms = JSON.stringify(json('data/legal/terms.json'));
    assert.ok(terms.includes('no cash value') && terms.includes('never be withdrawn'));
    assert.ok(terms.includes('Payment does not guarantee listing'));
    const privacy = JSON.stringify(json('data/legal/privacy.json'));
    assert.ok(privacy.includes('Delete my account and data'));
    assert.ok(JSON.stringify(json('data/legal/refunds.json')).includes('Nothing is shipped'));
  });

  it('keeps setup files off the live site', () => {
    const ignore = read('.vercelignore');
    assert.ok(ignore.includes('/supabase') && ignore.includes('/docs'));
  });
});
