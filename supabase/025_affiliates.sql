-- web3.toys: Invite and earn. People with a published web3.toys page earn a
-- share of what the people they bring in buy, paid in USDC or USDT.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 004, 005, 006, 008, 014, 015, 016 and 019 first.
--
--   - Links: web3.toys/?ref=HANDLE (the page's X handle) or the invite code.
--     Visiting someone's web3.toys page counts as their link too.
--   - Who counts: a player who signed up with the link (for 12 months), or
--     anyone who arrived through it and buys within 90 days. One inviter per
--     buyer: the first link wins. Never yourself.
--   - What counts: every paid purchase in rupees or dollars (not coins).
--     Rate by paying buyers brought in so far: 15%, 20% after 5, 25% after
--     15, 30% after 30 (affiliate_tiers; keep in step with
--     data/business/affiliate.json, a test compares them).
--   - Earnings wait 30 days. Project deposits, Quests and ad slots also wait
--     until the project is delivered. A refund cancels the earning.
--   - Payouts: from $20, to a USDC or USDT wallet. The affiliate asks, you
--     send it and mark it paid in admin (Affiliates).

-- ---------- Settings ----------
create table if not exists public.affiliate_settings (
  id int primary key default 1 check (id = 1),
  inr_per_usd numeric(10, 2) not null default 85 check (inr_per_usd > 0),
  hold_days int not null default 30 check (hold_days between 0 and 365),
  min_payout_usd numeric(10, 2) not null default 20 check (min_payout_usd >= 0),
  touch_days int not null default 90 check (touch_days between 1 and 365),
  invite_months int not null default 12 check (invite_months between 1 and 60)
);
insert into public.affiliate_settings (id) values (1) on conflict (id) do nothing;
alter table public.affiliate_settings enable row level security;
drop policy if exists "affiliate settings public" on public.affiliate_settings;
create policy "affiliate settings public" on public.affiliate_settings for select using (true);

create table if not exists public.affiliate_tiers (
  min_buyers int primary key check (min_buyers >= 0),
  rate numeric(4, 3) not null check (rate > 0 and rate <= 0.3)
);
insert into public.affiliate_tiers (min_buyers, rate) values (0, 0.15), (5, 0.20), (15, 0.25), (30, 0.30)
on conflict (min_buyers) do update set rate = excluded.rate;
alter table public.affiliate_tiers enable row level security;
drop policy if exists "affiliate tiers public" on public.affiliate_tiers;
create policy "affiliate tiers public" on public.affiliate_tiers for select using (true);

-- ---------- Who earns: owners of a published page ----------
create or replace function public.affiliate_handle(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select p.handle from public.pages p where p.owner_id = p_user and p.status = 'published' order by p.published_at nulls last limit 1;
$$;
revoke all on function public.affiliate_handle(uuid) from public, anon, authenticated;

-- A link's owner: a published page's handle, or an invite code.
create or replace function public.ref_owner(p_code text)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.owner_id from public.pages p where lower(p.handle) = lower(btrim(coalesce(p_code, ''))) and p.status = 'published' and p.owner_id is not null limit 1),
    (select pr.id from public.profiles pr where pr.referral_code = lower(btrim(coalesce(p_code, ''))) limit 1));
$$;
revoke all on function public.ref_owner(text) from public, anon, authenticated;

