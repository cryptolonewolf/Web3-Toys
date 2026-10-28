// Runs the site and its server functions on your computer, like Vercel does.
//   node tools/dev-server.mjs        then open http://localhost:3000
// Uses a made-up test key for certificates; real ones need CERT_SECRET in Vercel.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 3000);
process.env.CERT_SECRET = process.env.CERT_SECRET || 'local-test-key-not-for-real-certificates';

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/quizzes/') || url.pathname.startsWith('/api/_')) {
    res.writeHead(302, { Location: '/' });
    return res.end();
  }
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/\.js$/, '');
    try {
      const handler = require(join(ROOT, 'api', `${name}.js`));
      req.query = Object.fromEntries(url.searchParams);
      return await handler(req, res);
    } catch (e) {
      res.writeHead(404);
      return res.end('Not found');
    }
  }
  let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`web3.toys running at http://localhost:${PORT}`));
