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

## Prices

All in US dollars, in `data/business/`. The deposit is `price x deposit`
(50%). Payments read these files directly, so a price change is live as soon
as the site updates.
