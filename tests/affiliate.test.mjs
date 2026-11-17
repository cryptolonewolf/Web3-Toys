// Invite and earn: supabase/025_affiliates.sql, js/affiliate.js and the
// link handling in js/site.js and js/sync.js.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sql = read('supabase/025_affiliates.sql');
const W = JSON.parse(read('data/business/affiliate.json'));

describe('Invite and earn', () => {
  it('pays 15%, then 20% from 5 buyers, 25% from 15 and 30% from 30, the same in the page words and the database', () => {
    assert.deepEqual(W.tiers, [{ minBuyers: 0, rate: 0.15 }, { minBuyers: 5, rate: 0.2 }, { minBuyers: 15, rate: 0.25 }, { minBuyers: 30, rate: 0.3 }]);
    const rows = [...sql.match(/insert into public\.affiliate_tiers[^;]*values ([^;]*?)\non conflict/)[1].matchAll(/\((\d+), ([0-9.]+)\)/g)].map((m) => ({ minBuyers: Number(m[1]), rate: Number(m[2]) }));
    assert.deepEqual(rows, W.tiers);
    assert.ok(sql.includes('rate <= 0.3'), 'never more than 30%');
  });
  it('is only for page owners, never for your own purchases, and not for coin unlocks', () => {
    assert.ok(sql.includes("public.affiliate_handle(aff) is null then return new"));
    assert.ok(sql.includes('aff = new.user_id'));
    assert.ok(sql.includes("new.currency not in ('INR', 'USD')") && sql.includes("not in ('razorpay', 'paymento')"));
    assert.ok(sql.includes("raise exception 'Invite and earn is for people with a published web3.toys page.'"));
  });
  it('waits 30 days (and for delivery on projects), cancels on refunds, and pays from $20 after an admin check', () => {
    assert.ok(sql.includes('hold_days int not null default 30') && sql.includes('min_payout_usd numeric(10, 2) not null default 20'));
    assert.ok(sql.includes("r.status = 'live'") && sql.includes("b.status = 'approved'"));
    assert.ok(sql.includes("new.status = 'refunded'") && sql.includes("set status = 'void'"));
    assert.ok(/admin_affiliate_payout[\s\S]*if not public\.is_admin\(\) then raise exception 'Admins only'/.test(sql));
    assert.ok(!/create policy[^;]*for (insert|update|delete|all)/i.test(sql), 'no direct writes');
  });
  it('remembers ?ref=HANDLE or a code for 90 days, first link wins, and tells the server', () => {
    const site = read('js/site.js');
    assert.ok(site.includes('[?&]ref=@?([A-Za-z0-9_]{2,15})'));
    assert.ok(site.includes("'web3toys.ref.v2'") && site.includes('90 * 864e5'));
    assert.ok(read('js/sync.js').includes("db.rpc('note_ref'"));
    assert.ok(read('js/page-view.js').includes('site.keepReferral(p.handle.toLowerCase())'));
  });
  it('has its terms, its admin tab and its setup step', () => {
    const terms = JSON.parse(read('data/legal/terms.json'));
    assert.ok(terms.sections.some((s) => s.id === 'invite-and-earn'));
    assert.ok(read('js/admin.js').includes("['affiliates', '💸 Affiliates']"));
    assert.ok(read('data/ops.json').includes('"check": "sql-025"'));
    assert.ok(read('supabase/017_ops.sql').includes("'sql-025', to_regclass('public.affiliate_earnings')"));
  });
});
