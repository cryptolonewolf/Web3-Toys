# For Projects: setup

Do these whenever you like before December. Until `business.live` is true in
`config.js`, visitors do not see any of it; preview with
`?preview-business=1` on any page.

## Part 2: Launch Your Own Toy (about 10 minutes)

1. Supabase, **SQL Editor**: run `supabase/014_business.sql` (safe to run again).
2. Supabase, **Edge Functions**: update two functions by pasting their new code
   (the deposits are read from your price files in `data/business/`):
   - `create-order` (from `supabase/functions/create-order/index.ts`)
   - `crypto-order` (from `supabase/functions/crypto-order/index.ts`)
3. **Edge Functions**, deploy a new function `admin-refund` (paste
   `supabase/functions/admin-refund/index.ts`), then switch OFF **Verify JWT**.
   It uses the Razorpay secrets you already have. This is the **Refund deposit
   in full** button in admin.

Test in Razorpay test mode: open `/launch-your-toy/?preview-business=1`,
send a request, pay the deposit with a test card, see it as "Deposit paid" in
admin, **Toy requests**, then press Refund and check Razorpay shows the refund.

## Part 3: Sponsor a Toy (about 5 minutes)

1. Supabase, **SQL Editor**: run `supabase/015_sponsors.sql` (safe to run
   again). It also creates the public `sponsor-logos` storage bucket (PNG or
   SVG, 300 KB maximum; each sponsor can only upload into their own folder).
2. Paste `create-order` and `crypto-order` again (they now also know the ad
   prices from `ad_slots.json`).

Before going live: fill in the audience numbers in
`data/business/advertise_page.json` from admin, Toy stats.

Test in Razorpay test mode: open `/advertise/?preview-business=1`, tap a free
slot in the calendar, fill in the form with a logo, pay, then in admin,
**Sponsor bookings**, approve it. In the month you booked, the card shows on
that toy's start and result screens; its private stats link counts views and
clicks. Reject and refund sends the money back in full.

## Part 4: Test Your Product (about 5 minutes)

1. Supabase, **SQL Editor**: run `supabase/016_tests.sql` (safe to run
   again). It also creates the private `test-shots` storage bucket for tester
   screenshots (PNG or JPG, 2 MB maximum).
2. Nothing else to paste: the test deposits already work since Part 2.

How it runs:
- A project sends a request on `/test-your-product/` and pays the deposit.
  Vet it in admin, **Test requests**, and approve it.
- In admin, **Tests & payouts**, open **New test**, pick the request (it fills
  in the link, tasks, number of testers and the stablecoin amount per tester:
  25% of the price split between the testers), add a title and press
  **Save and open**.
- Players with 2 or more certificates join on `/testers/` with a USDC or USDT
  wallet, tick the four safety rules and test task by task.
- Approve or reject each test in **Tests & payouts**. Approving adds the coins
  and puts the amount under **Payouts owed**. Send it from your own wallet,
  paste the transaction link and press **Mark paid**. The site never holds
  money or keys.
- **Report** shows the results; **Export branded PDF** opens the print box:
  choose Save as PDF and send it to the project.

Test it: open `/test-your-product/?preview-business=1`, send a request,
approve it in admin, create and open a test, then (on an account with 2
certificates) join on `/testers/`, run the test and send it, approve it, mark
it paid with any https link and export the PDF.

## Part 5: Sponsored rounds (no setup)

A sponsor books "with a sponsored round" on `/advertise/`. After you approve
the booking, add their round to `data/business/sponsored_rounds.json` and set
`approved` to `true` (and `until` to the last day of their month):
- `kind: "lesson"`: a card in the middle of a learning toy (title and up to
  4 points), labelled "Sponsored round by [name]", with a "Learn more" link.
  It is never part of the quiz.
- `kind: "scam"`: one Spot the Scam message (same fields as the examples),
  labelled the same way; it replaces one round with the same answer.
Rounds only show while For Projects is switched on. Keep them educational:
no token promotions, price claims or calls to buy.

Test it: set `approved` to `true` on the two examples, open
`/getting-started/?preview-business=1` (card 6) and play Spot the Scam.
Set them back to `false` afterwards.

## Prices

All in US dollars, in `data/business/`. The deposit is `price x deposit`
(50%). Payments read these files directly, so a price change is live as soon
as the site updates.

## Test Your Product: the new sales flow (10 minutes)

1. Supabase, **SQL Editor**: run `supabase/017_ops.sql` again (safe), then
   `supabase/022_test_funnel.sql`.
2. **Edge Functions**: paste `create-order` and `crypto-order` again (round
   deposits $250 / $750 / $1,500 and the founding offer deposits). Until you
   do, checkout still charges the old $249.50 / $749.50 / $1,499.50.
3. Deploy the new `lead-emails` function (Verify JWT off). Run
   `supabase/018_ops_schedule.sql` again with your project and password: it
   now also sends the day 1 and day 3 follow-ups (11:00 India time). They go
   out only once `RESEND_API_KEY` is set.

Settings you control (no code):
- `data/business/test_tiers.json`: prices, `depositUsd`, `popularLabel`,
  `guarantee`, and `foundingOffer` (set `left` to the slots still open; at 0
  the banner hides and the discounted deposits stop being sold).
- `data/business/test_page.json`: all words, the FAQ, the comparison table,
  the video (`video.src`), and `caseStudies` (hidden while empty; real ones
  only).
- `config.js` `social.x` and `social.telegram`: the Talk to Aki buttons
  (until they are set, the button opens your call booking link).

What changed for things already running:
- Step 1 of the form (name, email, test) is saved as a lead at once; the
  request itself (step 2) still needs a login, so the deposit can be paid.
- Tasks and network are no longer on the form: agree them on the setup call
  and type them when you make the test in admin (Tests & payouts, New test).
- Testers now also tick a confidentiality rule before each test.
- Admin, **Test requests** shows the funnel at the top: page views, tier
  clicks, form started, step 1 done, request sent, deposit paid, plus the
  leads list.

## All For Projects pages now share one kit

Launch Your Own Toy, Test Your Product, List your Quest
(academy/list-your-project/) and Advertise are built with `js/biz-kit.js`:
each section is one bordered card, pairs of sections sit side by side on wide
screens, copy is short, and each page has a guarantee line, a Who runs this
block (Talk to Aki uses social.x / social.telegram from config.js), a video
placeholder (`video.src` in the page's JSON), FAQ, case studies (hidden until
you add real ones), a sticky button on phones, and funnel counts.

- Launch, Test and Quest pages use the two step form: step 1 is saved as a
  lead, step 2 sends the request, then a thank-you view with Book the call,
  pay, and Copy link. Quests now have their own request form again (with For
  Projects on, the old Work with us page sent everyone to Launch Your Own Toy,
  so Quests could not be requested).
- Advertise keeps its booking form (calendar, logo, line); a lead is saved
  once the project name and email are filled in.
- The funnel shows at the top of admin: Toy requests, Test requests, Project
  requests (Quests) and Sponsor bookings.
- Follow-up emails (day 1 and day 3) go to leads from every page who did not
  pay. Run `supabase/022_test_funnel.sql` again (safe) and paste
  `lead-emails` again after this update.