-- Invites (008) now also accept a page handle as the code.
create or replace function public.set_referrer(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ref uuid; joined timestamptz;
begin
  if uid is null then return false; end if;
  select created_at into joined from public.profiles where id = uid;
  if joined is null or joined < now() - interval '7 days' then return false; end if;
  if exists (select 1 from public.profiles where id = uid and referred_by is not null) then return false; end if;
  ref := public.ref_owner(p_code);
  if ref is null or ref = uid then return false; end if;
  update public.profiles set referred_by = ref where id = uid;
  insert into public.referrals (referee, referrer) values (uid, ref) on conflict (referee) do nothing;
  return true;
end; $$;
grant execute on function public.set_referrer(text) to authenticated;

-- ---------- Link visits (for buyers who did not sign up with the link) ----------
create table if not exists public.ref_touches (
  user_id uuid primary key references auth.users (id) on delete cascade,
  affiliate uuid not null references auth.users (id) on delete cascade,
  code text not null check (length(code) <= 40),
  seen_at timestamptz not null default now()
);
alter table public.ref_touches enable row level security;
drop policy if exists "admins read touches" on public.ref_touches;
create policy "admins read touches" on public.ref_touches for select using (public.is_admin());

-- The browser reports the link the player came through (kept 90 days in
-- the browser). The first link wins until it is 90 days old.
create or replace function public.note_ref(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); aff uuid; days int;
begin
  if uid is null or p_code is null or p_code !~ '^[A-Za-z0-9_]{2,15}$' then return false; end if;
  aff := public.ref_owner(p_code);
  if aff is null or aff = uid then return false; end if;
  select touch_days into days from public.affiliate_settings where id = 1;
  insert into public.ref_touches (user_id, affiliate, code) values (uid, aff, lower(p_code))
  on conflict (user_id) do update set affiliate = excluded.affiliate, code = excluded.code, seen_at = now()
    where public.ref_touches.seen_at < now() - make_interval(days => coalesce(days, 90));
  return true;
end; $$;
revoke all on function public.note_ref(text) from public, anon;
grant execute on function public.note_ref(text) to authenticated;

-- ---------- Earnings ----------
create table if not exists public.affiliate_earnings (
  id uuid primary key default gen_random_uuid(),
  affiliate uuid not null references auth.users (id) on delete cascade,
  buyer uuid references auth.users (id) on delete set null,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  product_id text not null,
  kind text not null check (kind in ('product', 'project')),
  source text not null check (source in ('invite', 'link')),
  paid_usd numeric(10, 2) not null check (paid_usd >= 0),
  rate numeric(4, 3) not null,
  amount_usd numeric(10, 2) not null check (amount_usd >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'void')),
  flags text[] not null default '{}',
  ready_at timestamptz not null,
  payout_id uuid,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);
create index if not exists affiliate_earnings_aff on public.affiliate_earnings (affiliate, created_at desc);
alter table public.affiliate_earnings enable row level security;
drop policy if exists "own earnings read" on public.affiliate_earnings;
create policy "own earnings read" on public.affiliate_earnings for select using (auth.uid() = affiliate or public.is_admin());

-- Ready to pay: 30 days on, and a project delivered.
create or replace function public.earning_ready(e public.affiliate_earnings)
returns boolean language sql stable security definer set search_path = '' as $$
  select e.status = 'pending' and e.payout_id is null and now() >= e.ready_at and (e.kind = 'product'
    or exists (select 1 from public.biz_requests r where r.order_id = e.order_id and r.status = 'live')
    or exists (select 1 from public.project_requests r where r.order_id = e.order_id and r.status = 'live')
    or exists (select 1 from public.sponsor_bookings b where b.order_id = e.order_id and b.status = 'approved'));
$$;
revoke all on function public.earning_ready(public.affiliate_earnings) from public, anon, authenticated;

-- A paid order: who brought the buyer in, and their share.
create or replace function public.affiliate_on_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s public.affiliate_settings;
  aff uuid; src text; usd numeric; buyers int; r numeric; f text[] := '{}';
