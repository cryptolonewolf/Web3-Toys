// Downloads monthly closing prices (US dollars) for the Ride the Chart tokens
// from CryptoCompare (CoinDesk Data) and saves them in data/prices/.
//
//   CRYPTOCOMPARE_API_KEY=... node tools/fetch-prices.mjs
//
// The key is a free one from developers.coindesk.com. It is read from the
// environment and never written to any file. Each month's price is the close
// of its last day. The current month is left out because it is not finished.

import { writeFileSync } from 'node:fs';

const KEY = process.env.CRYPTOCOMPARE_API_KEY;
if (!KEY) {
  console.error('Set CRYPTOCOMPARE_API_KEY first.');
  process.exit(1);
}

// symbols: older tickers first. POL took over from MATIC one to one.
const TOKENS = [
  { id: 'BTC', name: 'Bitcoin', color: '#F7931A' },
  { id: 'ETH', name: 'Ethereum', color: '#8A92B2' },
  { id: 'SOL', name: 'Solana', color: '#9945FF' },
  { id: 'BNB', name: 'BNB', color: '#F3BA2F' },
  { id: 'XRP', name: 'XRP', color: '#23292F' },
  { id: 'ADA', name: 'Cardano', color: '#0033AD' },
  { id: 'DOGE', name: 'Dogecoin', color: '#C2A633' },
  { id: 'AVAX', name: 'Avalanche', color: '#E84142' },
  { id: 'DOT', name: 'Polkadot', color: '#E6007A' },
  { id: 'LINK', name: 'Chainlink', color: '#2A5ADA' },
  { id: 'LTC', name: 'Litecoin', color: '#A6A9AA' },
  { id: 'SHIB', name: 'Shiba Inu', color: '#FFA409' },
  { id: 'UNI', name: 'Uniswap', color: '#FF007A' },
  { id: 'TRX', name: 'TRON', color: '#FF060A' },
  { id: 'POL', name: 'Polygon (MATIC, now POL)', color: '#8247E5', symbols: ['MATIC', 'POL'], switchMonth: '2024-09' },
];

const SOURCE = 'CryptoCompare (CoinDesk Data), daily close in USD, last day of each month';
const SOURCE_URL = 'https://min-api.cryptocompare.com/documentation?key=Historical&cat=dataHistoday';

// The free key allows about 10 calls a minute, so wait between calls.
const pause = () => new Promise((r) => setTimeout(r, 7000));

async function daily(symbol) {
  const days = [];
  let toTs = Math.floor(Date.now() / 1000);
  for (let page = 0; page < 10; page++) {
    const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${symbol}&tsym=USD&limit=2000&toTs=${toTs}&api_key=${KEY}`;
    await pause();
    const res = await fetch(url);
    const body = await res.json();
    if (body.Response !== 'Success') throw new Error(`${symbol}: ${body.Message || res.status}`);
    const rows = body.Data.Data.filter((d) => d.close > 0);
    days.unshift(...rows);
    if (rows.length < body.Data.Data.length || !rows.length) break;
    toTs = body.Data.TimeFrom - 86400;
  }
  return days;
}

function monthly(days) {
  const byMonth = new Map();
  for (const d of days) byMonth.set(new Date(d.time * 1000).toISOString().slice(0, 7), d.close);
  const thisMonth = new Date().toISOString().slice(0, 7);
  byMonth.delete(thisMonth);
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const round = (p) => Number(p.toPrecision(6));
const snapshot = new Date().toISOString().slice(0, 10);

for (const t of TOKENS) {
  let months = [];
  if (t.symbols) {
    const [oldSym, newSym] = t.symbols;
    const before = monthly(await daily(oldSym)).filter(([m]) => m < t.switchMonth);
    const after = monthly(await daily(newSym)).filter(([m]) => m >= t.switchMonth);
    months = [...before, ...after];
  } else {
    months = monthly(await daily(t.id));
  }
  const file = {
    _help: `Monthly closing prices for ${t.name} in US dollars. Downloaded by tools/fetch-prices.mjs. Check a few months against the source before going live, then set review to false.`,
    id: t.id,
    name: t.name,
    currency: 'USD',
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    snapshot,
    review: true,
    ...(t.symbols ? { note: `${t.symbols[0]} prices before ${t.switchMonth}, ${t.symbols[1]} from then on (swapped one to one).` } : {}),
    monthly: months.map(([m, p]) => [m, round(p)]),
  };
  const json = JSON.stringify(file).replace('"monthly":[', '"monthly":[\n').replace(/\],\[/g, '],\n[');
  writeFileSync(`data/prices/${t.id}.json`, json + '\n');
  console.log(`${t.id}: ${months.length} months, ${months[0][0]} to ${months.at(-1)[0]}`);
}

writeFileSync('data/prices/index.json', JSON.stringify({
  _help: 'The tokens in Ride the Chart. Each has a file data/prices/<id>.json with one closing price per month in US dollars. tools/fetch-prices.mjs downloads them.',
  sample: false,
  source: SOURCE,
  sourceUrl: SOURCE_URL,
  snapshot,
  review: true,
  tokens: TOKENS.map(({ id, name, color }) => ({ id, name, color })),
}, null, 2) + '\n');
console.log('Saved. Snapshot', snapshot);
