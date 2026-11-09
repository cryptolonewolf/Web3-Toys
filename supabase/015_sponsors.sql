-- web3.toys: Sponsor a Toy (/advertise/).
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 004_payments.sql and 014_business.sql first.
--
-- A logged-in sponsor uploads a logo, books a slot (create_sponsor_booking)
-- and pays (product ad-toy-TOY, ad-toy-TOY-round, ad-site or ad-newsletter,
-- with the booking id as the item). The slot is held for 30 minutes while
-- they pay. Once paid the booking waits for your approval in admin; reject
-- it and refund in full. Approved bookings show on their toy that month.
-- Views and clicks are counted here (no outside trackers); each sponsor gets
-- a private stats link with their booking's token.

create table if not exists public.sponsor_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('toy', 'site', 'newsletter')),
  toy_id text check (toy_id is null or toy_id ~ '^[a-z0-9-]{2,40}$'),
  month date not null check (extract(day from month) = 1),
  with_round boolean not null default false,
  sponsor text not null check (length(sponsor) between 2 and 60),
  category text not null,
  line text not null check (length(line) between 3 and 80),
  link text not null check (link ~ '^https://[^\s]{3,}$' and length(link) <= 300),
  logo_path text not null check (logo_path ~ '^[0-9a-f-]{36}/[a-z0-9-]{8,40}\.(png|svg)$'),
  email text not null,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'pending', 'approved', 'rejected', 'refunded', 'cancelled')),
  order_id uuid references public.orders (id) on delete set null,
  stats_token text not null default replace(gen_random_uuid()::text, '-', ''),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sponsor_bookings_slot on public.sponsor_bookings (kind, toy_id, month);
alter table public.sponsor_bookings enable row level security;
drop policy if exists "own bookings read" on public.sponsor_bookings;
create policy "own bookings read" on public.sponsor_bookings for select using (auth.uid() = user_id or public.is_admin());

-- A slot is taken by a paid or approved booking, or held for 30 minutes
-- while someone pays.
create or replace function public.sponsor_slot_taken(p_kind text, p_toy text, p_month date, p_except uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sponsor_bookings b
    where b.kind = p_kind and b.toy_id is not distinct from p_toy and b.month = p_month
      and (p_except is null or b.id <> p_except)
      and (b.status in ('pending', 'approved') or (b.status = 'pending_payment' and b.created_at > now() - interval '30 minutes'))
  );
$$;

