// Tests for Part 8: the admin data stays admin-only, the review list is up
// to date, and counting never stores names.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('Admin dashboard', () => {
  const sql = read('supabase/006_admin.sql');

  it('keeps every admin table readable by admins only, with no browser writes', () => {
    [...sql.matchAll(/create table if not exists public\.(\w+)/g)].forEach((m) => assert.ok(sql.includes(`alter table public.${m[1]} enable row level security`), m[1]));
    assert.ok(!/for (insert|update|delete|all)/i.test(sql), 'no write policies');
    for (const fn of ['admin_update_request', 'admin_approve', 'admin_users', 'admin_event_counts']) {
      const body = sql.slice(sql.indexOf(`function public.${fn}(`));
      assert.ok(body.slice(0, body.indexOf('end; $$')).includes("if not public.is_admin() then raise exception 'Admins only'"), fn);
    }
    assert.ok(sql.includes("grant execute on function public.add_lead(text, text, text) to anon, authenticated"));
  });

  it('only counts a fixed list of anonymous events', () => {
    assert.ok(sql.includes("if p_name not in ('page_view', 'finish', 'share', 'call_click', 'buy_click', 'purchase', 'signup') then return;"));
    assert.ok(!/user_id/.test(sql.slice(sql.indexOf('create table if not exists public.events'), sql.indexOf('create index if not exists events_name_time'))));
  });

  it('the review list matches the data files (run node tools/review-index.mjs after editing data)', async () => {
    const { build } = await import('../tools/review-index.mjs');
    const saved = JSON.parse(read('data/review-index.json'));
    assert.deepEqual(saved, build());
    assert.ok(saved.items.length > 0);
  });

  it('the admin page is hidden from search engines', () => {
    assert.ok(read('admin/index.html').includes('noindex'));
  });
});
