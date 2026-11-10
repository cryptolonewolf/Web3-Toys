# Profile pages (web3.toys/@handle): setup

Pages for projects, creators and web3 personalities. Wording, reserved
names, flagged words and Pro settings: `data/business/pages.json`.
Like the other For Projects pages, they show only while `business.live` is
on in `config.js` (preview with `?preview-business=1`).

## Part A: pages, links and claiming (5 minutes)

1. Supabase, **SQL Editor**: run `supabase/017_ops.sql` again (safe; it
   learned about pages), then run `supabase/019_pages.sql`. It also makes
   the public `page-images` storage bucket (PNG, JPG or WebP up to 2 MB).
2. Log in with X must be switched on in Supabase (Authentication,
   Providers, X). It already is if "Continue with X" works on the site.
3. Nothing to paste in Vercel: `vercel.json` sends web3.toys/@name to the page.

How it works:
- **Projects without a page:** admin, **Pages**, **New project page**. Only
  for projects you have vetted; it goes live as "Not claimed yet".
- **Claiming:** the team opens web3.toys/@theirhandle, taps **Claim this
  page** and logs in with the project's X account. The database checks the
  X account Supabase saved at login (it cannot be typed or edited). A
  different X account gets a polite message and a **Request a page** button.
- **Creators and personalities** make their own page at `/my-page/` with
  Log in with X. web3.toys never makes a page about a person.
- **Every new page waits for you** in admin, **Pages, To approve** (also on
  the Operations home). Later edits go live at once, except edits with a
  flagged word (presale, airdrop, $TICKER...): the page hides until you
  approve it again.
- **Report this page** (on every page) goes to **Pages, Reports**. In
  **All pages** you can suspend, transfer (to someone who has logged in with
  X once), remove the owner, or delete. Everything is in the Audit log.

Test it (preview on, use two X accounts if you can):
1. Admin, Pages, New project page: make a page for a test handle, open it:
   "Not claimed yet" and **Claim this page**.
2. Claim it with a different X account: you get the polite message.
3. Claim it with the matching X account: you land in the editor. Add a bio,
   avatar, banner, colour and toys; save; view the page: **Verified via X**.
4. Put "presale" in the bio and save: the page hides; approve it in admin.
5. Report the page from a logged-out browser; handle it in Pages, Reports.
6. On another X account, open `/my-page/`, make a Creator page, send it for
   review, approve it in admin.

## Part B: what each page shows (2 minutes)

Supabase, **SQL Editor**: run `supabase/020_page_content.sql` (safe to run again).

- **Project pages:** a big **Play** button, the project's toys and courses,
  "Pro players" (how many earned the Academy course badge, with names only
  of those who chose to share with that project), and a leaderboard of its
  toys and courses (others show as "A player").
- **Creator pages:** "Join web3.toys with my link" (their invite link), how
  many joined with it (names only of those who chose to share), and their
  rank and certificates.
- **Personality pages:** bio, links, rank and certificates, recommended toys.
- **Owners** see their own stats on their page: views, plays that started
  from the page, and players (last 30 days and all time). Nobody else does.
- Plays are credited to a page because its Play links add `?via=handle`.
  The count has no names.

Names appear once players say yes in part C (the consent question); until
then the lists show counts only.

Test it: open a project page with a featured course and toys; tap Play (the
toy address ends in `?via=handle`) and play a card; as the owner, refresh
the page: Plays from your page goes up. On a creator page, the Join button
carries their invite code.
