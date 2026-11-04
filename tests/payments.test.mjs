// Tests for Part 4: the price list, the switch, and that no secret is in the
// website. The payment functions have their own Deno tests:
//   WEB3TOYS_TEST=1 deno test --allow-env --allow-read --allow-net supabase/functions/
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const json = (p) => JSON.parse(read(p));

describe('Payments', () => {
  const products = json('data/products.json').products;

  it('every product has a unique id, a type and both prices', () => {
    assert.equal(new Set(products.map((p) => p.id)).size, products.length);
    products.forEach((p) => {
      assert.match(p.id, /^[a-z0-9-]+$/);
      assert.ok(['book', 'report', 'certificate', 'export', 'call', 'project'].includes(p.type), p.id);
      assert.ok(p.usd > 0 && p.inr > 0 && Number.isInteger(p.inr), p.id);
      if (p.file) assert.match(p.file, /^[a-z0-9/-]+\.pdf$/);
    });
  });

  it('books on sale point at real products with a file', () => {
    json('data/books.json').books.filter((b) => b.product).forEach((b) => {
      const p = products.find((x) => x.id === b.product);
      assert.ok(p && p.file, b.title);
    });
  });

  it('keeps Razorpay secrets out of the website with on and off switches', () => {
    const site = read('config.js') + read('js/pay.js');
    assert.ok(!/rzp_(test|live)_|key_secret|RAZORPAY_KEY_SECRET|webhook_secret/i.test(site));
    assert.match(read('config.js'), /payments: \{\s*enabled: (true|false),\s*crypto: (true|false),/);
    assert.ok(!/PAYMENTO_(API_KEY|IPN_SECRET)/.test(site));
    ['create-order', 'verify-payment', 'razorpay-webhook', 'download', 'crypto-order', 'paymento-ipn'].forEach((f) =>
      assert.ok(existsSync(new URL(`../supabase/functions/${f}/index.ts`, import.meta.url)), f));
  });

  it('only the server writes orders, and paid files are private', () => {
    const sql = read('supabase/004_payments.sql');
    assert.ok(sql.includes('alter table public.orders enable row level security'));
    assert.ok(!/for (insert|update|delete|all)/i.test(sql));
    assert.ok(sql.includes("values ('paid-files', 'paid-files', false)"));
    assert.ok(sql.includes('on delete set null'), 'purchase records stay after an account is deleted');
  });
});

describe('Book a Call', () => {
  const cfg = read('config.js');

  it('has one call setting with a mode, the booking link and a call product', () => {
    assert.match(cfg, /call: \{\s*mode: '(calcom|razorpay)',\s*calUrl: '[^']*',\s*product: 'call-30',/);
    assert.ok(!/bookCallUrl/.test(cfg + read('js/quiz.js') + read('js/pages.js')));
    const call = JSON.parse(read('data/products.json')).products.find((p) => p.id === 'call-30');
    assert.equal(call.type, 'call');
  });

  it('saves Cal.com bookings only through the signed webhook', () => {
    const sql = read('supabase/007_bookings.sql');
    assert.ok(sql.includes('alter table public.bookings enable row level security'));
    assert.ok(!/for (insert|update|delete|all)/i.test(sql));
    assert.ok(read('supabase/functions/cal-webhook/index.ts').includes("req.headers.get('x-cal-signature-256')"));
  });
});

describe('Work with us (Part 7)', () => {
  const products = json('data/products.json').products;
  const work = json('data/work.json');
  const sql = read('supabase/009_work_with_us.sql');
  const projects = products.filter((p) => p.type === 'project');

  it('has the agreed prices', () => {
    const usd = Object.fromEntries(projects.map((p) => [p.id, p.usd]));
    assert.deepEqual(usd, { 'project-toy': 999, 'course-4': 199, 'course-6': 349, 'course-8': 499 });
    projects.forEach((p) => { assert.ok(p.perItem, p.id); assert.ok(!p.coins, p.id); });
  });

  it('every package is a project product, and the database knows each one', () => {
    work.packages.forEach((k) => {
      assert.ok(projects.find((p) => p.id === k.product), k.id);
      assert.ok(work.fields[k.kind], k.kind);
    });
    projects.forEach((p) => assert.ok(sql.includes(`'${p.id}'`), p.id));
  });

  it('shows the listing promise word for word', () => {
    const line = 'Payment does not guarantee listing. Every project passes our vetting checklist first, and we refund in full if we decline.';
    assert.equal(work.guarantee, line);
    assert.ok(json('data/legal/refunds.json').sections.some((s) => (s.list || []).includes(line)) || read('data/legal/refunds.json').includes(line));
  });

  it('requests are only written through submit_request', () => {
    assert.ok(sql.includes('auth.uid() is null'));
    assert.ok(sql.includes('from public, anon'));
    assert.ok(!/create policy[^;]*for (insert|update|delete|all)/i.test(sql));
  });
});
