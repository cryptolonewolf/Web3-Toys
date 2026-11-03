// POST /api/save-cert  { code, name }  with header Authorization: Bearer <login token>
// Saves a certificate to the logged-in person's account, but only after
// checking its secret code here on the server, so ranks cannot be faked.
// Needs these Vercel settings: CERT_SECRET, SUPABASE_URL and
// SUPABASE_SECRET_KEY (the secret key from Supabase, never in the browser).

const { verify, send, readBody } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  const secret = process.env.CERT_SECRET;
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!secret || !url || !key) return send(res, 503, { error: 'Saving certificates is not switched on yet.' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return send(res, 401, { error: 'Log in first.' });

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return send(res, 400, { error: 'Could not read the certificate.' });
  }
  const cert = verify(secret, body.code, body.name);
  if (!cert) return send(res, 400, { error: 'That certificate code does not match the name.' });

  try {
    // Who is logged in: Supabase checks the login token.
    const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (!who.ok) return send(res, 401, { error: 'Your login has expired. Log in again.' });
    const user = await who.json();
    if (!user || !user.id) return send(res, 401, { error: 'Log in first.' });

    const saved = await fetch(`${url}/rest/v1/rpc/record_certificate`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user: user.id, p_toy: cert.toy, p_title: cert.title, p_score: cert.score, p_code: cert.code, p_name: cert.name, p_date: cert.date }),
    });
    if (!saved.ok) return send(res, 502, { error: 'Could not save the certificate. Try again later.' });
    return send(res, 200, { saved: true, certificate: cert });
  } catch (e) {
    return send(res, 502, { error: 'Could not reach the database. Try again later.' });
  }
};