begin
  if tg_op = 'UPDATE' and new.status = 'refunded' and old.status is distinct from 'refunded' then
    update public.affiliate_earnings set status = 'void', voided_at = now() where order_id = new.id and status = 'pending' and payout_id is null;
    update public.affiliate_earnings set flags = array_append(flags, 'refunded-after-payout') where order_id = new.id and (status = 'paid' or payout_id is not null) and not ('refunded-after-payout' = any (flags));
    return new;
  end if;
  if new.status <> 'paid' or (tg_op = 'UPDATE' and old.status = 'paid') then return new; end if;
  if new.user_id is null or new.currency not in ('INR', 'USD') or coalesce(new.provider, 'razorpay') not in ('razorpay', 'paymento') then return new; end if;
  select * into s from public.affiliate_settings where id = 1;
  if not found then return new; end if;
  -- Signed up with the link (12 months), else came through it (90 days).
  select r.referrer, 'invite' into aff, src from public.referrals r where r.referee = new.user_id and r.created_at > now() - make_interval(months => s.invite_months);
  if aff is null then
    select t.affiliate, 'link' into aff, src from public.ref_touches t where t.user_id = new.user_id and t.seen_at > now() - make_interval(days => s.touch_days);
  end if;
  if aff is null or aff = new.user_id or public.affiliate_handle(aff) is null then return new; end if;
  usd := round(case when new.currency = 'USD' then new.amount / 100.0 else new.amount / 100.0 / s.inr_per_usd end, 2);
  select count(distinct e.buyer) into buyers from public.affiliate_earnings e where e.affiliate = aff and e.status <> 'void' and e.buyer is distinct from new.user_id;
  select t.rate into r from public.affiliate_tiers t where t.min_buyers <= buyers order by t.min_buyers desc limit 1;
  if r is null then return new; end if;
  -- Things for you to look at before paying.
  if exists (select 1 from public.profiles p where p.id = new.user_id and p.created_at > now() - interval '1 hour') then f := array_append(f, 'new-account'); end if;
  if usd >= 500 then f := array_append(f, 'big'); end if;
  if (select count(*) from public.affiliate_earnings e where e.affiliate = aff and e.buyer = new.user_id) >= 3 then f := array_append(f, 'repeat-buyer'); end if;
  insert into public.affiliate_earnings (affiliate, buyer, order_id, product_id, kind, source, paid_usd, rate, amount_usd, flags, ready_at)
  values (aff, new.user_id, new.id, new.product_id,
    case when new.product_id like 'deposit-%' or new.product_id like 'course-%' or new.product_id like 'ad-%' then 'project' else 'product' end,
    src, usd, r, round(usd * r, 2), f, coalesce(new.paid_at, now()) + make_interval(days => s.hold_days))
  on conflict (order_id) do nothing;
  return new;
end; $$;
drop trigger if exists affiliate_on_order on public.orders;
create trigger affiliate_on_order after insert or update of status on public.orders
  for each row execute function public.affiliate_on_order();

-- ---------- Wallets and payouts ----------
create table if not exists public.affiliate_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  network text not null check (network in ('ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb', 'solana', 'tron')),
  token text not null check (token in ('USDC', 'USDT')),
  wallet text not null check (length(wallet) between 26 and 64 and wallet ~ '^[A-Za-z0-9]+$'),
  updated_at timestamptz not null default now()
);
alter table public.affiliate_wallets enable row level security;
drop policy if exists "own affiliate wallet read" on public.affiliate_wallets;
create policy "own affiliate wallet read" on public.affiliate_wallets for select using (auth.uid() = user_id or public.is_admin());

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate uuid not null references auth.users (id) on delete cascade,
  amount_usd numeric(10, 2) not null check (amount_usd > 0),
  network text not null,
  token text not null,
  wallet text not null,
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  tx text check (length(tx) <= 200),
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.affiliate_payouts enable row level security;
drop policy if exists "own affiliate payouts read" on public.affiliate_payouts;
create policy "own affiliate payouts read" on public.affiliate_payouts for select using (auth.uid() = affiliate or public.is_admin());

create or replace function public.set_affiliate_wallet(p_network text, p_token text, p_wallet text)
returns void language plpgsql security definer set search_path = '' as $$
declare w text := btrim(coalesce(p_wallet, ''));
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if public.affiliate_handle(auth.uid()) is null then raise exception 'Invite and earn is for people with a published web3.toys page.'; end if;
  if p_network in ('ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb') and w !~ '^0x[0-9a-fA-F]{40}$' then raise exception 'That does not look like a wallet address for this network (it should start with 0x).'; end if;
  if p_network = 'solana' and w !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'That does not look like a Solana address.'; end if;
  if p_network = 'tron' and w !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' then raise exception 'That does not look like a Tron address (it should start with T).'; end if;
  insert into public.affiliate_wallets (user_id, network, token, wallet) values (auth.uid(), p_network, p_token, w)
  on conflict (user_id) do update set network = excluded.network, token = excluded.token, wallet = excluded.wallet, updated_at = now();
