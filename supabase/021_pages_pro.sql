-- web3.toys: profile pages parts C, D and E: consent, Pro, and the directory.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 009, 014, 017, 019 and 020 first.
--
-- C. Consent: when a player earns a project's Pro badge or joins with a
--    creator's link, they are asked "Share my X handle and badges with
--    [name]?" (and, optionally, their email). Saved per player per page;
--    they can stop sharing any time in My Progress. Owners only ever see
--    players who said yes, and only what each one agreed to share.
-- D. Pro: turned on by purchases (months in pro_months below, the same as
--    data/business/pages.json; a test compares them), added on top of what
--    is left. You can grant or extend it by hand. The yearly plan (product
--    pro-year) only exists while pages.json says it is on.
-- E. The /pages directory.

-- ---------- C. Consent ----------
-- Pages this player has not been asked about yet: projects whose Academy
-- course they passed, and the creator whose link they joined with.
create or replace function public.my_consent_asks()
returns table (page_id uuid, handle text, name text, type text, source text, avatar_path text, color text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, p.name, p.type, 'pro', p.avatar_path, p.color
  from public.pages p
  where p.type = 'project' and p.status = 'published' and p.owner_id is distinct from auth.uid()
    and exists (select 1 from public.certificates c where c.user_id = auth.uid() and c.toy = any (array(select 'academy:' || x from unnest(p.featured_courses) x)))
    and not exists (select 1 from public.page_consents k where k.user_id = auth.uid() and k.page_id = p.id)
  union all
  select p.id, p.handle, p.name, p.type, 'referral', p.avatar_path, p.color
  from public.pages p join public.referrals r on r.referrer = p.owner_id
  where p.type = 'creator' and p.status = 'published' and r.referee = auth.uid()
    and not exists (select 1 from public.page_consents k where k.user_id = auth.uid() and k.page_id = p.id)
  limit 5;
$$;
revoke all on function public.my_consent_asks() from public, anon;
grant execute on function public.my_consent_asks() to authenticated;

-- Yes (share true) or No. Asking again later only happens from My Progress.
create or replace function public.answer_consent(p_page uuid, p_share boolean, p_email boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_source text;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  select source into v_source from public.my_consent_asks() where page_id = p_page;
  if v_source is null then
    select source into v_source from public.page_consents where user_id = auth.uid() and page_id = p_page;
  end if;
  if v_source is null then raise exception 'This page has not asked you.'; end if;
  insert into public.page_consents (user_id, page_id, source, share_handle, share_email, agreed_at, withdrawn_at, asked_at)
  values (auth.uid(), p_page, v_source, coalesce(p_share, false), coalesce(p_share, false) and coalesce(p_email, false),
    case when p_share then now() end, null, now())
  on conflict (user_id, page_id) do update set share_handle = excluded.share_handle, share_email = excluded.share_email,
    agreed_at = excluded.agreed_at, withdrawn_at = case when excluded.share_handle then null else now() end;
end; $$;
revoke all on function public.answer_consent(uuid, boolean, boolean) from public, anon;
grant execute on function public.answer_consent(uuid, boolean, boolean) to authenticated;

-- My answers, for My Progress (stop or start sharing there).
create or replace function public.my_consents()
returns table (page_id uuid, handle text, name text, type text, source text, share_handle boolean, share_email boolean, agreed_at timestamptz, withdrawn_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select k.page_id, p.handle, p.name, p.type, k.source, k.share_handle and k.withdrawn_at is null, k.share_email and k.withdrawn_at is null, k.agreed_at, k.withdrawn_at
  from public.page_consents k join public.pages p on p.id = k.page_id where k.user_id = auth.uid() order by k.asked_at desc;
$$;
revoke all on function public.my_consents() from public, anon;
grant execute on function public.my_consents() to authenticated;

create or replace function public.withdraw_consent(p_page uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.page_consents set share_handle = false, share_email = false, withdrawn_at = now() where user_id = auth.uid() and page_id = p_page;
end; $$;
revoke all on function public.withdraw_consent(uuid) from public, anon;
grant execute on function public.withdraw_consent(uuid) to authenticated;

-- ---------- D. Pro ----------
alter table public.pages add column if not exists pro_until timestamptz;

create table if not exists public.page_pro_log (
  id bigint generated always as identity primary key,
  page_id uuid references public.pages (id) on delete cascade,
  handle text,
  months int not null,
  reason text not null,
  order_id uuid unique references public.orders (id) on delete set null,
  admin_id uuid references auth.users (id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.page_pro_log enable row level security;
drop policy if exists "admins read pro log" on public.page_pro_log;
create policy "admins read pro log" on public.page_pro_log for select using (public.is_admin());

-- Months of Pro for each product (the same as pages.json pro.months; course-* = "course").
create or replace function public.pro_months(p_product text) returns int language sql immutable as $$
  select case
    when p_product = 'deposit-toy-mini' then 3
    when p_product = 'deposit-toy-full' then 6
    when p_product = 'deposit-toy-tournament' then 12
    when p_product like 'course-%' then 3
    when p_product = 'pro-year' then 12
    else 0 end
$$;

-- Adds months on top of what is left (or takes them away, never below now).
create or replace function public.pro_add(p_page uuid, p_months int)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v timestamptz;
begin
  update public.pages set pro_until = case
      when p_months >= 0 then greatest(coalesce(pro_until, now()), now()) + make_interval(months => p_months)
      else greatest(now(), coalesce(pro_until, now()) + make_interval(months => p_months)) end,
    updated_at = now()
  where id = p_page returning pro_until into v;
  return v;
end; $$;
revoke all on function public.pro_add(uuid, int) from public, anon, authenticated;

-- A paid order turns Pro on for the project's page, found by the X handle on
-- the request (or, for the yearly plan, the page bought for). No page yet:
-- the months wait and are added when the page is made.
create or replace function public.pro_from_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m int := public.pro_months(new.product_id);
  h text;
  v_page uuid;
  v_log public.page_pro_log;
begin
  if m = 0 then return new; end if;
  if new.status = 'paid' and old.status is distinct from 'paid' then
    if exists (select 1 from public.page_pro_log where order_id = new.id) then return new; end if;
    if new.product_id = 'pro-year' then
      select id, handle into v_page, h from public.pages where id::text = new.item and type = 'project';
    elsif new.product_id like 'deposit-toy-%' then
      select ltrim(x_handle, '@') into h from public.biz_requests where order_id = new.id or id::text = new.item limit 1;
    else
      select ltrim(x_handle, '@') into h from public.project_requests where order_id = new.id or id::text = new.item limit 1;
    end if;
    if v_page is null and h is not null then select id into v_page from public.pages where lower(handle) = lower(h) and type = 'project'; end if;
    insert into public.page_pro_log (page_id, handle, months, reason, order_id, applied_at)
    values (v_page, h, m, new.product_id, new.id, case when v_page is not null then now() end);
    if v_page is not null then perform public.pro_add(v_page, m); end if;
  elsif new.status = 'refunded' and old.status = 'paid' then
    select * into v_log from public.page_pro_log where order_id = new.id;
    if v_log.page_id is not null and v_log.applied_at is not null then perform public.pro_add(v_log.page_id, -v_log.months); end if;
    update public.page_pro_log set reason = reason || ' (refunded)', applied_at = null where order_id = new.id;
  end if;
  return new;
end; $$;
drop trigger if exists orders_pro on public.orders;
create trigger orders_pro after update of status on public.orders for each row execute function public.pro_from_order();

-- Months waiting for a page are added when the page is made.
create or replace function public.pro_pending()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.type <> 'project' then return new; end if;
  for r in select id, months from public.page_pro_log where page_id is null and applied_at is null and lower(handle) = lower(new.handle) and reason not like '%(refunded)' loop
    update public.page_pro_log set page_id = new.id, applied_at = now() where id = r.id;
    perform public.pro_add(new.id, r.months);
  end loop;
  return new;
end; $$;
drop trigger if exists pages_pro_pending on public.pages;
create trigger pages_pro_pending after insert on public.pages for each row execute function public.pro_pending();

-- Grant, extend or shorten Pro by hand (months can be negative), or give a
-- waiting purchase to a page (p_log).
create or replace function public.admin_grant_pro(p_page uuid, p_months int, p_note text, p_log bigint default null)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v timestamptz; m int := p_months;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_log is not null then
    select months into m from public.page_pro_log where id = p_log and applied_at is null;
    if m is null then raise exception 'That purchase is already used.'; end if;
    update public.page_pro_log set page_id = p_page, applied_at = now() where id = p_log;
  else
    if m is null or m = 0 or abs(m) > 60 then raise exception 'Give 1 to 60 months (or minus to shorten).'; end if;
    insert into public.page_pro_log (page_id, months, reason, admin_id, applied_at) values (p_page, m, coalesce(nullif(p_note, ''), 'Granted by admin'), auth.uid(), now());
  end if;
  v := public.pro_add(p_page, m);
  return v;
end; $$;
grant execute on function public.admin_grant_pro(uuid, int, text, bigint) to authenticated;

create or replace function public.page_is_pro(p_page uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select pro_until > now() from public.pages where id = p_page), false)
$$;
grant execute on function public.page_is_pro(uuid) to anon, authenticated;

-- Pro end date for the owner (and you) inside page_public.
create or replace function public.page_pro_info(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('pro', p.pro_until > now(), 'pro_until', case when coalesce(p.owner_id = auth.uid(), false) or public.is_admin() then p.pro_until end)
  from public.pages p where p.id = p_id
$$;
grant execute on function public.page_pro_info(uuid) to anon, authenticated;

-- Pro: the fans who said yes, with only what each agreed to share.
create or replace function public.page_fans(p_id uuid)
returns table (display_name text, x_handle text, email text, badges text[], source text, agreed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare pg public.pages; toys text[];
begin
  select * into pg from public.pages where id = p_id;
  if not found or not (coalesce(pg.owner_id = auth.uid(), false) or public.is_admin()) then raise exception 'Only the owner can export fans.'; end if;
  if not public.is_admin() and not coalesce(pg.pro_until > now(), false) then raise exception 'The fan export is part of Pro.'; end if;
  toys := pg.featured_toys || array(select 'academy:' || c from unnest(pg.featured_courses) c);
  return query
  select pr.display_name,
    (select coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username') from auth.identities i where i.user_id = k.user_id and i.provider in ('x', 'twitter') limit 1),
    case when k.share_email then (select u.email from auth.users u where u.id = k.user_id) end,
    array(select c.title from public.certificates c where c.user_id = k.user_id and (c.toy = any (toys) or pg.type <> 'project') order by c.cert_date),
    k.source, k.agreed_at
  from public.page_consents k left join public.profiles pr on pr.id = k.user_id
  where k.page_id = p_id and k.share_handle and k.agreed_at is not null and k.withdrawn_at is null
  order by k.agreed_at;
end; $$;
revoke all on function public.page_fans(uuid) from public, anon;
grant execute on function public.page_fans(uuid) to authenticated;

-- Pro: detailed analytics (last 30 days by day, plays by toy, consent).
create or replace function public.page_analytics(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare pg public.pages; path1 text; path2 text; tag text;
begin
  select * into pg from public.pages where id = p_id;
  if not found or not (coalesce(pg.owner_id = auth.uid(), false) or public.is_admin()) then raise exception 'Only the owner can see these stats.'; end if;
  if not public.is_admin() and not coalesce(pg.pro_until > now(), false) then raise exception 'Detailed analytics are part of Pro.'; end if;
  path1 := '/@' || lower(pg.handle); path2 := path1 || '/'; tag := '%@' || lower(pg.handle);
  return jsonb_build_object(
    'days', coalesce((select jsonb_agg(x order by x.day) from (
      select d::date as day,
        (select count(*) from public.events e where e.name = 'page_view' and lower(e.page) in (path1, path2) and e.created_at::date = d::date) as views,
        (select count(*) from public.events e where e.name = 'play' and lower(e.item) like tag and e.created_at::date = d::date) as plays
      from generate_series(now()::date - 29, now()::date, interval '1 day') d) x), '[]'),
    'byToy', coalesce((select jsonb_agg(x) from (select split_part(item, '@', 1) as toy, count(*) as plays from public.events
      where name = 'play' and lower(item) like tag and created_at > now() - interval '30 days' group by 1 order by 2 desc) x), '[]'),
    'consent', (select jsonb_build_object('asked', count(*), 'yes', count(*) filter (where share_handle and withdrawn_at is null),
      'email', count(*) filter (where share_email and withdrawn_at is null), 'withdrawn', count(*) filter (where withdrawn_at is not null and agreed_at is not null))
      from public.page_consents where page_id = p_id));
end; $$;
revoke all on function public.page_analytics(uuid) from public, anon;
grant execute on function public.page_analytics(uuid) to authenticated;

-- Pro reminders (14 and 3 days before the end): which pages are due, for the
-- page-emails function (service key only), and a log so each goes out once.
create table if not exists public.page_pro_reminders (
  page_id uuid not null references public.pages (id) on delete cascade,
  pro_until timestamptz not null,
  days int not null,
  sent_at timestamptz not null default now(),
  primary key (page_id, pro_until, days)
);
alter table public.page_pro_reminders enable row level security;

create or replace function public.pro_reminders_due(p_days int[] default '{14,3}')
returns table (page_id uuid, handle text, name text, pro_until timestamptz, days int, email text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, p.name, p.pro_until, d, u.email
  from public.pages p join auth.users u on u.id = p.owner_id, unnest(p_days) d
  where p.pro_until > now() and p.pro_until <= now() + make_interval(days => d) and p.status = 'published'
    and not exists (select 1 from public.page_pro_reminders r where r.page_id = p.id and r.pro_until = p.pro_until and r.days <= d)
    and d = (select min(x) from unnest(p_days) x where p.pro_until <= now() + make_interval(days => x));
$$;
revoke all on function public.pro_reminders_due(int[]) from public, anon, authenticated;
grant execute on function public.pro_reminders_due(int[]) to service_role;

-- ---------- E. The directory ----------
-- Published pages: Pro first, then claimed, unclaimed last.
create or replace function public.directory_pages(p_type text default null, p_q text default null, p_verified boolean default false)
returns table (handle text, name text, type text, bio text, avatar_path text, color text, verified boolean, claimed boolean, pro boolean)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.type, left(p.bio, 140), p.avatar_path, p.color, p.owner_id is not null and p.x_id is not null, p.owner_id is not null, coalesce(p.pro_until > now(), false)
  from public.pages p
  where p.status = 'published'
    and (p_type is null or p_type = '' or p.type = p_type)
    and (not coalesce(p_verified, false) or (p.owner_id is not null and p.x_id is not null))
    and (coalesce(p_q, '') = '' or p.name ilike '%' || p_q || '%' or p.handle ilike '%' || ltrim(p_q, '@') || '%' or p.bio ilike '%' || p_q || '%')
  order by coalesce(p.pro_until > now(), false) desc, (p.owner_id is not null) desc, p.published_at desc nulls last
  limit 300;
$$;
grant execute on function public.directory_pages(text, text, boolean) to anon, authenticated;

-- ---------- Admin: Pro status and consent statistics ----------
create or replace function public.admin_pro_status()
returns table (page_id uuid, handle text, name text, owner_name text, pro_until timestamptz, last_reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select p.id, p.handle, p.name, pr.display_name, p.pro_until,
    (select l.reason from public.page_pro_log l where l.page_id = p.id order by l.created_at desc limit 1)
  from public.pages p left join public.profiles pr on pr.id = p.owner_id
  where p.pro_until is not null order by p.pro_until;
end; $$;
grant execute on function public.admin_pro_status() to authenticated;

create or replace function public.admin_consent_stats()
returns table (page_id uuid, handle text, name text, asked bigint, yes bigint, email bigint, said_no bigint, withdrawn bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select p.id, p.handle, p.name, count(k.*),
    count(k.*) filter (where k.share_handle and k.withdrawn_at is null),
    count(k.*) filter (where k.share_email and k.withdrawn_at is null),
    count(k.*) filter (where k.agreed_at is null),
    count(k.*) filter (where k.agreed_at is not null and k.withdrawn_at is not null)
  from public.pages p join public.page_consents k on k.page_id = p.id
  group by p.id, p.handle, p.name order by count(k.*) desc;
end; $$;
grant execute on function public.admin_consent_stats() to authenticated;

