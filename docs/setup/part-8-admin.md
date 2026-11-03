# Part 8 setup: admin dashboard

About 3 minutes.

1. Supabase, **SQL Editor**, **New query**: paste and run
   `supabase/006_admin.sql` (after 001 to 005). You should see **Success**.
2. Make sure your account is an admin (Part 1, step 8: your user id in the
   `admins` table). Add every account you use to log in.
3. Open **web3.toys/admin/** and log in. You see seven tabs: Users, Leads,
   Purchases, Bookings, Project requests, Review queue and Toy stats, each
   with Export CSV.

Notes:
- Counts start from the moment this goes live; there is no history before it.
- Email signups from every toy and page are now saved as Leads (they were
  not saved anywhere before).
- After editing any data file marked "review": true, run
  `node tools/review-index.mjs` (or ask me) so the Review queue is up to date.
