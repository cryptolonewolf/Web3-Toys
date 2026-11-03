// Tests for the payment functions, with pretend Razorpay, database and storage.
// Run: WEB3TOYS_TEST=1 deno test --allow-env --allow-read supabase/functions/payments_test.ts
import { assertEquals } from 'jsr:@std/assert@1';

Deno.env.set('WEB3TOYS_TEST', '1');
Deno.env.set('SUPABASE_URL', 'https://db.test');
Deno.env.set('SERVICE_KEY', 'sb_secret_test');
Deno.env.set('RAZORPAY_KEY_ID', 'rzp_test_key');
Deno.env.set('RAZORPAY_KEY_SECRET', 'rzp_secret');
Deno.env.set('RAZORPAY_WEBHOOK_SECRET', 'hook_secret');
Deno.env.set('SITE_URL', 'https://site.test');

const createOrder = (await import('./create-order/index.ts')).handle;
const verify = (await import('./verify-payment/index.ts')).handle;
const webhook = (await import('./razorpay-webhook/index.ts')).handle;
const download = (await import('./download/index.ts')).handle;
const products = JSON.parse(await Deno.readTextFile(new URL('../../data/products.json', import.meta.url)));

type Row = Record<string, any>;
let orders: Row[] = [];
let razorpayCalls: Row[] = [];

globalThis.fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input);
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const h = (init.headers || {}) as Record<string, string>;
  if (url === 'https://db.test/auth/v1/user') {
    if (h.apikey === 'bad-key') return new Response('{"message":"Invalid API key"}', { status: 401 });
    const auth = h.Authorization;
    if (auth === 'Bearer eyJalice') return ok({ id: 'u-alice', email: 'alice@x.com' });
    if (auth === 'Bearer eyJbob') return ok({ id: 'u-bob', email: 'bob@x.com' });
    return new Response('{}', { status: 401 });
  }
  if (url === 'https://site.test/data/products.json') return ok(products);
  if (url === 'https://api.razorpay.com/v1/orders') {
    const b = JSON.parse(String(init.body));
    razorpayCalls.push({ ...b, auth: (init.headers as Record<string, string>).Authorization });
    return ok({ id: 'order_' + razorpayCalls.length, amount: b.amount, currency: b.currency });
  }
  if (url.startsWith('https://db.test/rest/v1/orders')) {
    const q = new URL(url).searchParams;
    const match = (r: Row) => [...q.entries()].every(([k, v]) => k === 'select' || (v.startsWith('eq.') ? String(r[k]) === decodeURIComponent(v.slice(3)) : v.startsWith('neq.') ? String(r[k]) !== v.slice(4) : true));
    if (init.method === 'POST') { orders.push({ id: crypto.randomUUID(), status: 'created', ...JSON.parse(String(init.body)) }); return new Response(null, { status: 201 }); }
    if (init.method === 'PATCH') { orders.filter(match).forEach((r) => Object.assign(r, JSON.parse(String(init.body)))); return new Response(null, { status: 204 }); }
    return ok(orders.filter(match));
  }
  if (url.startsWith('https://db.test/storage/v1/object/sign/paid-files/')) {
    const path = url.split('/paid-files/')[1];
    return ok({ signedURL: `/object/sign/paid-files/${path}?token=abc` });
  }
  throw new Error('Unexpected fetch ' + url);
};

const post = (handler: (r: Request) => Promise<Response>, body: unknown, who?: string, headers: Record<string, string> = {}) =>
  handler(new Request('https://fn.test', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: 'Bearer eyJ' + who } : {}), ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

