# web3.toys

Free five minute toys that teach crypto and web3, each with a quiz and a
certificate. By BuildWithAki. Educational only, not financial advice.

It is a plain website (HTML, CSS and JavaScript) plus three tiny server
functions on Vercel that mark quizzes and check certificates. No framework, no
database, no login, nothing to install.

## What is where

| Folder or file | What it is |
| --- | --- |
| `config.js` | Your settings: email signup form address, Book a call with Aki link, mascot pictures, analytics. |
| `index.html` | The home page with four sections: Games, For Beginners, For Degens and For Pros. |
| `crypto-in-5/`, `getting-started/`, `dont-lose-money/`, `earn-small/` | The four Getting Started toys: Genesis Block, Not Your Keys, Don't Get Rekt and Stack Sats. |
| `builder/` | The Tools section for builders, one folder per tool. |
| `academy/` | The Project Academy: courses, the course page and List your project. |
| `real-toys/`, `books/`, `about/`, `book-a-call/` | Real Toys, Books by Aki, About Aki and Book a Call. |
| `js/site.js` | The top menu, footer links, logo, icons and fun effects. The menu list is at the top. |
| `progress/` | My Progress: rank and certificates. |
| `verify/` | Where anyone can check a certificate. |
| `data/` | All the words on the site. See "Edit the content" below. |
| `quizzes/` | Quiz questions and answers. Never shown to visitors. |
| `api/` | The three server functions (quiz, mark, verify). |
| `styles/toys.css` | The one shared look. Colours and fonts are at the top. |
| `images/covers/` | Home page cover pictures, one per toy (see the list inside). Until a picture is there, a drawn placeholder shows. |
| `assets/` | The logo (`logo.svg`), toy covers (`covers/`), mascot pictures (`mascot/`) and the site icon. |
| `scam/`, `simulator/` | Spot the Scam (a live card in Play and Learn, also linked from How Not to Lose Money) and the Launch a Token Simulator (coming soon). |
| `tests/`, `tools/` | Automatic checks and helper scripts. Not part of the live site. |

## One-time setup: switch on certificates

Certificates are stamped with a secret key that only your Vercel account
knows. Until you add it, quizzes still work, but passing says certificates are
not switched on yet.

1. Make up a long random password, at least 32 characters. A password manager
   can generate one. Do not share it or put it in any file.
2. In Vercel, open the web3-toys project, then **Settings**, then
   **Environment Variables**.
3. Add a variable named `CERT_SECRET` with your password as the value, for all
   environments.
4. Open **Deployments**, click the three dots on the latest one, and choose
   **Redeploy**.

Never change `CERT_SECRET` later: certificates made with the old key would stop
verifying.

## Your settings (`config.js`)

- `signup.endpoint`: the form address from your email tool. Until then the
  signup box says signups open soon. The site never stores emails itself.
- `bookCallUrl`: your booking page for Book a call with Aki.
- `mascot`: which picture shows for each mood (grin, thinking, worried,
  celebrating) and the signed one on About. All pictures live in
  `assets/mascot/`. To use a new drawing, save it there (a PNG or WEBP with a
  see-through background works best) and put its file name here. If a picture
  is missing, a simple placeholder drawing shows instead.
- `analytics.scriptUrl` and `analytics.siteId`: from your analytics tool. While
  empty, nothing is tracked. The site sends events like quiz started, quiz
  finished, certificate earned and certificate shared.

## Tools for builders

The Tools section lives at web3.toys/builder/ (the folder is called
`builder/` because `tools/` holds the private helper scripts). The list of
tools is in `data/tools/tools.json`; each tool's defaults, templates and
limits are in `data/tools/`. Every tool runs in the browser only, remembers
its inputs on the visitor's device, and has Download PDF (the browser's print
window, "Save as PDF"), Download PNG, Copy and Reset.

- Tokenomics Generator (`builder/tokenomics/`): groups, the three starting
  templates and the warning rules are in `data/tools/tokenomics.json`.
- Market Cap and FDV Calculator (`builder/mcap-fdv/`): example presets and
  the one line explanations are in `data/tools/mcap-fdv.json`.
- Launch Budget Planner (`builder/launch-budget/`): budget lines, their rough
  typical ranges (marked `"review": true` for you to check), templates and
  runway limits are in `data/tools/budget_ranges.json`.
- Pitch Deck Builder (`builder/pitch-deck/`): the questions (one step per
  slide) are in `data/tools/pitch-deck.json`; the 10 visual templates (fonts,
  colours, decoration) in `data/tools/deck_templates.json`.
