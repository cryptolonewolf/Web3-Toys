// Vercel middleware: keeps scheduled toys locked on the server until their
// release time, so nobody can play early by typing the address. A locked
// toy's folder sends visitors to its teaser page (soon/?toy=...).
// The schedule is data/releases.json; Release now / Delay from the admin
// dashboard are read from Supabase (release_overrides) with the secret key
// already set in Vercel (SUPABASE_URL, SUPABASE_SECRET_KEY).
// When you add a new scheduled toy, add its folder to matcher below (the
// automatic checks remind you).

export const config = {
  matcher: [
    '/web3-roles/:path*',
    '/tokenomics-basics/:path*',
    '/hall-of-fame/:path*',
    '/ways-to-moon/:path*',
    '/first-job/:path*',
    '/raise-first-round/:path*',
  ],
};

const DAY = 864e5;

// Same rule as decide() in js/releases.js (the checks compare the two).
export function decide(toy, nowMs, override, newDays) {
  let at = Date.parse(toy.date);
  const o = override || null;
  if (o && o.action === 'delay') at = o.until ? Date.parse(o.until) : NaN;
  let released;
  if (!toy.ready) released = false;
  else if (o && o.action === 'release') released = true;
  else if (o && o.action === 'delay') released = !isNaN(at) && nowMs >= at;
  else released = toy.playableNow || nowMs >= at;
  const liveAt = o && o.action === 'release' ? Math.min(Date.parse(o.updated_at || toy.date) || at, at) : at;
  const status = released ? 'live'
    : (o && o.action === 'delay') || (!toy.ready && nowMs >= Date.parse(toy.date)) ? 'delayed' : 'locked';
  return {
    status,
    at: isNaN(at) ? null : new Date(at),
    isNew: released && !toy.playableNow && nowMs >= liveAt && nowMs - liveAt < (newDays || 7) * DAY,
    toy,
  };
}

async function override(id) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !key) return null;
  const headers = { apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  try {
    const r = await fetch(`${url}/rest/v1/release_overrides?toy_id=eq.${encodeURIComponent(id)}&select=action,until,updated_at`, { headers });
    if (!r.ok) return null;
    return (await r.json())[0] || null;
  } catch {
    return null;
  }
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const folder = url.pathname.split('/')[1] || '';
  let id = folder;
  try {
    const rel = await (await fetch(new URL('/data/releases.json', url))).json();
    const toy = rel.toys.find((t) => (t.path || t.id + '/').replace(/\/$/, '') === folder);
    if (!toy) return; // not scheduled: carry on as normal
    id = toy.id;
    if (decide(toy, Date.now(), await override(toy.id), rel.newDays).status === 'live') return;
  } catch {
    // Could not check: keep it locked.
  }
  return Response.redirect(new URL(`/soon/?toy=${encodeURIComponent(id)}`, url), 307);
}
