// Refreshes data/scam-feed.js from public phishing lists published by security
// groups. Run from the project folder with:  node tools/update-scam-feed.mjs
//
// Sources (both allow reuse; see data/licenses/):
//   - MetaMask eth-phishing-detect: crypto phishing websites. New entries are
//     added at the end of its list, so we keep the newest NEWEST_SITES.
//   - Polkadot phishing list: wallet addresses used by scams.
//
// Entries on MetaMask's list of known good sites are left out.

import { writeFileSync } from 'node:fs';

const NEWEST_SITES = 20000;
const OUT = new URL('../data/scam-feed.js', import.meta.url);

const SOURCES = {
  metamask: 'https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json',
  polkadotAddresses: 'https://raw.githubusercontent.com/polkadot-js/phishing/master/address.json',
};

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  return res.json();
}

// A site entry is kept only if it looks like a plain web address, optionally
// with a path for pages on shared platforms (like sites.google.com/view/x).
const SITE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s`#]*)?$/i;
const ADDRESS = /^[A-Za-z0-9]{26,64}$/;

const metamask = await getJson(SOURCES.metamask);
const polkadot = await getJson(SOURCES.polkadotAddresses);

const allowed = new Set([...(metamask.whitelist || []), ...(metamask.fuzzylist || [])].map((d) => d.toLowerCase()));
const blacklist = metamask.blacklist || [];
const sites = [...new Set(
  blacklist.slice(-NEWEST_SITES)
    .map((d) => d.trim().toLowerCase().replace(/\/+$/, ''))
    .filter((d) => SITE.test(d) && !allowed.has(d)),
)];

const addresses = [...new Set(Object.values(polkadot).flat().filter((a) => ADDRESS.test(a)))].sort();

if (sites.length < 1000) throw new Error(`Only ${sites.length} sites came back. Not updating; check the source.`);

const today = new Date().toISOString().slice(0, 10);
const file = `// GENERATED FILE. Do not edit by hand: run  node tools/update-scam-feed.mjs
// Last updated: ${today}
//
// Reported scams from public phishing lists, used by "Check a message" in
// Spot the Scam. Your own hand-picked entries go in data/scam-known.js instead.
//
// Sources and licenses (copies in data/licenses/):
//   MetaMask eth-phishing-detect (DBAD Public License): newest ${NEWEST_SITES} reported sites
//   Polkadot phishing list (Apache License 2.0): wallet addresses used by scams

window.WEB3TOYS_SCAM_FEED = {
  updated: '${today}',
  defaultNote: 'reported on a public phishing list',
  // Entries with a path are single pages on shared platforms; match only that page.
  matchPaths: true,

  // ${sites.length} web addresses
  domains: \`
${sites.join('\n')}
\`,

  // ${addresses.length} wallet addresses
  addresses: \`
${addresses.join('\n')}
\`,
};
`;

writeFileSync(OUT, file);
console.log(`Wrote data/scam-feed.js: ${sites.length} sites, ${addresses.length} wallet addresses (${Math.round(file.length / 1024)} KB).`);
