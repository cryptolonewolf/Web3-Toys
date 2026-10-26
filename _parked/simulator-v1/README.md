# web3.toys

Small games about how web3 actually works. By BuildWithAki.

## Launch a Token Simulator

A 5 minute, mobile first game: pick a project, set the raise and token split,
choose a launch route, a market maker deal and a community plan, then live
through 7 days of launch week. It ends with a score, a rank, your most
expensive decisions and a share card.

This is a game with simplified numbers. It is not financial advice and does
not describe any real company or token.

### Run it

It is a static page with no backend and no build step. ES modules need to be
served over http, so open it through any static server:

```sh
npm start            # python3 -m http.server 8080
# then open http://localhost:8080
```

To host it, upload the repo root (`index.html`, `src/`, `styles/`) to any
static host and point web3.toys at it.

### Test it

```sh
npm test
```

Needs Node 20 or later. The tests cover the daily rules, the scoring formula
and ranks, the event triggers, fixed weakest and strongest scenarios, a check
over 500 random games that no stat ever leaves its range, and a check of the
content file.

### Where things live

| File | What it holds |
| --- | --- |
| `src/data.js` | All content: project types, raises, buckets, routes, market maker deals, community plans, the 16 events, daily rule numbers, score weights, ranks, disclaimer. |
| `src/engine.js` | Game state and rules. No DOM, so it runs in Node. `applyDailyRules` holds the daily math, `computeScore` the score. |
| `src/app.js` | Screens and input. |
| `src/sharecard.js` | Draws the square share card on a canvas. |
| `src/config.js` | Email signup form action and book link. |
| `styles/toys.css` | The shared web3.toys look, meant to be reused by every toy. |

### Adding an event

Add an object to `EVENTS` in `src/data.js`. Give it an `id`, a `title`, a
`trigger` (choice and stat conditions, documented at the top of the file),
optional `days`, two responses `a` and `b` with `label`, `effects` and a
`short` phrase (used in "My biggest mistake was ..."), and a `lesson`. Run
`npm test` to check it.

### Before launch

- **Email signup.** Set `CONFIG.signup.action` (and the field name) in
  `src/config.js` to the embed form of the email tool you pick. Until then the
  form says signups open soon. Nothing is stored by this site.
- **Book link.** Set `CONFIG.book.url`. Until then it says "Book coming soon".