- Cap Table and Dilution Simulator (`builder/cap-table/`): the starting
  founders, rounds, round types and chart colours are in
  `data/tools/cap-table.json`.
- SAFT and Agreement Templates (`builder/agreements/`): the lawyer warning
  and template list are in `data/tools/templates/index.json`; each template's
  form fields and clause text (with `{{blanks}}`) in
  `data/tools/templates/<id>.json`. All marked `"review": true`.
- Meme Coin Launch Kit (`builder/meme-kit/`): name patterns, launch word
  templates, banned promise words, logo shapes, colours and emojis, the
  pump.fun info sheet fields and the required Launch responsibly checklist
  are in `data/tools/meme-kit.json`.
- KOL Vetting Scorecard (`builder/kol-scorecard/`): the scoring bands,
  reasons, red flags, grades and ROI defaults are in
  `data/tools/kol-scorecard.json` (rules of thumb, marked for review).
- Airdrop Campaign Planner (`builder/airdrop-planner/`): eligibility rules,
  anti-farming ideas, sharing methods and tiers, timeline steps and warnings
  are in `data/tools/airdrop.json`.
- Official Links Checker (`builder/links-checker/`): the official domains
  (exchanges, wallets, explorers, apps), the three result texts and the
  look-alike reasons are in `data/tools/official_domains.json`. Verify every
  domain before going live; projects change domains.
- Gas and Unit Converter (`builder/gas-converter/`): units, typical gas per
  action, the Solana base fee and the defaults are in `data/tools/gas.json`.
- Launch Readiness Checklist (`builder/launch-checklist/`): the 30 checks,
  their weights, the grades and the full report link (`reportUrl`, now a
  placeholder `#`) are in `data/tools/launch-checklist.json`.

## Project Academy

Short sponsored courses about web3 projects, at web3.toys/academy/.

- Each course has a public file `data/academy/<id>.json` (name, logo, colours,
  X handle, website, chain, category, lessons, `vetted` and
  `sponsored_until`) and a private question pool
  `quizzes/academy/<id>.json` (15 to 30 questions with answers, never shown
  to visitors; the server marks them). List new courses in
  `data/academy/index.json` and in `quizzes/academy/index.json`, with a new
  two character `code` (used in W3P certificate codes; never reuse one).
- A course only shows while `vetted` is true and `sponsored_until` has not
  passed. Logos and lesson pictures go in `assets/academy/<id>/`.
- Each attempt draws 10 questions, 20 seconds each, 80% to pass. A fail locks
  retries for 10 minutes on that device. Passing gives a "[Project] Pro" tag
  (shown on My Progress, counts toward the rank) and a certificate in the
  project's colours, checkable at web3.toys/verify.
- The List your project page: words in `data/academy/listing.json`; the price
  and the application form link are `academy.price` and `academy.formUrl` in
  `config.js`. The templates projects fill in are
  `assets/academy/course-template.md` and `course-template.json`.
- Lumen Protocol is a made up sample course for testing.

## Coins

Players earn coins for opening the first toy of the day, finishing a game,
earning a certificate, sharing a result card and posting on X (amounts under
`points` in `config.js`, and the same in `coin_rules` in
`supabase/003_progress.sql`). Coins are site points only: no cash value, never
withdrawn, sold or swapped. They unlock cosmetic extras (certificate styles,
badge frames, profile themes), listed in `data/cosmetics.json` with the same
ids and prices as `cosmetic_items` in the database file.

Visitors' coins live in their browser. Logged-in players' coins, certificates
and extras are saved to their account by `js/sync.js`: the database gives
coins (once each, with daily limits), and certificates are only saved by
`api/save-cert.js` after it checks the secret code. On first login the
browser's earlier coins move into the account once, capped at 1,000.
The leaderboard (`leaderboard/`) shows display names, pictures, ranks and
coins only. Setup: `docs/setup/part-2-progress.md`.

## Edit the content

Every file below is plain text in JSON format. Keep the quotes and commas as
they are, and only change the words between the quotes. Each file starts with
a `_help` line explaining it.

