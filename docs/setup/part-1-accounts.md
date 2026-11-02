# Part 1 setup: accounts and login

Do these once, in order. About 45 minutes. Nothing here costs money.
Logins stay switched off on the live site until step 4 is done, so nothing
breaks while you work through it.

You need: your web3.toys website address (written below as
`https://web3.toys`), a Google account, and your X account.

---

## Step 1. Create the Supabase project

1. Go to **supabase.com**, click **Start your project**, and sign up (signing
   up with GitHub is easiest).
2. Click **New project**.
   - **Name:** `web3toys`
   - **Database password:** click **Generate a password**, then save it in
     your password manager. You will rarely need it, but you cannot see it
     again.
   - **Region:** pick the one closest to most of your visitors (for India,
     **Mumbai**; for a mix, **Frankfurt** or **Singapore**).
   - Plan: **Free** is fine for now.
3. Click **Create new project** and wait about 2 minutes.

## Step 2. Create the database tables

1. In the left menu, click **SQL Editor**, then **New query**.
2. Open the file `supabase/001_accounts.sql` from the web3.toys code (on
   GitHub: open the repository, then the `supabase` folder, then the file,
   then the **copy** button at the top right of the file).
3. Paste everything into the Supabase query box and click **Run**.
4. You should see **Success. No rows returned**. If you see an error, copy it
   and send it to me.

## Step 3. Tell Supabase your website address

1. Left menu: **Authentication**, then **URL Configuration**.
2. **Site URL:** `https://web3.toys`
3. **Redirect URLs**, click **Add URL** for each of these:
   - `https://web3.toys/**`
   - `https://*-YOUR-VERCEL-TEAM.vercel.app/**` (only if you want logins to
     work on Vercel preview links; skip it if unsure)
4. Click **Save**.

## Step 4. Put the public keys in config.js

1. Left menu: **Project Settings** (the gear), then **API** (it may be called
   **Data API** and **API Keys**).
2. Copy the **Project URL** (it looks like `https://abcdxyz.supabase.co`).
3. Copy the **anon public** key (a long text starting with `eyJ`, or a key
   starting with `sb_publishable_`). This one is safe to put on the website.
   **Never copy the `service_role` or `secret` key anywhere on the website.**
4. In `config.js`, fill in:

   ```js
   supabase: {
     url: 'https://abcdxyz.supabase.co',
     anonKey: 'eyJ...your anon public key...',
   },
   ```

   (Or send me the URL and the **anon public** key and I will add them.)

Once this is live, **Log in** appears in the menu. Email login already works
at this point. Google and X need the next two steps.

## Step 5. Google login

1. Go to **console.cloud.google.com** and sign in.
2. At the top, click the project picker, then **New project**, name it
   `web3toys`, and click **Create**. Make sure it is selected.
3. Left menu (☰): **APIs & Services**, then **OAuth consent screen**
   (it may be called **Google Auth Platform**). Click **Get started**.
   - App name: `web3.toys`. Support email: your email.
   - Audience: **External**.
   - Contact email: your email. Agree and **Create**.
   - Under **Branding**, add your home page `https://web3.toys`, privacy
     policy `https://web3.toys/privacy/` and terms `https://web3.toys/terms/`.
     Under **Authorized domains** add `web3.toys` and `supabase.co`.
   - Under **Audience**, click **Publish app** so anyone can log in (not only
     test users).
4. Now **Clients** (or **Credentials**, then **Create credentials**,
   **OAuth client ID**):
   - Application type: **Web application**. Name: `web3toys`.
   - **Authorized JavaScript origins:** `https://web3.toys`
   - **Authorized redirect URIs:** paste the **Callback URL** from Supabase.
     To find it: in Supabase go to **Authentication**, **Sign In / Providers**
     (or **Providers**), click **Google**; the callback URL is shown there
     and looks like `https://abcdxyz.supabase.co/auth/v1/callback`.
   - Click **Create**. Copy the **Client ID** and **Client secret**.
5. Back in Supabase, on the **Google** provider: switch it **on**, paste the
   **Client ID** and **Client secret**, and click **Save**.

## Step 6. X login

1. Go to **developer.x.com** and sign in with your X account. Click
   **Developer Portal** and sign up for the **Free** plan (describe your use
   as: "Let visitors log in to web3.toys with their X account. We only read
   their name and profile picture and never post.").
2. In the portal, open **Projects & Apps**. A default project and app are
   created for you; open the app (or click **Add App**).
3. Under **User authentication settings**, click **Set up**:
   - App permissions: **Read**.
   - Type of App: **Web App, Automated App or Bot**.
   - **Callback URI / Redirect URL:** the same Supabase callback URL as in
     step 5 (`https://abcdxyz.supabase.co/auth/v1/callback`).
   - **Website URL:** `https://web3.toys`
   - Terms of service: `https://web3.toys/terms/`. Privacy policy:
     `https://web3.toys/privacy/`.
   - If there is a **Request email from users** option, switch it on.
   - Click **Save**.
4. Open **Keys and tokens**. Under **OAuth 2.0 Client ID and Client
   Secret**, click **Generate** (or **Regenerate**) and copy both.
5. In Supabase: **Authentication**, **Sign In / Providers**, click
   **X / Twitter (OAuth 2.0)**, switch it **on**, paste the **Client ID** and
   **Client Secret**, and **Save**.
   - If your Supabase only shows **Twitter** (without "OAuth 2.0"), use that
     one instead, with the **API Key and Secret** from the **Consumer Keys**
     section, and tell me: I will change one setting in `config.js`
     (`xProvider: 'twitter'`).

## Step 7. Reliable login emails (recommended before launch)

Supabase's built-in email can only send a few emails an hour, which is fine
for testing but not for real visitors.

1. Sign up at **resend.com** (free for 3,000 emails a month).
2. **Domains**, **Add domain**: `web3.toys`. Resend shows a few DNS records.
   Add them where you manage your domain's DNS (your domain registrar, or
   Vercel **Domains** if Vercel manages it). Click **Verify** in Resend once
   added (it can take up to an hour).
3. **API Keys**, **Create API key** (Sending access). Copy it.
4. In Supabase: **Project Settings** (or **Authentication**), **SMTP
   Settings**, switch on **Enable custom SMTP**:
   - Sender email: `hello@web3.toys`. Sender name: `web3.toys`.
   - Host: `smtp.resend.com`. Port: `465`.
   - Username: `resend`. Password: the Resend API key.
   - **Save**.

## Step 8. Make yourself the admin

1. On the live site, log in with the account you want to be admin.
2. In Supabase: **Authentication**, **Users**. Find yourself and copy your
   **User UID**.
3. **SQL Editor**, **New query**, paste this with your UID, and **Run**:

   ```sql
   insert into public.admins (user_id) values ('PASTE-YOUR-USER-UID-HERE');
   ```

This is what will unlock the admin dashboard in Part 8.

## Step 9. Fill in your contact details

Razorpay checks your website before it approves payments. In `config.js`,
fill in `contact` (email, business name, address), and replace the
`TODO` line about the governing law in `data/legal/terms.json` (or send me
the details and I will add them).
