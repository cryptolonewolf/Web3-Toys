// Tests for the For Projects deposits and the admin Refund button.
// Run: WEB3TOYS_TEST=1 deno test --allow-env --allow-read supabase/functions/business_test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1';

Deno.env.set('WEB3TOYS_TEST', '1');
Deno.env.set('SUPABASE_URL', 'https://db.test');
Deno.env.set('SERVICE_KEY', 'sb_secret_test');
Deno.env.set('RAZORPAY_KEY_ID', 'rzp_test_x');
Deno.env.set('RAZORPAY_KEY_SECRET', 'secret');
const create = await import('./create-order/index.ts');
const crypto = await import('./crypto-order/index.ts');
const refund = (await import('./admin-refund/index.ts')).handle;

const toy = JSON.parse(await Deno.readTextFile(new URL('../../data/business/toy_tiers.json', import.meta.url)));
const test = JSON.parse(await Deno.readTextFile(new URL('../../data/business/test_tiers.json', import.meta.url)));
const ads = JSON.parse(await Deno.readTextFile(new URL('../../data/business/ad_slots.json', import.meta.url)));

// Prices are 40% off for now (the sale prices are in the price files).
Deno.test('deposits come from the price files: half the price, or the exact depositUsd, in dollars', () => {
  const list = create.businessProducts(toy, test);
  const by = Object.fromEntries(list.map((p: any) => [p.id, p]));
  assertEquals(by['deposit-toy-mini'].usd, 300);
  assertEquals(by['deposit-toy-full'].usd, 750);
  assertEquals(by['deposit-test-quick'].usd, 150);
  assertEquals(by['deposit-test-standard'].usd, 450);
  assertEquals(by['deposit-test-launch-ready'].usd, 900);
  assert(list.every((p: any) => p.perItem && !p.inr));
  assertEquals(JSON.stringify(crypto.businessProducts(toy, test)), JSON.stringify(list));
});

Deno.test('ad slots come from ad_slots.json, with rounds only where allowed', () => {
  const by = Object.fromEntries(create.businessProducts(toy, test, ads).map((p: any) => [p.id, p]));
  assertEquals(by['ad-toy-scam'].usd, 300);
  assertEquals(by['ad-toy-scam-round'].usd, 480);
  assertEquals(by['ad-toy-web3-roles'].usd, 120);
  assert(!by['ad-toy-invest-100-round']);
  assertEquals(by['ad-site'].usd, 900);
  assertEquals(by['ad-newsletter'].usd, 90);
  assertEquals(JSON.stringify(crypto.businessProducts(toy, test, ads)), JSON.stringify(create.businessProducts(toy, test, ads)));
});

const orders: Record<string, any> = {
  '11111111-1111-1111-1111-111111111111': { id: '11111111-1111-1111-1111-111111111111', status: 'paid', provider: 'razorpay', razorpay_payment_id: 'pay_1', amount: 49950 },
  '22222222-2222-2222-2222-222222222222': { id: '22222222-2222-2222-2222-222222222222', status: 'paid', provider: 'paymento', amount: 49950 },
};
const refunds: any[] = [];
globalThis.fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input);
  const auth = new Headers(init.headers).get('authorization') || '';
  if (url.endsWith('/auth/v1/user')) return auth.includes('eyJadmin') ? Response.json({ id: 'admin-1' }) : auth.includes('eyJuser') ? Response.json({ id: 'user-1' }) : new Response('no', { status: 401 });
  if (url.includes('/rest/v1/admins?user_id=eq.')) return Response.json(url.includes('admin-1') ? [{ user_id: 'admin-1' }] : []);
  if (url.includes('/rest/v1/orders?id=eq.')) {
    const id = url.split('id=eq.')[1].split('&')[0];
    if (init.method === 'PATCH') { Object.assign(orders[id], JSON.parse(String(init.body))); return new Response(null, { status: 204 }); }
    return Response.json(orders[id] ? [orders[id]] : []);
  }
  if (url === 'https://api.razorpay.com/v1/payments/pay_1/refund') { refunds.push(JSON.parse(String(init.body))); return Response.json({ id: 'rfnd_1' }); }
  throw new Error('Unexpected fetch ' + url);
};
const call = (token: string, body: unknown) => refund(new Request('https://fn.test', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(body) }));

Deno.test('only admins can refund', async () => {
  assertEquals((await call('eyJuser', { orderId: '11111111-1111-1111-1111-111111111111' })).status, 403);
  assertEquals(refunds.length, 0);
});

Deno.test('a Razorpay payment is refunded in full, once', async () => {
  const r = await call('eyJadmin', { orderId: '11111111-1111-1111-1111-111111111111' });
  assertEquals(r.status, 200);
  assertEquals(refunds[0].amount, 49950);
  assertEquals(orders['11111111-1111-1111-1111-111111111111'].status, 'refunded');
  assertEquals((await (await call('eyJadmin', { orderId: '11111111-1111-1111-1111-111111111111' })).json()).already, true);
  assertEquals(refunds.length, 1);
});

Deno.test('crypto payments are refunded by hand, then marked', async () => {
  const first = await call('eyJadmin', { orderId: '22222222-2222-2222-2222-222222222222' });
  assertEquals(first.status, 409);
  const marked = await call('eyJadmin', { orderId: '22222222-2222-2222-2222-222222222222', action: 'mark' });
  assertEquals(marked.status, 200);
  assertEquals(orders['22222222-2222-2222-2222-222222222222'].status, 'refunded');
});

Deno.test('the yearly Pro plan exists only while pages.json switches it on, the same in both functions', () => {
  const pages = JSON.parse(Deno.readTextFileSync(new URL('../../data/business/pages.json', import.meta.url)));
  const off = create.businessProducts(null, null, null, pages);
  assertEquals(off.some((p: any) => p.id === 'pro-year'), pages.pro.yearly.on === true);
  const on = { pro: { yearly: { on: true, usd: 199 } } };
  const a: any = create.businessProducts(null, null, null, on).find((p: any) => p.id === 'pro-year');
  assertEquals(a && a.usd, 199);
  assertEquals(JSON.stringify(crypto.businessProducts(null, null, null, on)), JSON.stringify(create.businessProducts(null, null, null, on)));
});

Deno.test('founding offer deposits exist only while slots are left, the same in both functions', () => {
  const on = structuredClone(test);
  on.foundingOffer = { on: true, left: 2, discount: 0.4 };
  const by = Object.fromEntries(create.businessProducts(null, on).map((p: any) => [p.id, p]));
  assertEquals(by['deposit-test-quick-founding'].usd, 90);
  assertEquals(by['deposit-test-launch-ready-founding'].usd, 540);
  assertEquals(JSON.stringify(crypto.businessProducts(null, on)), JSON.stringify(create.businessProducts(null, on)));
  const off = structuredClone(test);
  off.foundingOffer = { on: true, left: 0, discount: 0.4 };
  assert(!create.businessProducts(null, off).some((p: any) => /founding/.test(p.id)));
});
