// lead-emails: two short follow-ups to people who started a Test Your
// Product (or Launch Your Own Toy) request but did not pay the deposit:
// one about a day later, one about three days later. One link back to the
// form, and an unsubscribe link. Nobody who paid gets them.
// Runs every day (supabase/018_ops_schedule.sql). Secrets in Supabase:
// RESEND_API_KEY, CRON_SECRET, LEADS_FROM (the sender; OPS_FROM, LAUNCH_FROM
// or RECEIPT_FROM if missing) and SITE_URL (optional).
// In Supabase, switch OFF "Verify JWT" for this function.

const env = (k: string) => Deno.env.get(k) || '';
const FN = 'lead-emails';
const VERSION = 1;

function dbHeaders() {
  const key = env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}
const db = (path: string, init: RequestInit = {}) => fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders(), ...((init.headers as Record<string, string>) || {}) } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

async function sign(text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env('CRON_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

const WHAT: Record<string, { name: string; path: string }> = {
  test: { name: 'your product test', path: 'test-your-product/' },
  toy: { name: 'your toy', path: 'launch-your-toy/' },
  course: { name: 'your Quest', path: 'academy/list-your-project/' },
  ad: { name: 'your sponsor slot', path: 'advertise/' },
};

export function email(lead: { name: string; kind: string; which: string }, site: string, unsub: string) {
  const w = WHAT[lead.kind] || WHAT.test;
  const first = String(lead.name || '').trim().split(/\s+/)[0] || 'there';
  const link = `${site}/${w.path}?resume=1#request`;
  const day1 = lead.which === 'day1';
  const subject = day1 ? `Your web3.toys request: one step left` : `Still want real players to test your product?`;
  const lines = day1
    ? [`Hi ${first},`, `You started a request for ${w.name} on web3.toys yesterday. Your answers are saved: it takes about a minute to finish.`, `Questions first? Reply to this email and Aki will answer.`]
    : [`Hi ${first},`, `Just checking in on ${w.name}. If the timing is not right, no problem. If you would like a hand choosing a tier, reply here and we will sort it out together.`];
  const html = `<!doctype html><html><body style="margin:0;background:#FFF8E1;font-family:Arial,Helvetica,sans-serif;color:#1F1B2E">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<p style="font-size:20px;font-weight:bold;margin:0 0 16px">web3.toys</p>
${lines.map((l) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px">${esc(l)}</p>`).join('')}
<p style="margin:20px 0"><a href="${link}" style="background:#1F1B2E;color:#FFD93D;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">${day1 ? 'Finish my request' : 'Pick up where I left off'}</a></p>
<p style="font-size:15px;margin:0">Aki, web3.toys</p>
<p style="font-size:12px;color:#5A5470;margin-top:28px">You get this because you started a request on web3.toys. <a href="${unsub}" style="color:#5A5470">No more of these emails</a>. Build With Aki, Dehradun, Uttarakhand, India.</p>
</div></body></html>`;
  const text = `${lines.join('\n\n')}\n\n${link}\n\nAki, web3.toys\n\nNo more of these emails: ${unsub}`;
  return { subject, html, text };
}

async function unsubscribe(token: string) {
  const [id, sig] = token.split('.');
  const page = (msg: string, status = 200) => new Response(`<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:Arial;padding:32px;background:#FFF8E1;color:#1F1B2E"><h1>web3.toys</h1><p>${msg}</p></body>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  if (!/^[0-9a-f-]{36}$/i.test(id || '') || sig !== await sign('lead:' + id)) return page('This link is not valid.', 400);
  await db(`biz_leads?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ unsubscribed_at: new Date().toISOString() }) });
  return page('Done. We will not send you these emails again.');
}

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === 'GET' && url.searchParams.get('ping')) return new Response(JSON.stringify({ fn: FN, version: VERSION, email: !!env('RESEND_API_KEY') }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  if (req.method === 'GET' && url.searchParams.get('unsub')) return unsubscribe(url.searchParams.get('unsub') || '');
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });
  if (!env('CRON_SECRET') || req.headers.get('x-cron-key') !== env('CRON_SECRET')) return new Response('Not allowed.', { status: 401 });
  const from = env('LEADS_FROM') || env('OPS_FROM') || env('LAUNCH_FROM') || env('RECEIPT_FROM');
  if (!env('RESEND_API_KEY') || !from) return new Response('Emails are not set up yet.', { status: 503 });
  const site = (env('SITE_URL') || 'https://web3.toys').replace(/\/$/, '');
  const fnUrl = `${env('SUPABASE_URL')}/functions/v1/lead-emails`;
  const due = await db('rpc/leads_due_emails', { method: 'POST', body: '{}' }).then((r) => (r.ok ? r.json() : []));
  let sent = 0;
  for (const l of due) {
    const unsub = `${fnUrl}?unsub=${l.id}.${await sign('lead:' + l.id)}`;
    const m = email(l, site, unsub);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [l.email], reply_to: env('OPS_EMAIL') || 'hi@web3.toys', subject: m.subject, html: m.html, text: m.text, headers: { 'List-Unsubscribe': `<${unsub}>` } }),
    });
    if (!r.ok) continue;
    await db(`biz_leads?id=eq.${l.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ [l.which === 'day1' ? 'emailed_day1' : 'emailed_day3']: new Date().toISOString() }) });
    sent += 1;
  }
  return new Response(JSON.stringify({ due: due.length, sent }), { headers: { 'Content-Type': 'application/json' } });
}

if (!Deno.env.get('WEB3TOYS_TEST')) Deno.serve(handle);