end; $$;
revoke all on function public.set_affiliate_wallet(text, text, text) from public, anon;
grant execute on function public.set_affiliate_wallet(text, text, text) to authenticated;

-- Ask for everything that is ready (from $20). One open request at a time.
create or replace function public.request_affiliate_payout()
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); w public.affiliate_wallets; total numeric; minimum numeric; pid uuid;
begin
  if uid is null then raise exception 'Log in first.'; end if;
  if public.affiliate_handle(uid) is null then raise exception 'Invite and earn is for people with a published web3.toys page.'; end if;
  select * into w from public.affiliate_wallets where user_id = uid;
  if not found then raise exception 'Add your USDC or USDT wallet first.'; end if;
  if exists (select 1 from public.affiliate_payouts where affiliate = uid and status = 'requested') then raise exception 'You already have a payout on its way.'; end if;
  perform pg_advisory_xact_lock(hashtext('aff:' || uid::text));
  select coalesce(sum(e.amount_usd), 0) into total from public.affiliate_earnings e where e.affiliate = uid and public.earning_ready(e);
  select min_payout_usd into minimum from public.affiliate_settings where id = 1;
  if total < minimum then raise exception 'Payouts start at $%. You have $% ready.', minimum, total; end if;
  insert into public.affiliate_payouts (affiliate, amount_usd, network, token, wallet) values (uid, total, w.network, w.token, w.wallet) returning id into pid;
  update public.affiliate_earnings e set payout_id = pid where e.affiliate = uid and public.earning_ready(e);
  return pid;
end; $$;
revoke all on function public.request_affiliate_payout() from public, anon;
grant execute on function public.request_affiliate_payout() to authenticated;

-- Everything for the Invite and earn card.
create or replace function public.my_affiliate()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); h text; buyers int; rate numeric; nxt int; nrate numeric; code text;
begin
  if uid is null then return null; end if;
  h := public.affiliate_handle(uid);
  select referral_code into code from public.profiles where id = uid;
  select count(distinct buyer) into buyers from public.affiliate_earnings where affiliate = uid and status <> 'void';
  select t.rate into rate from public.affiliate_tiers t where t.min_buyers <= buyers order by t.min_buyers desc limit 1;
  select t.min_buyers, t.rate into nxt, nrate from public.affiliate_tiers t where t.min_buyers > buyers order by t.min_buyers limit 1;
  return jsonb_build_object(
    'eligible', h is not null, 'handle', h, 'code', code, 'buyers', buyers, 'rate', rate, 'next_at', nxt, 'next_rate', nrate,
    'settings', (select to_jsonb(s) - 'id' from public.affiliate_settings s where id = 1),
    'pending', (select coalesce(sum(amount_usd), 0) from public.affiliate_earnings e where e.affiliate = uid and e.status = 'pending' and e.payout_id is null and not public.earning_ready(e)),
    'ready', (select coalesce(sum(amount_usd), 0) from public.affiliate_earnings e where e.affiliate = uid and public.earning_ready(e)),
    'requested', (select coalesce(sum(amount_usd), 0) from public.affiliate_payouts where affiliate = uid and status = 'requested'),
    'paid', (select coalesce(sum(amount_usd), 0) from public.affiliate_payouts where affiliate = uid and status = 'paid'),
    'wallet', (select jsonb_build_object('network', w.network, 'token', w.token, 'wallet', w.wallet) from public.affiliate_wallets w where w.user_id = uid),
    'recent', coalesce((select jsonb_agg(x) from (select e.created_at, e.product_id, e.kind, e.paid_usd, e.rate, e.amount_usd,
        case when e.status = 'void' then 'cancelled (refunded)' when e.status = 'paid' then 'paid' when e.payout_id is not null then 'payout requested'
          when public.earning_ready(e) then 'ready' when e.kind = 'project' and now() >= e.ready_at then 'waiting for delivery' else 'waiting ' || greatest(1, ceil(extract(epoch from e.ready_at - now()) / 86400))::int || ' days' end as state
      from public.affiliate_earnings e where e.affiliate = uid order by e.created_at desc limit 30) x), '[]'),
    'payouts', coalesce((select jsonb_agg(x) from (select p.created_at, p.amount_usd, p.token, p.network, p.status, p.tx, p.paid_at from public.affiliate_payouts p where p.affiliate = uid order by p.created_at desc limit 10) x), '[]'));