async function hmac(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.test('the price comes from products.json, in paise or cents', async () => {
  orders = []; razorpayCalls = [];
  const r = await (await post(createOrder, { product: 'book-dont-get-rekt', currency: 'INR', amount: 1 }, 'alice')).json();
  assertEquals(r.amount, 124900);
  assertEquals(razorpayCalls[0].amount, 124900);
  assertEquals(razorpayCalls[0].auth, 'Basic ' + btoa('rzp_test_key:rzp_secret'));
  const usd = await (await post(createOrder, { product: 'report-full', item: 'scam', currency: 'USD' }, 'alice')).json();
  assertEquals(usd.amount, 499);
  assertEquals(orders.length, 2);
  assertEquals(orders[1].item, 'scam');
});

Deno.test('create-order refuses no login, unknown products and missing items', async () => {
  assertEquals((await post(createOrder, { product: 'report-full', item: 'scam' })).status, 401);
  assertEquals((await post(createOrder, { product: 'free-money' }, 'alice')).status, 404);
  assertEquals((await post(createOrder, { product: 'report-full' }, 'alice')).status, 400);
  assertEquals((await post(createOrder, { product: 'report-full', item: '../etc' }, 'alice')).status, 400);
});

Deno.test('a payment counts only with a correct Razorpay signature, and only for its buyer', async () => {
  orders = []; razorpayCalls = [];
  const o = await (await post(createOrder, { product: 'book-first-30-days', currency: 'USD' }, 'alice')).json();
  const bad = await post(verify, { razorpay_order_id: o.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'fake' }, 'alice');
  assertEquals(bad.status, 400);
  assertEquals(orders[0].status, 'created');
  const sig = await hmac('rzp_secret', `${o.orderId}|pay_1`);
  assertEquals((await post(verify, { razorpay_order_id: o.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: sig }, 'bob')).status, 404);
  const good = await post(verify, { razorpay_order_id: o.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: sig }, 'alice');
  assertEquals(good.status, 200);
  assertEquals(orders[0].status, 'paid');
  assertEquals(orders[0].razorpay_payment_id, 'pay_1');
});

Deno.test('downloads only for the buyer of a paid order, as a 5 minute link', async () => {
  orders = []; razorpayCalls = [];
  const o = await (await post(createOrder, { product: 'book-first-30-days', currency: 'INR' }, 'alice')).json();
  const id = orders[0].id;
  assertEquals((await post(download, { orderId: id }, 'alice')).status, 402);
  orders[0].status = 'paid';
  assertEquals((await post(download, { orderId: id }, 'bob')).status, 404);
  const r = await (await post(download, { orderId: id }, 'alice')).json();
  assertEquals(r.seconds, 300);
  assertEquals(r.url.startsWith('https://db.test/storage/v1/object/sign/paid-files/books/your-first-30-days-in-crypto.pdf?token='), true);
  orders.push({ ...orders[0], id: crypto.randomUUID(), product_id: 'report-full' });
  assertEquals((await post(download, { orderId: orders[1].id }, 'alice')).status, 404);
  assertEquals(o.currency, 'INR');
});

Deno.test('the webhook marks orders paid, failed or refunded, only with a correct signature', async () => {
  orders = [{ id: crypto.randomUUID(), razorpay_order_id: 'order_9', status: 'created' }];
  const ev = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_9', order_id: 'order_9' } } } });
  assertEquals((await post(webhook, ev, undefined, { 'x-razorpay-signature': 'nope' })).status, 400);
  assertEquals(orders[0].status, 'created');
  assertEquals((await post(webhook, ev, undefined, { 'x-razorpay-signature': await hmac('hook_secret', ev) })).status, 200);
  assertEquals(orders[0].status, 'paid');
  const refund = JSON.stringify({ event: 'refund.processed', payload: { payment: { entity: { id: 'pay_9', order_id: 'order_9' } } } });
  await post(webhook, refund, undefined, { 'x-razorpay-signature': await hmac('hook_secret', refund) });
  assertEquals(orders[0].status, 'refunded');
});

Deno.test('a wrong SERVICE_KEY gives a clear setup message, not "log in"', async () => {
  Deno.env.set('SERVICE_KEY', 'bad-key');
  const r = await post(createOrder, { product: 'book-first-30-days', currency: 'INR' }, 'alice');
  assertEquals(r.status, 503);
  assertEquals((await r.json()).error.includes('SERVICE_KEY'), true);
  Deno.env.set('SUPABASE_ANON_KEY', 'anon-ok');
  const ok = await post(createOrder, { product: 'book-first-30-days', currency: 'INR' }, 'alice');
  assertEquals(ok.status === 401 || ok.status === 503, false);
  Deno.env.set('SERVICE_KEY', 'sb_secret_test');
  Deno.env.delete('SUPABASE_ANON_KEY');
});
