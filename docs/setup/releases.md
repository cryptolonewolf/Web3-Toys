# Scheduled releases: setup

About 3 minutes.

## Step 1. Database

Supabase, **SQL Editor**, **New query**, one at a time (all safe to run again):

1. `supabase/010_releases.sql` (if not run before)
2. `supabase/017_ops.sql` (again, for the admin to-do tick)
3. `supabase/023_release_schedule.sql`: the **Switch on** button and the
   Early Bird start dates (spots players already earned are kept)

Then **Edge Functions**, `launch-emails`: paste the new
`supabase/functions/launch-emails/index.ts` and deploy (Verify JWT off).

Nothing else to add in Vercel for the lock: the server lock
(`middleware.js`) uses `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, which are
already there.

## Your preview (optional)

Vercel, **Settings**, **Environment Variables**: add `PREVIEW_KEY` with a
long password you make up (at least 12 characters; never send it to
anyone), then redeploy. Open any page once with `?preview=YOUR_KEY` at the
end of the address. After that, in admin, **Releases**, pick a date under
**Preview a date**: the whole site in your browser shows that day, locked
pages included. **Exit preview** goes back to today. Only a logged-in
admin sees the preview; without the key, locked pages stay locked even for
you.

## Changing the schedule

Edit `schedule` in `data/releases.json`: each date unlocks its items at
10:00 India time (server time, never the visitor's clock). Items not in
the schedule show Coming soon with no date (Hall of Fame and the Token
Simulator have `openNow` and are always open). Items marked `onlyIfReady`
wait for **Switch on** in admin, even after their date.

A new item also needs an entry in `toys` and its folder in the matcher at
the top of `middleware.js` (the automatic checks remind you).

To release early or delay without editing the file: **web3.toys/admin/**,
**Releases** tab. **Back to schedule** removes your change (a Switch on
stays).
