# Notify me launch emails: setup

About 15 minutes, once. Until this is done, Notify me still collects sign-ups;
the emails start as soon as it is set up.

## Step 1. Resend (the email sender)

1. Sign up at **resend.com**.
2. **Domains**, **Add domain**: `web3.toys`. Resend shows a few DNS records:
   add them where you bought the domain, then click **Verify**.
3. **API Keys**, **Create API key** (Sending access). Copy it. Do not send it
   to anyone, including in chat.

## Step 2. Supabase secrets

Supabase, **Edge Functions**, **Secrets**, add:

- `RESEND_API_KEY`: the key from Resend.
- `LAUNCH_FROM`: `web3.toys <hello@web3.toys>` (any address on your domain).
- `CRON_SECRET`: a new long random password you make up.
- `RECEIPT_FROM`: the same as LAUNCH_FROM (payment receipts use it too).

## Step 3. The function

**Edge Functions**, **Deploy a new function**, name it `launch-emails`, paste
`supabase/functions/launch-emails/index.ts`, deploy, then switch OFF
**Verify JWT**.

## Step 4. The hourly timer

**SQL Editor**: open `supabase/013_launch_emails.sql`, replace `YOUR-PROJECT`
(zdufxggiffinqcstoquq) and `CRON-PASSWORD` (your CRON_SECRET), then Run.

## What gets sent

- The day before a toy unlocks: "Tomorrow at 10:00: [toy] unlocks", with the
  teaser image, the hook line and the Early Bird counter.
- On launch morning: "[toy] is live", with a Play button.
- Each person gets each email once, every email has an unsubscribe link, and
  sign-ups are deleted 90 days after the launch email.
- Toys that are not built yet (ready: false) get no emails.