create or replace function public.create_sponsor_booking(
  p_kind text, p_toy text, p_month date, p_round boolean, p_sponsor text, p_category text,
  p_line text, p_link text, p_logo text, p_email text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_toy text := case when p_kind = 'toy' then p_toy else null end;
  v_month date := date_trunc('month', p_month)::date;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if p_kind not in ('toy', 'site', 'newsletter') then raise exception 'Pick a slot type.'; end if;
  if p_kind = 'toy' and coalesce(p_toy, '') !~ '^[a-z0-9-]{2,40}$' then raise exception 'Pick a toy.'; end if;
  if v_month < date_trunc('month', now())::date or v_month > (date_trunc('month', now()) + interval '12 months')::date then raise exception 'Pick a month in the next year.'; end if;
  if length(btrim(coalesce(p_sponsor, ''))) < 2 or length(p_sponsor) > 60 then raise exception 'Add your project name.'; end if;
  if length(btrim(coalesce(p_line, ''))) < 3 or length(p_line) > 80 then raise exception 'Your line must be 3 to 80 characters.'; end if;
  if coalesce(p_link, '') !~ '^https://[^\s]{3,}$' or length(p_link) > 300 then raise exception 'The link must start with https://'; end if;
  if coalesce(p_logo, '') !~ ('^' || auth.uid()::text || '/[a-z0-9-]{8,40}\.(png|svg)$') then raise exception 'Upload your logo first.'; end if;
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Add an email we can reply to.'; end if;
  if (select count(*) from public.sponsor_bookings where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That is a lot of bookings today. Email us instead.';
  end if;
  -- One booking at a time per slot, decided here so two people can never take it.
  perform pg_advisory_xact_lock(hashtext(p_kind || ':' || coalesce(v_toy, '') || ':' || v_month::text));
  if public.sponsor_slot_taken(p_kind, v_toy, v_month) then raise exception 'Sorry, that slot was just taken. Pick another month or toy.'; end if;
  insert into public.sponsor_bookings (user_id, kind, toy_id, month, with_round, sponsor, category, line, link, logo_path, email)
  values (auth.uid(), p_kind, v_toy, v_month, coalesce(p_round, false) and p_kind = 'toy', btrim(p_sponsor), left(p_category, 40), btrim(p_line), btrim(p_link), p_logo, btrim(p_email))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.create_sponsor_booking(text, text, date, boolean, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_sponsor_booking(text, text, date, boolean, text, text, text, text, text, text) to authenticated;

-- Paid: the booking waits for approval. Refunded: the booking follows.
create or replace function public.sponsor_paid()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.product_id like 'ad-%' and new.item ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
      update public.sponsor_bookings b
        set order_id = new.id, status = case when b.status = 'pending_payment' then 'pending' else b.status end, updated_at = now()
        where b.id = new.item::uuid and b.user_id = new.user_id and (b.order_id is null or b.order_id = new.id)
          and new.product_id = case b.kind when 'toy' then 'ad-toy-' || b.toy_id || case when b.with_round then '-round' else '' end
                                           when 'site' then 'ad-site' else 'ad-newsletter' end;
    elsif new.status = 'refunded' and tg_op = 'UPDATE' and old.status is distinct from 'refunded' then
      update public.sponsor_bookings set status = 'refunded', updated_at = now() where order_id = new.id;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists orders_sponsor_paid on public.orders;
create trigger orders_sponsor_paid after insert or update of status on public.orders
  for each row execute function public.sponsor_paid();

-- The calendar on /advertise/: which slots are taken (no sponsor names).
create or replace function public.sponsor_calendar()
returns table (kind text, toy_id text, month date)
language sql stable security definer set search_path = '' as $$
  select b.kind, b.toy_id, b.month from public.sponsor_bookings b
  where b.month >= date_trunc('month', now())::date
    and (b.status in ('pending', 'approved') or (b.status = 'pending_payment' and b.created_at > now() - interval '30 minutes'));
$$;
grant execute on function public.sponsor_calendar() to anon, authenticated;

-- What the toys show this month: approved bookings only.
create or replace function public.active_sponsors()
returns table (id uuid, kind text, toy_id text, sponsor text, line text, link text, logo_path text, with_round boolean)
language sql stable security definer set search_path = '' as $$
  select b.id, b.kind, b.toy_id, b.sponsor, b.line, b.link, b.logo_path, b.with_round from public.sponsor_bookings b
  where b.status = 'approved' and b.month = date_trunc('month', now())::date and b.kind in ('toy', 'site');
$$;
grant execute on function public.active_sponsors() to anon, authenticated;

-- First-party counter: views and clicks per booking, slot and day.
create table if not exists public.sponsor_counts (
  booking_id uuid not null references public.sponsor_bookings (id) on delete cascade,
  day date not null default current_date,
  slot text not null check (slot in ('start', 'result')),
  views bigint not null default 0,
  clicks bigint not null default 0,
  primary key (booking_id, day, slot)
);
alter table public.sponsor_counts enable row level security;

create or replace function public.sponsor_hit(p_booking uuid, p_what text, p_slot text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_what not in ('view', 'click') or p_slot not in ('start', 'result') then return; end if;
  if not exists (select 1 from public.sponsor_bookings where id = p_booking and status = 'approved') then return; end if;
  insert into public.sponsor_counts (booking_id, slot, views, clicks)
  values (p_booking, p_slot, case when p_what = 'view' then 1 else 0 end, case when p_what = 'click' then 1 else 0 end)
  on conflict (booking_id, day, slot) do update set
    views = public.sponsor_counts.views + excluded.views, clicks = public.sponsor_counts.clicks + excluded.clicks;
end; $$;
grant execute on function public.sponsor_hit(uuid, text, text) to anon, authenticated;

-- The private stats link: the booking id and its token.
create or replace function public.sponsor_stats(p_id uuid, p_token text)
returns table (sponsor text, kind text, toy_id text, month date, status text, day date, slot text, views bigint, clicks bigint)
language sql stable security definer set search_path = '' as $$
  select b.sponsor, b.kind, b.toy_id, b.month, b.status, c.day, c.slot, coalesce(c.views, 0), coalesce(c.clicks, 0)
  from public.sponsor_bookings b
  left join public.sponsor_counts c on c.booking_id = b.id
  where b.id = p_id and b.stats_token = p_token
  order by c.day;
$$;
grant execute on function public.sponsor_stats(uuid, text) to anon, authenticated;

-- Admin: approve, reject or note (refunds go through the admin-refund function).
create or replace function public.admin_set_booking(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status is not null and p_status not in ('pending', 'approved', 'rejected', 'cancelled') then raise exception 'Unknown status'; end if;
  update public.sponsor_bookings set status = coalesce(p_status, status), admin_note = coalesce(p_note, admin_note), updated_at = now() where id = p_id;
end; $$;
revoke all on function public.admin_set_booking(uuid, text, text) from public, anon;
grant execute on function public.admin_set_booking(uuid, text, text) to authenticated;

create or replace function public.admin_sponsor_counts()
returns table (booking_id uuid, views bigint, clicks bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select c.booking_id, sum(c.views)::bigint, sum(c.clicks)::bigint from public.sponsor_counts c group by c.booking_id;
end; $$;
grant execute on function public.admin_sponsor_counts() to authenticated;

-- Logos: a public bucket (logos show on toys); each sponsor uploads only into
-- their own folder, PNG or SVG, up to 300 KB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sponsor-logos', 'sponsor-logos', true, 307200, array['image/png', 'image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = 307200, allowed_mime_types = array['image/png', 'image/svg+xml'];
drop policy if exists "sponsors upload own logo" on storage.objects;
create policy "sponsors upload own logo" on storage.objects for insert to authenticated
  with check (bucket_id = 'sponsor-logos' and (storage.foldername(name))[1] = auth.uid()::text);
