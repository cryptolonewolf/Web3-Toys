# Operations home: setup

The first tab in `/admin/`. It shows every queue with how long the oldest
item has waited (green under 24 hours, amber under 72, red after), this
week's releases, Early Bird spots and sponsor slots, the last 7 days against
the 7 before, site health, and your to-do list. Settings and the to-do list:
`data/ops.json`. Tick **Show sample data** to preview it with made-up
numbers.

## 1. Database (2 minutes)

Supabase, **SQL Editor**: run `supabase/017_ops.sql` (safe to run again).
It adds the audit log, the contact form, refund requests, Mark reviewed,
site health and the to-do ticks.

## 2. Functions (10 minutes)

In Supabase, **Edge Functions**, for each one: create it (or open it),
paste the file, switch OFF **Verify JWT**, Deploy.

- `ops-digest`: `supabase/functions/ops-digest/index.ts` (the daily email)
- `ops-check`: `supabase/functions/ops-check/index.ts` (the weekly link and speed check)
- `razorpay-webhook`: paste it again (it now records disputes and failures).
  In Razorpay, **Settings, Webhooks**, edit your webhook and also tick
  `payment.dispute.created`.
- `admin-refund`, `create-order`, `crypto-order`, `launch-emails`: paste again
  when your to-do list says "not deployed, or an older copy".

Secrets (**Edge Functions, Secrets**), if not there yet:
- `CRON_SECRET`: a long password you make up (the same one as for the launch emails)
- `RESEND_API_KEY`: from Resend (docs/setup/launch-emails.md)
- `OPS_EMAIL`: where the daily email goes (hi@web3.toys if you leave it out)
- `OPS_FROM`: the sender, for example `web3.toys <hello@web3.toys>` (uses
  LAUNCH_FROM if you leave it out)

## 3. Schedule (2 minutes)

Open `supabase/018_ops_schedule.sql`, replace `YOUR-PROJECT` and
`CRON-PASSWORD` (in both jobs), and run it in the SQL Editor. The email goes
out every day at 9:00 India time when something is waiting; the site check
runs every Monday at 6:30 India time.

## How to test

1. Open `/admin/`: it starts on **Operations**. Tick **Show sample data** to
   see every box filled; untick it.
2. Log out, open `/contact/`, send a message. In admin it appears under
   **Contact form messages**; open it, press **Mark done**.
3. Buy a report in Razorpay test mode, then in **My Progress, Purchases**
   press **Request a refund**. In admin, **Refund requests**: **Refund in
   full** (or **Decline** with a note).
4. Open **Audit log**: every action above is there, with your name and time.
5. Send yourself the email now: in Supabase, **Edge Functions, ops-digest,
   Test**, method POST, header `x-cron-key` = your CRON_SECRET, body
   `{"force": true}`.
6. Run the site check once the same way with `ops-check` (body `{}`); its
   result appears under **Site health** in a minute or two.

## Notes

- Plays are counted from now on (the first tap in a toy); earlier weeks show 0.
- Page errors and load times are anonymous counts (privacy page, "If you just play").
- The link check reads `data/link-check.json`. After adding pages or links,
  run `node tools/link-list.mjs` (a test reminds you). Example scam links in
  the toys are never visited.
