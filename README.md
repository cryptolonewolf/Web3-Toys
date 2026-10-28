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
- Simulator content: `data/simulator.js`. It is on the home page as Coming
  soon in Play and Learn; its page still works at web3.toys/simulator.

## Hosting

The site runs on Vercel and web3.toys points at it. In the Vercel project
settings, the framework preset is **Other** with no build command.
