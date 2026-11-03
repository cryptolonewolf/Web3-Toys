# Part 4 setup: Razorpay payments

About 45 minutes, in four steps. Everything here is in **Razorpay test
mode**, so no real money moves. Going live is a separate, last step.

Your Supabase project address is `https://zdufxggiffinqcstoquq.supabase.co`.

---

## Step 1. Razorpay account and test keys

1. Go to **razorpay.com**, click **Sign Up**, and sign up with your email and
   phone. Choose your business type (an individual / sole proprietor is fine
   to start).
2. You land on the Dashboard. At the top, make sure the switch says
   **Test Mode** (not Live Mode).
3. Left menu: **Account & Settings** (gear icon), then **API Keys** (under
   Website and app settings). Click **Generate Test Key**.
4. You see a **Key Id** (starts with `rzp_test_`) and a **Key Secret**.
   **Download** them or copy both into your password manager now: the secret
   is shown only once.
   - The Key Id is fine to send me.
   - **Never send the Key Secret** to anyone, or put it in the website code. It
     only goes into Supabase (step 3).

## Step 2. Run the database file

Supabase, **SQL Editor**, **New query**, paste all of
`supabase/004_payments.sql`, **Run**. You should see **Success**.

Check: **Table Editor** shows a new `orders` table, and **Storage** shows a
bucket called `paid-files` marked **Private**.

## Step 3. The four payment functions

These run on Supabase's servers. Do this four times, once for each folder in
`supabase/functions/`: `create-order`, `verify-payment`, `razorpay-webhook`
and `download`.

1. Supabase, left menu **Edge Functions**, then **Deploy a new function**,
   then **Via Editor**.
2. Name it exactly like the folder (for example `create-order`).
3. Delete the sample code, paste the whole `index.ts` from that folder (on
   GitHub: open the file, then the copy button), and click **Deploy**.
4. Open the function's **Details** (or **Settings**) and switch **OFF**
   "Enforce JWT verification" / "Verify JWT". Each function checks the login
   itself, and Razorpay's webhook has no login. Save.

Then the secrets (the functions read these; they never reach the browser):

5. **Edge Functions**, **Secrets** (or **Manage secrets**). Add:
   - `RAZORPAY_KEY_ID` = your `rzp_test_...` Key Id
   - `RAZORPAY_KEY_SECRET` = your Razorpay Key Secret
   - `RAZORPAY_WEBHOOK_SECRET` = a new long random password you make now
     (save it, you need it in step 4)
   - `SERVICE_KEY` = your Supabase secret key (`sb_secret_...`, the same one
     you put in Vercel)
   - `SITE_URL` = `https://web3.toys`

## Step 4. Razorpay webhook

This tells your site about payments even if the buyer closes the page.

1. Razorpay Dashboard (Test Mode), **Account & Settings**, **Webhooks**,
   **Add New Webhook**.
2. **Webhook URL:**
   `https://zdufxggiffinqcstoquq.supabase.co/functions/v1/razorpay-webhook`
3. **Secret:** the same `RAZORPAY_WEBHOOK_SECRET` you made in step 3.
4. **Active events:** tick `payment.captured`, `payment.failed`, `order.paid`
   and `refund.processed`.
5. **Create Webhook**.

## Then tell me "payments set up"

I switch on the Buy buttons (`payments.enabled` in `config.js`) and you test
with Razorpay's test details:

- **UPI:** use `success@razorpay` as the UPI id (pays) or `failure@razorpay`
  (fails).
- **Card:** use a test card from Razorpay's "Test Card Details" page (search
  "Razorpay test cards"), any future expiry date and any CVV.

## Uploading the books

Supabase, **Storage**, `paid-files`, create a folder `books`, and upload
each PDF with exactly the name in `data/products.json`, for example
`books/your-first-30-days-in-crypto.pdf`. Never make this bucket public.

## Later: going live (not yet)

- Finish Razorpay's **activation**: KYC (PAN, bank account) and their website
  check. Your site already has the Contact, Terms, Privacy and Refunds pages
  they ask for.
- To take US dollars, ask Razorpay to enable **International Payments**
  (Account & Settings). Until then, only rupee payments work.
- Generate **Live** keys, add a **Live** webhook the same way, and replace the
  three `RAZORPAY_...` secrets in Supabase with the live ones.
- Optional: our own receipt email. Add `RESEND_API_KEY` and
  `RECEIPT_FROM` (for example `web3.toys <hi@web3.toys>`) to the Supabase
  secrets after setting up Resend (Part 1, step 7). Razorpay also sends its
  own receipt.

---

# Crypto payments with Paymento (next to Razorpay)

About 20 minutes. Paymento is non-custodial: buyers pay from their wallet
straight to yours. Prices are the US dollar prices in `data/products.json`.

## Step A. Paymento account and store

1. Go to **paymento.io**, sign up, and create a **store** for web3.toys.
2. Connect the wallet(s) you want to be paid in, following Paymento's
   steps. It asks for public details only (like an XPUB or an address).
   **Never give anyone your seed phrase or private key.**
3. Choose the coins and networks you accept (stablecoins like USDT and USDC
   are the easiest for buyers; pick the networks you can receive on).

## Step B. Keys

In your Paymento store settings, find:
- the **API key** (sent with every request), and
- the **secret key** for payment notifications (IPN). Paymento uses it to
  sign each notice.

Do not send either to me. They go into Supabase only.

## Step C. Database and functions

1. Supabase **SQL Editor**: run `supabase/005_crypto.sql` (after 004).
2. **Edge Functions**: deploy two more, the same way as before, and switch
   OFF "Verify JWT" on both: `crypto-order` and `paymento-ipn`.
3. **Edge Functions, Secrets**: add
   - `PAYMENTO_API_KEY` = the API key
   - `PAYMENTO_IPN_SECRET` = the secret key
   (`SERVICE_KEY` and `SITE_URL` are already there from the Razorpay steps.)

## Step D. Tell Paymento where to send payment notices

In the Paymento dashboard's store or payment settings, set the **IPN /
callback URL** to

`https://zdufxggiffinqcstoquq.supabase.co/functions/v1/paymento-ipn`

with method **POST**. If you cannot find this setting, tell me: Paymento also
has an API for it and I will walk you through it.

## Testing

Paymento has no pretend money mode, so test with one small real payment
(a stablecoin is easiest). Tell me when you are ready and I can add a
hidden $1 test product for it.
