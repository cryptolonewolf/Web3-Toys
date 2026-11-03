# Part 2 setup: saved progress, coins and the leaderboard

About 10 minutes. Two steps.

## Step 1. Run the database file

1. Supabase, **SQL Editor**, **New query**.
2. Copy all of `supabase/003_progress.sql` (on GitHub, the copy button at the
   top right of the file), paste, and click **Run**.
3. You should see **Success. No rows returned**. If Supabase warns about
   destructive operations, click **Run this query** (the file only replaces
   its own functions).

Check: **Table Editor** now also lists `certificates`, `coin_rules`,
`coin_ledger` and `cosmetic_items`.

(If you have not run `supabase/002_avatars.sql` yet, run it first.)

## Step 2. Two settings in Vercel (for saving certificates)

Certificates are checked on the website's server before they count for your
rank, so the server needs to be able to write to the database.

1. In Supabase: gear icon (**Project Settings**), **API Keys**. Under
   **Secret keys**, click **Reveal** (or **Create new secret key** if there is
   none), then **Copy**. It starts with `sb_secret_`.
   **Never paste this key into the website code, a chat or an email.** It only
   goes into Vercel.
2. In Vercel: open the web3.toys project, **Settings**, **Environment
   Variables**. Add two variables (tick **Production**, **Preview** and
   **Development**):
   - Name `SUPABASE_URL`, value `https://zdufxggiffinqcstoquq.supabase.co`
   - Name `SUPABASE_SECRET_KEY`, value the `sb_secret_...` key you copied
3. `CERT_SECRET` should already be there from the certificates setup. If it
   is missing, tell me.
4. **Deployments**, the three dots on the latest one, **Redeploy**, so the new
   settings are used.

If a secret key ever leaks: in Supabase, API Keys, delete it and create a new
one, then update it in Vercel and redeploy.
