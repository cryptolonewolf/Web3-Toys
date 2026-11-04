// Builds the Hall of Fame person pages and marketing posts from
// data/hall-of-fame-people.json:
//   hall-of-fame/ID/index.html      one page per person, with X preview tags
//   marketing/hall-of-fame/ID.md    ready posts that tag them
//   marketing/hall-of-fame/README.md  the list and how to use it
// Run: node tools/hof-build.mjs   (the checks fail if these are out of date)
// The preview images (images/people/cards/ID.png) come from tools/hof-cards.mjs.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const data = JSON.parse(readFileSync(root + 'data/hall-of-fame-people.json', 'utf8'));
const cats = Object.fromEntries(data.categories.map((c) => [c.id, c]));
const SITE = 'https://web3.toys';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const tag = (p) => (p.x && !p.caution ? '@' + p.x : p.name);
const link = (p) => `${SITE}/hall-of-fame/${p.id}/`;

export function page(p) {
  const title = p.caution ? `${p.name}: a cautionary tale · web3.toys` : `${p.name} · web3.toys Hall of Fame`;
  const desc = p.story;
  const img = `${SITE}/images/people/cards/${p.id}.png`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="web3.toys" />
    <meta property="og:title" content="${esc(p.caution ? p.name + ': a cautionary tale' : p.name + ' is in the web3.toys Hall of Fame')}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${link(p)}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="675" />
    <meta property="og:image:alt" content="${esc(p.name)}, ${esc(p.role)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@web3toys" />
    <meta name="twitter:title" content="${esc(p.name)} · Web3 Hall of Famers" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${img}" />
    <meta name="theme-color" content="#FFD93D" />
    <link rel="canonical" href="${link(p)}" />
    <link rel="icon" href="../../images/brand/web3toys-icon.svg" type="image/svg+xml" />
    <link rel="icon" href="../../images/brand/favicon-32x32.png" sizes="32x32" type="image/png" />
    <link rel="apple-touch-icon" href="../../images/brand/apple-touch-icon-180x180.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bangers&family=Bungee&family=Chewy&family=Fredoka:wght@500;600;700&family=Luckiest+Guy&family=Nunito:wght@600;700;800&display=swap" />
    <link rel="stylesheet" href="../../styles/toys.css" />
  </head>
  <body data-toy="hall-of-fame" data-person="${esc(p.id)}">
    <header id="topbar" class="topbar">
      <div class="topbar-inner"><a class="logo" href="../../">web3.toys</a></div>
    </header>

    <div class="page">
      <p class="small-print"><a href="../">← Web3 Hall of Famers</a></p>
      <main id="app" class="stack" aria-live="polite">
        <noscript>
          <h1>${esc(p.name)}</h1>
          <p>${esc(p.role)}. ${esc(p.story)}</p>
        </noscript>
      </main>

      <footer class="site-footer">
        <p><strong>Educational only. Not financial advice. web3.toys does not endorse anyone listed.</strong></p>
        <p>web3.toys · by BuildWithAki</p>
      </footer>
    </div>

    <script src="../../js/site.js"></script>
    <script src="../../config.js"></script>
    <script src="../../js/common.js"></script>
    <script src="../../js/hof-card.js"></script>
    <script src="../../js/hof-person.js"></script>
  </body>
</html>
`;
}

export function posts(p) {
  const cat = cats[p.cat] || {};
  const lines = [
    `# ${p.name}`,
    '',
    `${cat.icon || ''} ${cat.title || ''} · ${p.level} · ${p.caution ? 'cautionary tale (never tag, keep it factual)' : p.x ? 'tag @' + p.x + ' (check the handle first)' : 'no handle to tag'}`,
    '',
    `Page: ${link(p)}  `,
    `Card image: images/people/cards/${p.id}.png (1200 x 675; the page link shows it on X by itself)`,
    '',
  ];
  if (p.caution) {
    lines.push('## Post', '', `A lesson from ${p.name}: ${p.why}.`, '', `${p.fun}.`, '', `Big names and big promises do not remove risk. Learn the story in 5 minutes: ${link(p)}`, '');
  } else {
    lines.push(
      '## Induction post (@web3toys)', '',
      `🏛️ ${tag(p)} is in the web3.toys Hall of Fame.`, '', `${p.why}.`, '', `Fun fact: ${p.fun}.`, '', `Can you name all 50 web3 builders? ${link(p)}`, '',
      '## Fun fact (short)', '',
      `Fun fact about ${p.name}: ${p.fun}. ${tag(p)} is one of the 50 Web3 Hall of Famers. ${link(p)}`, '',
      '## Story thread (@web3toys)', '',
      `1/ ${tag(p)}, in three sentences 🧵`, '', ...p.story.split(/(?<=\.)\s+/).map((x, i) => `${i + 2}/ ${x}`), '',
      `${p.story.split(/(?<=\.)\s+/).length + 2}/ Known for: ${(p.known || []).join(', ')}. Meet all 50 Web3 Hall of Famers: ${link(p)}`, '',
      '## Stat post (fill in the number from the person page once 20+ players have played)', '',
      `Only __% of players named ${tag(p)} from this clue: "${p.why}". Can you? ${link(p)}`, '',
      '## Founder post (@BuildWithAki)', '',
      `Building web3.toys, I made a game about the people who built web3. ${tag(p)} is in it: ${p.why.charAt(0).toLowerCase() + p.why.slice(1)}. Play it and tell me who I missed: ${link(p)}`, '',
    );
  }
  if (p.check) lines.push('## Before posting', '', `- ${p.check}`, '');
  return lines.join('\n');
}

function readme() {
  return [
    '# Hall of Fame marketing kit',
    '',
    'One file per person with ready posts. Every page link shows that person\'s card on X by itself.',
    '',
    'How to use: post one builder a day from @web3toys (the induction post), quote it from @BuildWithAki, and once a person page shows a percentage, post the stat version. Tagging people only works if the handle is right: check each one on X first. Never tag the cautionary tales.',
    '',
    '| # | Person | Group | Level | Tag |',
    '|---|---|---|---|---|',
    ...data.people.map((p, i) => `| ${i + 1} | [${p.name}](${p.id}.md) | ${(cats[p.cat] || {}).title || ''} | ${p.level} | ${p.caution ? 'never' : p.x ? '@' + p.x : '-'} |`),
    '',
  ].join('\n');
}

export function build(write) {
  const files = {};
  data.people.forEach((p) => {
    files[`hall-of-fame/${p.id}/index.html`] = page(p);
    files[`marketing/hall-of-fame/${p.id}.md`] = posts(p);
  });
  files['marketing/hall-of-fame/README.md'] = readme();
  if (write) {
    Object.entries(files).forEach(([f, body]) => {
      mkdirSync(root + f.replace(/\/[^/]+$/, ''), { recursive: true });
      writeFileSync(root + f, body);
    });
  }
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const n = Object.keys(build(true)).length;
  console.log(`Wrote ${n} files.`);
}