| What | File |
| --- | --- |
| Home page tagline, shelves and cards | `data/home.json` (each card: `color` and `object` for its placeholder cover) |
| Ranks | `data/ranks.json` (add a row with a higher `min` to add a rank) |
| A toy's cards | `data/toys/<toy>.json` |
| A toy's quiz | `quizzes/<toy>.json` (5 to 8 questions; `answer` must match one option exactly) |
| Trending panel | `data/trending.json` (change the date when you update it) |
| Finish screen and share wording | `data/funnel.json` |
| Shop panel on each toy page | `data/shop.json` (leave `url` empty and the button says Coming soon) |
| Books page | `data/books.json` |
| Real Toys page | `data/real-toys.json` |
| About Aki page | `data/about.json` (replace the lines starting with TODO) |
| Book a Call page | `data/book-a-call.json` (the button uses `bookCallUrl` in `config.js`) |

### Toy names, fonts and colours

Each Getting Started toy has a name, a cover picture, a heading font and an
accent colour. They are set in three places, so change all three when you
rename one: its card in `data/home.json` (`title`, `topic`, `font`, `accent`,
`cover`), its own `index.html` (the title at the top, `data-font` and
`data-accent`), and its title in `quizzes/index.json` (shown on certificates).
Fonts: `luckiest`, `bungee`, `bangers`, `chewy`. Colours: `blue`, `mint`,
`coral`, `violet`, `yellow`. The site uses six fonts in total; adding more
slows pages down.

### Real Toys interest

Taps on "I want this" are sent to your analytics tool as `real_toy_vote`. The
Notify me form sends the email to your email tool (the `signup` address in
`config.js`) with the chosen toys in a field called `interest`.

To check a JSON file after editing, paste it into any free "JSON validator"
website. A missing comma or quote is the usual problem.

### Toy card types

`story` (text and bullet points), `reveal` (tiles you tap to flip), `pick`
(choose an answer, one marked `"correct": true`), `steps` (tap to open each
step) and `trending` (shows `data/trending.json`). Any card can have `aki`
(what the mascot says), `mascot` (`grin`, `thinking`, `worried` or
`celebrating`), `points`, `tip` and `link`.

### Add a new toy later

1. Copy a toy folder, for example `earn-small/`, give it a new name, and change
   the title, description and `data-toy` inside its `index.html`.
2. Add `data/toys/<new-id>.json` and `quizzes/<new-id>.json`.
3. Add it to `quizzes/index.json` with a new unused `letter`.
4. Add its card to a section in `data/home.json`, with `"status": "live"`.

## Preview your changes

Every change saved to GitHub gets its own Vercel preview link (find it under
**Deployments** in Vercel, or on the GitHub page for the change). Open that
link to try the change before it reaches web3.toys.

Pages opened by double-clicking a file on your computer cannot load their
content or quizzes; use a preview link instead. A developer can run the whole
site locally with `node tools/dev-server.mjs`, then open http://localhost:3000.

## Progress and privacy

Progress (certificates and rank) is saved only in the visitor's browser.
Clearing browser data or switching device starts fresh, but certificate codes
keep verifying. The name on a certificate is used to stamp and check it and is
not stored by web3.toys.

## Run the automatic checks

```
node --test tests/*.test.mjs
```

These check quiz marking, certificate codes, ranks, that every content file is
complete, and the older Spot the Scam and simulator logic.

## Spot the Scam and the simulator

- Spot the Scam message checker: every rule is in `data/scam_rules.json`,
  grouped into ten categories. Each rule has a name, a category, points, a one
  line explanation and the phrases or patterns it matches. The total is capped
  at 100; a seed phrase or private key request goes straight to 100. Levels:
  Critical 80+, High 60+, Medium 30+, Low under 30. After changing rules, run
  the checks: `data/test_messages.json` holds 10 scam and 5 normal messages
  that must keep their scores. Reported scams go in `data/scam-known.js`; the
  public phishing lists in `data/scam-feed.js` refresh every Sunday.
- Spot the Scam game: `data/scam-scenarios.js` and `data/scam-game.js`.
- Fish the Dead Projects: catches in `data/dead_projects.json` (20 detailed
  ones with sources, plus 75 projects shut down in 2026 from the CoinStats
  tracker, with only a name and date so far), words and settings in
  `data/dead-projects.json`. Every entry has `"review": true` until checked.
  The shark dive shows all of them in date order (oldest first); the
  fishing game hunts for rare ones.
- Rug or Real (Read the Token Split): made up tokens in
  `data/token_splits.json` (each split adds up to 100, with a verdict and a
  one line why), words and scoring in `data/token-split.json`.
