# Early Bird 2x: setup

About 2 minutes. Supabase, **SQL Editor**, **New query**: paste all of
`supabase/012_early_bird.sql` and click **Run**. Safe to run again.

How it works:

- For each toy, the first 1,000 logged-in players who earn its certificate
  from its Early Bird start get a numbered spot ("Early Bird #87"), one per
  account per toy. The database hands out spots one at a time.
- Launch day toys start Tue 10 Nov 2026, 10:00 India time; later toys on
  their release day. Certificates earned before that do not take a spot
  (earning it again afterwards does).
- A spot doubles the coins earned on that toy: earlier coins are matched at
  once ("Early Bird 2x bonus"), later ones count double.
- Winners see a note, a stamp on their certificate and share card, and a
  badge on My Progress.

Changing a date or the number of spots: edit the list near the top of
`supabase/012_early_bird.sql` (and the date in `data/releases.json`), then
run the file again.
