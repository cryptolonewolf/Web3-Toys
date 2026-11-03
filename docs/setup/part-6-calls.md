# Part 6 setup: Book a Call with Cal.com

About 20 minutes. You choose how people pay for calls, in `config.js`
under `call`:

- **mode `calcom`** (simplest): every Book a Call button opens your Cal.com
  page, and Cal.com takes the payment through its **PayPal** app.
- **mode `razorpay`**: people pay on web3.toys first (UPI or card in India,
  card elsewhere, or crypto if switched on), then get a **Pick your time**
  button that opens your Cal.com page with their email filled in. Use this
  if PayPal does not suit you (for example, rupee payments).

The price shown on the site comes from `call-30` in `data/products.json`
(now $49 / ₹3,999; tell me your price). In `calcom` mode, set the same price
in Cal.com.

## Step 1. Cal.com account and event

1. Sign up at **cal.com** (free plan is fine) and connect your calendar.
2. **Event Types**, **New**: title "30 minute call with Aki", duration 30
   minutes. Save.
3. Open the event and copy its link (for example
   `https://cal.com/yourname/30min`). Send it to me, or put it in
   `config.js` as `calUrl`.

## Step 2 (calcom mode only). Take payment with PayPal

1. Cal.com, **Apps**, search **PayPal**, **Install**, and follow the steps
   to connect your PayPal business account (Cal.com asks for a PayPal
   Client ID and Secret Key from developer.paypal.com, **Apps & Credentials**,
   **Create App**; use **Live** credentials for real payments).
2. Open your event type, the **Apps** tab, switch on **PayPal**, set the
   **price** (for example 49 USD), and save.

## Step 3. Show bookings in your admin dashboard

1. Supabase, **SQL Editor**: run `supabase/007_bookings.sql`.
2. **Edge Functions**: deploy one more function, `cal-webhook` (paste
   `supabase/functions/cal-webhook/index.ts`), and switch OFF "Verify JWT".
3. **Edge Functions, Secrets**: add `CAL_WEBHOOK_SECRET` = a new long random
   password.
4. Cal.com, **Settings**, **Developer**, **Webhooks**, **New**:
   - Subscriber URL:
     `https://zdufxggiffinqcstoquq.supabase.co/functions/v1/cal-webhook`
   - Secret: the same `CAL_WEBHOOK_SECRET` password
   - Events: Booking Created, Booking Paid, Booking Rescheduled, Booking
     Cancelled (and Booking Rejected if listed)
   - Save. Cal.com has a **Ping test** button: it should succeed.

Bookings then appear in **web3.toys/admin/**, Bookings tab.
