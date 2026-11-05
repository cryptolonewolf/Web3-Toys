// Writes the launch kit for every toy in data/releases.json:
//   marketing/launches/ID.md   teaser, sneak peek, launch thread, posts,
//                              Telegram, LinkedIn (career and builder toys),
//                              email, 30 second video script, recap
//   marketing/launches/README.md  the calendar and how to use the kit
// Run: node tools/launch-kit.mjs   (the checks fail if these are out of date)
// Pictures: tools/launch-images.mjs.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const rel = JSON.parse(readFileSync(root + 'data/releases.json', 'utf8'));
const home = JSON.parse(readFileSync(root + 'data/home.json', 'utf8'));
const SITE = 'https://web3.toys';
const cards = {};
const shelfOf = {};
home.shelves.forEach((s) => s.cards.forEach((c) => { cards[c.id] = c; shelfOf[c.id] = s.id; }));

const day = (iso, long) => new Date(iso).toLocaleDateString('en-GB', long
  ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }
  : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '');
const minus = (iso, days) => new Date(Date.parse(iso) - days * 864e5).toISOString();
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
// Career and builder toys also get a LinkedIn post.
const LINKEDIN = (t) => ['careers', 'pros'].includes(shelfOf[t.id]) || ['token-simulator', 'token-split'].includes(t.id);

export function kit(t) {
  const c = cards[t.id] || {};
  const title = c.title || t.id;
  const topic = c.topic && c.topic !== title ? ` (${c.topic})` : '';
  const link = t.playableNow ? `${SITE}/${c.path}` : `${SITE}/soon/?toy=${t.id}`;
  const play = `${SITE}/${c.path || t.path || t.id + '/'}`;
  const when = day(t.date);
  const whenLong = day(t.date, true);
  const launchDay = t.playableNow;
  const img = (k, f) => `img/${t.id}-${k}-${f}.png`;
  const L = [];
  L.push(`# ${title}${topic}`, '');
  L.push(`Launch: **${whenLong}, 10:00 India time**${launchDay ? ' (launch day: one of the first toys)' : ''}  `);
  L.push(`Hook: ${t.hook}  `);
  L.push(`For: ${t.persona}  `);
  L.push(`Link: ${play}${t.playableNow ? '' : ' (before launch it shows the teaser page with Notify me: ' + link + ')'}  `);
  L.push(`Time to play: ${c.time || '5 min'} · Free · Ends with a certificate · Early Bird: first 1,000 certificates get 2x coins`, '');
  L.push(`Pictures: ${img('teaser', 'x')} and ${img('teaser', 'story')} before launch; ${img('launch', 'x')} and ${img('launch', 'story')} on launch day.`, '');
  L.push('Check every fact and number in the toy before posting. Never promise returns.', '');

  L.push(`## 1. Teaser post (@web3toys, ${day(minus(t.date, 3))})`, '', `Picture: ${img('teaser', 'x')}`, '', '```',
    `Something new lands on web3.toys this ${when.split(' ')[0]} 👀`, '', `${t.hook}`, '', `${title}. ${c.time || '5 min'}, free, ends with a certificate.`,
    `The first 1,000 to earn it get 2x coins 🐣`, '', `Get a reminder: ${link}`, '```', '');

  L.push(`## 2. Sneak peek (@web3toys, ${day(minus(t.date, 1))})`, '', `Picture: ${img('teaser', 'story')} (stories) or a 10 second screen recording of the first screen`, '', '```',
    `Tomorrow, 10:00 India time.`, '', `Here is a peek at ${title} 👇`, '', `${c.blurb || t.hook}`, '', `Tap Notify me and we email you when it opens: ${link}`, '```', '');

  L.push(`## 3. Launch thread (@web3toys, ${when} 10:00)`, '', `Picture on the first post: ${img('launch', 'x')}`, '', '```',
    `1/ ${title} is live on web3.toys 🚀`, '', `${t.hook}`, '', `Free, ${c.time || '5 minutes'}, no sign-up needed to play.`, '',
    `2/ Who it is for: ${lower(t.persona)}.`, '',
    `3/ What you get: ${c.blurb || t.hook}`, '',
    `4/ It ends with a short quiz and a certificate anyone can verify. The first 1,000 logged-in players to earn it get an Early Bird spot and 2x coins 🐣`, '',
    `5/ Play it here: ${play}`, '', `Tell us your score 👇`, '```', '');

  L.push(`## 4. Launch post (@BuildWithAki)`, '', `Quote the thread above, or post with ${img('launch', 'x')}:`, '', '```',
    `I just shipped ${title} on web3.toys.`, '', `I built it for ${lower(t.persona)}: ${lower(t.hook)}`, '',
    `5 minutes, free, and you leave knowing something you did not know this morning.`, '', `${play}`, '```', '');

  L.push(`## 5. Telegram post`, '', '```', `🚀 New on web3.toys: ${title}`, '', `${t.hook}`, '', `⏱ ${c.time || '5 min'} · free · certificate at the end`,
    `🐣 Early Bird: the first 1,000 to earn the certificate get 2x coins`, '', `👉 ${play}`, '```', '');

  if (LINKEDIN(t)) {
    L.push(`## 6. LinkedIn post`, '', `Picture: ${img('launch', 'x')}`, '', '```', `I launched ${title} on web3.toys today.`, '',
      `${t.hook}`, '', `It is built for ${lower(t.persona)}. Instead of a long article, it is a 5 minute interactive toy that ends with a short quiz and a certificate you can share.`, '',
      `It is free. I would love your feedback, especially if you hire for or work in web3.`, '', `${play}`, '', `#web3 #crypto #learning #careers`, '```', '');
  }

  L.push(`## ${LINKEDIN(t) ? 7 : 6}. Emails (sent by the site to everyone who tapped Notify me)`, '',
    `Day before: **Tomorrow at 10:00: ${title} unlocks on web3.toys**`, `Launch morning: **${title} is live on web3.toys**`, '',
    'Body: the teaser or launch picture, the hook line, "You asked us to tell you", the Early Bird counter and a button. Sent automatically once Resend is set up (docs/setup/launch-emails.md).', '');

  L.push(`## ${LINKEDIN(t) ? 8 : 7}. 30 second video script (vertical, for Reels, Shorts and X)`, '', '| Time | On screen | Voice or caption |', '|---|---|---|',
    `| 0 to 3 s | The cover, ${img('launch', 'story')} | "${t.hook.split(/[.:?]/)[0]}?" |`,
    `| 3 to 10 s | Tap Start, the first screen | "${title}: a free 5 minute toy on web3.toys." |`,
    `| 10 to 22 s | Fast cuts of playing, one wrong answer, one right answer | "${(c.blurb || t.hook).split('.')[0]}." |`,
    `| 22 to 27 s | The certificate with the Early Bird stamp | "Finish it and get a certificate. The first 1,000 get 2x coins." |`,
    `| 27 to 30 s | web3.toys logo and the link | "Play it free at web3.toys." |`, '');

  L.push(`## ${LINKEDIN(t) ? 9 : 8}. Recap post (a week after launch; fill in the numbers from admin, Releases)`, '', '```',
    `One week of ${title} on web3.toys:`, '', `🎮 __ plays`, `🎓 __ certificates`, `🐣 __ of 1,000 Early Bird spots taken`, '',
    `Most missed question: __`, '', `Still free, still 5 minutes: ${play}`, '```', '');
  return L.join('\n');
}