- The Vault Dive (Famous Web3 Hacks): the hacks are in `data/hacks.json`
  (one floor each, smallest first, every one with a source link and
  `"review": true` until you have checked it), words and scoring in
  `data/web3-hacks.json`, quiz in `quizzes/web3-hacks.json` (certificate
  letter E).
- Ride the Chart (What If You Invested $100): words and settings in
  `data/invest-100.json`, prices in `data/prices/` (one file per token, one
  closing price per month). To download or refresh the prices, a developer
  runs `CRYPTOCOMPARE_API_KEY=... node tools/fetch-prices.mjs` with a free
  key from developers.coindesk.com. Every price file records its source and
  snapshot date and starts with `"review": true`; check a few months against
  the source, then set it to false. Until real prices are in, a made up
  Testcoin is used and the page says so.
- Simulator content: `data/simulator.js`. It is on the home page as Coming
  soon in Play and Learn; its page still works at web3.toys/simulator.

## Hosting

The site runs on Vercel and web3.toys points at it. In the Vercel project
settings, the framework preset is **Other** with no build command.

## Accounts (Part 1)

- Logins use Supabase and stay switched off until `config.js` has
  `supabase.url` and `supabase.anonKey` (both public). The secret
  service_role key must never go in the website code.
- Setup steps for Supabase, Google, X and email: `docs/setup/part-1-accounts.md`.
  Database tables and rules: `supabase/001_accounts.sql` (paste into the
  Supabase SQL Editor).
- `js/auth.js` (the login box, header avatar, `window.Web3Auth`) is loaded
  by `js/site.js` only when accounts are switched on. The Supabase library
  is a pinned copy in `js/vendor/`.
- Legal pages: `privacy/`, `terms/`, `refunds/`, `contact/`. Their words
  are in `data/legal/*.json` (drafts, marked for review); the contact
  details come from `config.js` (`contact`).
- Profile pictures and names: every account gets a random cartoon picture
  and a fun name (like SleepyFrog42) from `js/avatar.js`. Only a short seed is
  stored (`profiles.avatar_seed`, added by `supabase/002_avatars.sql`).

## Brand

- Logo, icon, favicons and the share image are in `images/brand/`. The header
  logo and the hexagon 3 icon (footer, loading screen, certificates) are set
  in `js/site.js` (`logoImg`, `iconSrc`). Every page links the favicons and
  sets `og:image` and `twitter:image` to the 1200x630 share image.

## My Progress (compact profile)

`progress/` is drawn by `js/profile.js`: picture, name, rank and coins on
top, then stats (toys done, certificates, Pro tags, streak), a Continue
playing row and tabs for Certificates, Extras (coins and cosmetic extras),
Purchases (filled in by payments) and Settings (name, picture, log out,
delete account, sound). Old links to `progress/#coins` open the Extras tab.

## Payments (Part 4)

- Prices: `data/products.json` (USD and INR). The payment server reads this
  file from the live site, so the price there is the price charged.
- Server functions (Supabase Edge Functions, in `supabase/functions/`):
  `create-order`, `verify-payment` (checks Razorpay's signature),
  `razorpay-webhook` (backup confirmation) and `download` (5 minute links to
  files in the private `paid-files` bucket). Tests:
  `WEB3TOYS_TEST=1 deno test --allow-env --allow-read --allow-net supabase/functions/`.
- Crypto: `crypto-order` and `paymento-ipn` take crypto payments through
  Paymento (US dollar prices, paid straight to your wallet); a signed notice
  is always double-checked with Paymento's verify API. Switched on with
  `payments.crypto` in `config.js`.
- Website: `js/pay.js` (`Web3Pay.buy(productId, item)`), the Purchases tab
  on My Progress, and Buy buttons on the Books page. Switched on with
  `payments.enabled` in `config.js`. Razorpay keys live only in Supabase.
- Setup: `docs/setup/part-4-payments.md`.

## Admin dashboard (Part 8)

`admin/` (`js/admin.js`), for accounts in the `admins` table only. Tabs:
Users, Leads (email signups and where they came from), Purchases, Bookings
(Book a Call clicks and paid calls), Project requests (vetting checklist from
`data/admin.json`, approve or decline), Review queue (every `"review": true`
item, from `data/review-index.json`, built by `node tools/review-index.mjs`)
and Toy stats (plays, finishes, shares, buy clicks, purchases). Export CSV on
every tab. The site logs anonymous counts and signups through `js/log.js`
(database functions `log_event` and `add_lead`). Setup:
`docs/setup/part-8-admin.md`, database: `supabase/006_admin.sql`.
