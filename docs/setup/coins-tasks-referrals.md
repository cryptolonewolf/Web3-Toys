# Setup: coin tasks, unlocking with coins, and referrals

About 2 minutes.

1. Supabase, **SQL Editor**, **New query**: paste and run
   `supabase/008_quests_referrals.sql` (after 001 to 007). You should see
   **Success**.
2. When you create your social accounts, put the full links in `config.js`
   under `social` (or send them to me):
   - `x`: for example `https://x.com/web3toys`
   - `telegram`: for example `https://t.me/web3toys`
   The "Follow on X" and "Join our Telegram" tasks appear once a link is set.

Where things live:
- Tasks and their words: `data/quests.json` (coins must match the `quests`
  list in the database file; a test checks).
- Coin prices for paid items: `coins` in `data/products.json` (must match
  `coin_products` in the database file; a test checks). Calls and project
  payments have no coin price.
- Admin: **Referrals & posts** tab shows invites and the X post links people
  used for the post task, for spot checks.
