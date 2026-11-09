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

## Prices

All in US dollars, in `data/business/`. The deposit is `price x deposit`
(50%). Payments read these files directly, so a price change is live as soon
as the site updates.