end; $$;
revoke all on function public.my_affiliate() from public, anon;
grant execute on function public.my_affiliate() to authenticated;

-- ---------- Admin ----------
create or replace function public.admin_affiliates()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'settings', (select to_jsonb(s) - 'id' from public.affiliate_settings s where id = 1),
    'payouts', coalesce((select jsonb_agg(x) from (select p.id, p.created_at, p.amount_usd, p.token, p.network, p.wallet, p.status, p.tx, public.affiliate_handle(p.affiliate) as handle, pr.display_name,
        (select count(*) from public.affiliate_earnings e where e.payout_id = p.id and cardinality(e.flags) > 0) as flagged
      from public.affiliate_payouts p left join public.profiles pr on pr.id = p.affiliate order by (p.status = 'requested') desc, p.created_at desc limit 100) x), '[]'),
    'affiliates', coalesce((select jsonb_agg(x) from (select public.affiliate_handle(e.affiliate) as handle, pr.display_name, count(distinct e.buyer) filter (where e.status <> 'void') as buyers,
        sum(e.amount_usd) filter (where e.status = 'pending' and e.payout_id is null) as pending, sum(e.amount_usd) filter (where e.status = 'paid') as paid,
        sum(e.paid_usd) filter (where e.status <> 'void') as sales, count(*) filter (where cardinality(e.flags) > 0) as flagged
      from public.affiliate_earnings e left join public.profiles pr on pr.id = e.affiliate group by e.affiliate, pr.display_name order by sales desc nulls last limit 200) x), '[]'),
    'flagged', coalesce((select jsonb_agg(x) from (select e.created_at, public.affiliate_handle(e.affiliate) as handle, e.product_id, e.paid_usd, e.amount_usd, e.status, e.flags, e.source
      from public.affiliate_earnings e where cardinality(e.flags) > 0 order by e.created_at desc limit 100) x), '[]'));
end; $$;
grant execute on function public.admin_affiliates() to authenticated;

-- p_action: 'paid' (with the transaction link or hash) or 'reject' (the
-- earnings go back to ready).
create or replace function public.admin_affiliate_payout(p_id uuid, p_action text, p_tx text default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_action = 'paid' then
    if length(btrim(coalesce(p_tx, ''))) < 6 then raise exception 'Add the transaction hash or link.'; end if;
    update public.affiliate_payouts set status = 'paid', tx = left(btrim(p_tx), 200), note = left(p_note, 500), paid_at = now() where id = p_id and status = 'requested';
    if not found then raise exception 'That payout is not waiting.'; end if;
    update public.affiliate_earnings set status = 'paid' where payout_id = p_id and status = 'pending';
  elsif p_action = 'reject' then
    update public.affiliate_payouts set status = 'rejected', note = left(p_note, 500) where id = p_id and status = 'requested';
    if not found then raise exception 'That payout is not waiting.'; end if;
    update public.affiliate_earnings set payout_id = null where payout_id = p_id and status = 'pending';
  else
    raise exception 'Unknown action';
  end if;
end; $$;
revoke all on function public.admin_affiliate_payout(uuid, text, text, text) from public, anon;
grant execute on function public.admin_affiliate_payout(uuid, text, text, text) to authenticated;

create or replace function public.admin_set_affiliate_rate(p_inr_per_usd numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_inr_per_usd is null or p_inr_per_usd < 40 or p_inr_per_usd > 200 then raise exception 'Use the rupees for one US dollar, like 85.'; end if;
  update public.affiliate_settings set inr_per_usd = p_inr_per_usd where id = 1;
end; $$;
revoke all on function public.admin_set_affiliate_rate(numeric) from public, anon;
grant execute on function public.admin_set_affiliate_rate(numeric) to authenticated;
