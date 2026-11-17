// Link preview pictures from each page's own cover (the drawn cards in
// js/home-cards.js): images/og/ID.png, 1200 x 630, the cover with the
// web3.toys logo and one line under it. Then sets og:image and
// twitter:image on that page to its picture (the other pages keep the
// web3.toys picture).
// Needs Playwright and the local preview running:
//   CERT_SECRET=test PORT=3001 node tools/dev-server.mjs
//   node tools/og-covers.mjs [http://localhost:3001]
// Run it again after adding a toy, a tool or a page banner.

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://web3.toys/';

// Which page shows which cover, and the line under it.
export function covers() {
  const home = JSON.parse(readFileSync(root + 'data/home.json', 'utf8'));
  const ids = new Set([...readFileSync(root + 'js/home-cards.js', 'utf8').matchAll(/^ {4}'?([a-z0-9-]+)'?: \{/gm)].map((m) => m[1]));
  const list = [];
  home.shelves.forEach((s) => s.cards.forEach((c) => {
    if (!c.path || !ids.has(c.id)) return;
    const tool = c.id.startsWith('tool-');
    list.push({ id: c.id, title: c.title, page: c.path + 'index.html',
      line: tool ? 'Free tool for web3 builders · runs in your browser' : c.id === 'academy' ? 'Learn real web3 projects, earn their Pro badge' : 'Free · ' + (c.time || '5 min') + ' · ends with a certificate' });
  }));
  [['launch-your-toy', 'Launch Your Own Toy', 'launch-your-toy/', 'For web3 projects: a playable toy about your product'],
    ['test-your-product', 'Test Your Product', 'test-your-product/', 'For web3 projects: real people test it before launch'],
    ['advertise', 'Sponsor a Toy', 'advertise/', 'For web3 projects: one small, labelled card'],
    ['list-your-project', 'List Your Quest', 'academy/list-your-project/', 'For web3 projects: lessons, a quiz and a Pro badge'],
    ['my-page', 'Claim My Page', 'my-page/', 'One link for your project or content, verified via X'],
    ['pages', 'Web3 Pages', 'pages/', 'Projects, creators and personalities on web3.toys'],
    ['book-a-call', 'Book a Call', 'book-a-call/', 'Marketing and growth calls for web3 teams'],
    ['testers', 'Become a Tester', 'testers/', 'Test new web3 products before anyone else'],
  ].forEach(([id, title, path, line]) => { if (ids.has(id)) list.push({ id, title, page: path + 'index.html', line, banner: true }); });
  return list;
}

// Points one page's share tags at its picture.
export function tag(html, c) {
  const url = SITE + 'images/og/' + c.id + '.png';
  // Replacer functions, so a title with $ (like "$100") is taken as is.
  const alt = c.title.replace(/"/g, '&quot;') + ' on web3.toys';
  return html
    .replace(/(<meta property="og:image" content=")[^"]*(")/, (m, a, b) => a + url + b)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, (m, a, b) => a + url + b)
    .replace(/<meta property="og:image:alt" content="[^\n]*\/>/, () => '<meta property="og:image:alt" content="' + alt + '" />');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const base = process.argv[2] || 'http://localhost:3001';
  const require = createRequire(import.meta.url);
  const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
  mkdirSync(root + 'images/og', { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  for (const c of covers()) {
    await page.evaluate((c) => {
      const esc = (s) => String(s).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[x]);
      document.body.innerHTML = `<div id="shot" style="position:fixed;inset:0;width:1200px;height:630px;background:#FFF8E1;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:38px 50px 30px;box-sizing:border-box;color:#1F1B2E;overflow:hidden">
        <div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg, rgba(255,217,61,.2) 0 18px, transparent 18px 40px)"></div>
        <div class="xcard xcard--${esc(c.id)}${c.banner ? ' page-cover' : ''}" style="position:relative;width:1080px;border-radius:40px">${window.Web3Cards.card(c.id, c.title, esc)}</div>
        <div style="position:relative;display:flex;align-items:center;gap:16px;width:1080px">
          <img src="images/brand/web3toys-icon.svg" width="68" height="68">
          <span style="font:700 42px Fredoka,sans-serif">web3.toys</span>
          <span style="margin-left:auto;font:800 28px Nunito,sans-serif;color:#3D3750">${esc(c.line)}</span>
        </div></div>`;
    }, c);
    await page.waitForTimeout(400);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.locator('#shot').screenshot({ path: root + 'images/og/' + c.id + '.png' });
    const file = root + c.page;
    writeFileSync(file, tag(readFileSync(file, 'utf8'), c));
  }
  await browser.close();
  console.log(`Made ${covers().length} pictures in images/og/ and set them on their pages. To make them smaller: python3 tools/shrink-png.py images/og`);
}
