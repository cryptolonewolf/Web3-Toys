// Tests for the Paymento (crypto) functions, with pretend Paymento and database.
// Run: WEB3TOYS_TEST=1 deno test --allow-env --allow-read supabase/functions/crypto_test.ts
import { assertEquals } from 'jsr:@std/assert@1';

Deno.env.set('WEB3TOYS_TEST', '1');
Deno.env.set('SUPABASE_URL', 'https://db.test');
Deno.env.set('SERVICE_KEY', 'sb_secret_test');
Deno.env.set('PAYMENTO_API_KEY', 'pm_key');
Deno.env.set('PAYMENTO_IPN_SECRET', 'ipn_secret');
Deno.env.set('SITE_URL', 'https://site.test');

const cryptoOrder = (await import('./crypto-order/index.ts')).handle;
const ipn = (await import('./paymento-ipn/index.ts')).handle;
const products = JSON.parse(await Deno.readTextFile(new URL('../../data/products.json', import.meta.url)));

type Row = Record<string, any>;
let orders: Row[] = [];
let requests: Row[] = [];
let verifyAnswer: Row = { success: false, body: { orderStatus: 1 } };

globalThis.fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input);
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const h = (init.headers || {}) as Record<string, string>;
  if (url === 'https://db.test/auth/v1/user') {
    if (h.Authorization === 'Bearer alice') return ok({ id: 'u-alice', email: 'alice@x.com' });
    if (h.Authorization === 'Bearer bob') return ok({ id: 'u-bob', email: 'bob@x.com' });
    return new Response('{}', { status: 401 });
  }
  if (url === 'https://site.test/data/products.json') return ok(products);
  if (url === 'https://api.paymento.io/v1/payment/request') {
    requests.push({ ...JSON.parse(String(init.body)), key: h['Api-Key'] });
    return ok({ success: true, message: '', body: 'tok_' + requests.length });
  }
  if (url === 'https://api.paymento.io/v1/payment/verify') return ok(verifyAnswer);
  if (url.startsWith('https://db.test/rest/v1/orders')) {
    const q = new URL(url).searchParams;
    const match = (r: Row) => [...q.entries()].every(([k, v]) => k === 'select' || (v.startsWith('eq.') ? String(r[k]) === v.slice(3) : v.startsWith('neq.') ? String(r[k]) !== v.slice(4) : true));
    if (init.method === 'POST') { orders.push({ status: 'created', provider_token: null, ...JSON.parse(String(init.body)) }); return new Response(null, { status: 201 }); }
    if (init.method === 'PATCH') { orders.filter(match).forEach((r) => Object.assign(r, JSON.parse(String(init.body)))); return new Response(null, { status: 204 }); }
    return ok(orders.filter(match));
  }
  throw new Error('Unexpected fetch ' + url);
};

const post = (h: (r: Request) => Promise<Response>, body: unknown, who?: string, headers: Record<string, string> = {}) =>
  h(new Request('https://fn.test', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: 'Bearer ' + who } : {}), ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

async function sign(text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('ipn_secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

Deno.test('starts a crypto payment at the US dollar price from products.json', async () => {
  orders = []; requests = [];
  const r = await (await post(cryptoOrder, { action: 'create', product: 'report-full', item: 'scam', fiatAmount: '0.01' }, 'alice')).json();
  assertEquals(requests[0].fiatAmount, '4.99');
  assertEquals(requests[0].fiatCurrency, 'USD');
  assertEquals(requests[0].key, 'pm_key');
  assertEquals(requests[0].orderId, orders[0].id);
  assertEquals(r.url, 'https://app.paymento.io/gateway?token=tok_1');
  assertEquals(orders[0].provider, 'paymento');
  assertEquals(orders[0].provider_token, 'tok_1');
  assertEquals((await post(cryptoOrder, { action: 'create', product: 'report-full', item: 'scam' })).status, 401);
});

Deno.test('a notice with a wrong signature changes nothing', async () => {
  const body = JSON.stringify({ Token: 'tok_1', OrderId: orders[0].id, OrderStatus: 7 });
  verifyAnswer = { success: true, body: { orderStatus: 8 } };
  assertEquals((await post(ipn, body, undefined, { 'X-HMAC-SHA256-Signature': 'ABC' })).status, 401);
  assertEquals(orders[0].status, 'created');
});

Deno.test('a signed notice is still checked with Paymento before marking paid', async () => {
  const body = JSON.stringify({ Token: 'tok_1', OrderId: orders[0].id, OrderStatus: 7 });
  verifyAnswer = { success: false, body: { orderStatus: 3 } };
  assertEquals((await post(ipn, body, undefined, { 'X-HMAC-SHA256-Signature': await sign(body) })).status, 200);
  assertEquals(orders[0].status, 'created');
  assertEquals(orders[0].provider_status, 3);
  verifyAnswer = { success: true, body: { orderStatus: 8 } };
  assertEquals((await post(ipn, body, undefined, { 'X-HMAC-SHA256-Signature': await sign(body) })).status, 200);
  assertEquals(orders[0].status, 'paid');
});

Deno.test('the buyer can check their own order; timeouts become failed', async () => {
  orders = []; requests = [];
  await post(cryptoOrder, { action: 'create', product: 'book-first-30-days' }, 'alice');
  const id = orders[0].id;
  assertEquals((await post(cryptoOrder, { action: 'check', orderId: id }, 'bob')).status, 404);
  verifyAnswer = { success: false, body: { orderStatus: 4 } };
  assertEquals((await (await post(cryptoOrder, { action: 'check', orderId: id }, 'alice')).json()).status, 'failed');
  assertEquals(orders[0].status, 'failed');
});
