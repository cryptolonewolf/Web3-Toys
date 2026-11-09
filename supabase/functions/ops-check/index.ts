// ops-check: the weekly site check for the admin Operations home.
// Visits every page and outside link in data/link-check.json (made by
// tools/link-list.mjs) and records, in ops_health (supabase/017_ops.sql):
//   - link: a page or link that is broken (404, 410, a server error, or no answer)
//   - slow: a page that took more than 3 seconds to arrive
//   - link_run: a summary of the run
// Runs every Monday (supabase/018_ops_schedule.sql). Secrets in Supabase:
// CRON_SECRET (the same password as in 018_ops_schedule.sql) and SITE_URL
// (optional, https://web3.toys by default).
// In Supabase, switch OFF "Verify JWT" for this function.

const env = (k: string) => Deno.env.get(k) || '';
const FN = 'ops-check';
const VERSION = 1;
const SLOW_MS = 3000;

function dbHeaders() {
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

// One check: status and time. Sites that refuse robots (401, 403, 429) are
// not counted as broken.
export async function check(url: string, fetcher: Fetcher = fetch, head = false) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    let r = await fetcher(url, { method: head ? 'HEAD' : 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'web3.toys link check' } });
    if (head && (r.status === 405 || r.status === 501)) r = await fetcher(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'web3.toys link check' } });
    const ms = Date.now() - t0;
    if (!head) await r.arrayBuffer().catch(() => null);
    const broken = r.status === 404 || r.status === 410 || r.status >= 500;
    return { status: r.status, ms, broken };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, broken: true, error: (e as Error).name === 'AbortError' ? 'no answer in 12 s' : 'could not connect' };
  } finally {
    clearTimeout(timer);
  }
}

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

export async function run(site: string, fetcher: Fetcher = fetch) {
  const list = await (await fetcher(`${site}/data/link-check.json`)).json();
  const rows: { kind: string; source: string; detail: string }[] = [];
  await pool(list.pages as string[], 4, async (page) => {
    const r = await check(site + page, fetcher);
    if (r.broken) rows.push({ kind: 'link', source: page, detail: `this page → ${r.status || r.error}` });
    else if (r.ms > SLOW_MS) rows.push({ kind: 'slow', source: page, detail: `${(r.ms / 1000).toFixed(1)} s` });
  });
  await pool(list.links as [string, string][], 6, async ([url, from]) => {
    const r = await check(url, fetcher, true);
    if (r.broken) rows.push({ kind: 'link', source: from, detail: `${url} → ${r.status || r.error}` });
  });
  const broken = rows.filter((x) => x.kind === 'link').length;
  const slow = rows.filter((x) => x.kind === 'slow').length;
  rows.push({ kind: 'link_run', source: 'ops-check', detail: `${list.pages.length} pages and ${list.links.length} links checked: ${broken} broken, ${slow} slow` });
  return rows;
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'GET' && new URL(req.url).searchParams.get('ping')) return new Response(JSON.stringify({ fn: FN, version: VERSION }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });
  if (!env('CRON_SECRET') || req.headers.get('x-cron-key') !== env('CRON_SECRET')) return new Response('Not allowed.', { status: 401 });
  const site = (env('SITE_URL') || 'https://web3.toys').replace(/\/$/, '');
  const rows = await run(site);
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/ops_health`, { method: 'POST', headers: dbHeaders(), body: JSON.stringify(rows.map((x) => ({ ...x, detail: x.detail.slice(0, 300) }))) });
  return new Response(JSON.stringify({ saved: r.ok, summary: rows[rows.length - 1].detail }), { headers: { 'Content-Type': 'application/json' } });
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
