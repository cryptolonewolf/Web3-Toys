# web3.toys

Free little games that show how web3 really works. By BuildWithAki.

This is a plain static website: HTML, CSS and JavaScript files. There is no
framework, no backend, no login and no database, and nothing to install.

## What is where

| Folder or file | What it is |
| --- | --- |
| `index.html` | The home page: header, intro and the grid of toy cards. |
| `simulator/` | The Launch a Token Simulator. A placeholder page for now. |
| `scam/` | Spot the Scam: a 10 round game and a message checker. |
| `styles/toys.css` | The one shared stylesheet. Every page uses it, so all toys look the same. Colors, fonts, outlines and buttons are set at the top. |
| `data/` | Content, kept apart from the code. See "Common changes" below. |
| `js/` | The scripts that run the pages and toys. |
| `tests/` | Automatic checks for the toys' logic. Not part of the live site. |
| `assets/` | Images. `mascot.svg` is a placeholder for the mascot. |
| `_parked/` | An earlier version of the simulator game, kept for later. It is not part of the live site. |

Each new toy gets its own folder next to `simulator/`.

## Preview it on your computer

1. Download the project from GitHub: on the repository page, click the green
   **Code** button, then **Download ZIP**, and unzip it.
2. Open the unzipped folder and double-click `index.html`.

It opens in your web browser. Click the cards and buttons as a visitor would.
After you change a file, save it and refresh the browser page to see the change.

The fonts load from Google Fonts, so you need an internet connection for the
page to look right.

## Common changes

- **Change or add a toy card:** edit `data/toys.js`. Each card has a title, a
  description, tags and a status. `live` makes it clickable, `soon` shows it
  as Coming soon.
- **Add the mascot artwork:** replace `assets/mascot.svg` with your drawing,
  using the same file name. If your file is a PNG, name it `mascot.png` and ask
  for the pages to point at it.
- **Change a color or font:** edit the top of `styles/toys.css`.
- **Signup, report and call links:** edit `data/site.js`. Paste your email
  tool's form address, your report link and your booking link. Until then the
  buttons say "coming soon".

### Spot the Scam

- **Game scenarios:** `data/scam-scenarios.js`. Each has the message text,
  the answer (scam or legit), its red flags and a short explanation. Only use
  made-up brand names.
- **Checker rules:** `data/scam-rules.js`. Each rule has a name, the words to
  look for, a weight from 1 to 3, why it is a red flag and what to do instead.
  To catch a new wording, add it to that rule's `keywords` list.
- **Known scam web addresses and wallet addresses:** `data/scam-known.js`.
  Put each one on its own line, with an optional note after a `#`, like
  `fake-claim-site.xyz  # fake airdrop page`. If a pasted message contains one,
  the checker shows "Contains a known scam address" at the top. Only add
  entries you are sure about, and note where each came from.
- **Ranks, points and screen wording:** `data/scam-game.js`.

The checker runs only in the visitor's browser. It never sends, saves or opens
anything from the pasted text. If the text looks like a seed phrase or a
private key, it does not run the check and tells the person to delete it.

## Run the automatic checks

If you or a developer change the toys' logic, these checks confirm nothing
broke. They need Node.js, which comes with most developer setups:

```
node --test tests/*.test.mjs
```

## Put it online with Vercel

Vercel hosts static sites like this one for free.

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account.
2. Click **Add New**, then **Project**.
3. Find **web3-toys** in the list and click **Import**. If it is not listed,
   click the link to adjust GitHub app permissions and give Vercel access to it.
4. On the setup screen:
   - Framework Preset: **Other**
   - Root Directory: leave as it is
   - Build Command and Output Directory: leave empty
5. Click **Deploy**. After a minute you get a link ending in `.vercel.app`.
   Open it and check the site.

From then on, every time a change is saved to GitHub, Vercel updates the site
by itself within a minute or two.

Vercel publishes the branch GitHub treats as the main one. Right now that is
`claude/new-session-pu0lz5`. To use a different branch later, change it in
the Vercel project under **Settings**, then **Git**.

## Point web3.toys at it

1. In your Vercel project, open **Settings**, then **Domains**.
2. Type `web3.toys` and click **Add**. When it asks, also add `www.web3.toys`
   and let it redirect to `web3.toys`.
3. Vercel then shows the records to add at the company where you bought the
   domain. It usually looks like this:
   - An **A** record for `@` pointing to the IP address Vercel shows.
   - A **CNAME** record for `www` pointing to the address Vercel shows.
4. Log in to your domain company, open the DNS settings for web3.toys, and add
   exactly the records Vercel shows. Delete any old A or CNAME records for
   `@` and `www` that point elsewhere.
5. Back in Vercel, wait until the domains show **Valid Configuration**. This
   can take from a few minutes to a few hours. Vercel sets up the secure
   https padlock by itself.

## Rules for every toy

- Games use simplified numbers. Every page says so, and that it is not
  financial advice.
- Only invented names. Never a real exchange, market maker, fund or project.
- Mobile first: large tap targets and no sideways scrolling on a phone.
