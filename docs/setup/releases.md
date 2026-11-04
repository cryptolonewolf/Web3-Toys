# Scheduled releases: setup

About 2 minutes.

## Step 1. Database

Supabase, **SQL Editor**, **New query**: paste all of
`supabase/010_releases.sql` and click **Run**. Safe to run again.

It adds:

- the server clock, so a wrong clock on a visitor's phone cannot unlock a toy;
- your **Release now** and **Delay** buttons (admin, Releases tab);
- the **Notify me** list.

Nothing to add in Vercel: the server lock (`middleware.js`) uses
`SUPABASE_URL` and `SUPABASE_SECRET_KEY`, which are already there.

## Changing the schedule

Edit `data/releases.json`: each toy has a `date` (10:00 India time). Set
`ready` to `true` only once the toy is built and its card in
`data/home.json` has a `path`; until then it shows Coming soon, even after
its date.

To release early or delay without editing the file: **web3.toys/admin/**,
**Releases** tab. **Back to schedule** removes your change.
