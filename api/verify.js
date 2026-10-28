// GET /api/verify?code=W3T-...&name=...
// Says whether a certificate code is genuine for that name.

const { verify, send, query } = require('./_lib');

module.exports = (req, res) => {
  const secret = process.env.CERT_SECRET;
  if (!secret) return send(res, 503, { error: 'Verification is not switched on yet.' });
  const q = query(req);
  const cert = verify(secret, q.code, q.name);
  send(res, 200, cert ? { valid: true, certificate: cert } : { valid: false });
};