function readme() {
  const rows = rel.toys.map((t) => {
    const c = cards[t.id] || {};
    return `| ${day(t.date)} | [${c.title || t.id}](${t.id}.md) | ${t.playableNow ? 'launch day' : t.ready ? 'ready' : 'not built yet'} |`;
  });
  return ['# Launch kits', '', 'One file per toy, with every post ready to copy, plus four pictures each in `img/` (X 1200 x 675 and stories 1080 x 1920, teaser and launch).', '',
    'A simple rhythm for each drop: teaser 3 days before, sneak peek the day before, launch thread at 10:00 on the day, founder post and Telegram the same hour, LinkedIn for career and builder toys, recap a week later. Launch emails go out by themselves.', '',
    '| Date | Toy | Status |', '|---|---|---|', ...rows, '',
    'Remake after changing dates or hooks: `node tools/launch-kit.mjs`, and for pictures `node tools/launch-images.mjs` then `python3 tools/shrink-png.py marketing/launches/img`.', ''].join('\n');
}

export function build(write) {
  const files = {};
  rel.toys.forEach((t) => { files[`marketing/launches/${t.id}.md`] = kit(t); });
  files['marketing/launches/README.md'] = readme();
  if (write) {
    mkdirSync(root + 'marketing/launches', { recursive: true });
    Object.entries(files).forEach(([f, b]) => writeFileSync(root + f, b));
  }
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(`Wrote ${Object.keys(build(true)).length} files.`);
}
