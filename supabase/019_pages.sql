-- web3.toys: profile pages at web3.toys/@handle (projects, creators and
-- web3 personalities), claimed with Log in with X.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 001_accounts.sql, 006_admin.sql and 017_ops.sql first.
--
-- Rules the database enforces:
--   - A page's handle is an X handle. Only you (admin) can make a page that
--     nobody owns yet, and only for a project. Creators and personalities
--     make their own page, from the X account they logged in with.
--   - Claiming checks the X account Supabase saved at login (auth.identities,
--     which a player cannot edit), not a name they typed.
--   - You approve every page before it is first published. Owners' later
--     edits go live at once, but words like "presale" hide the page until
--     you look at it again.
--   - Anyone can report a page. You can suspend, transfer or delete one.
--     Every admin action is in the audit log.

-- ---------- Pages ----------
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  handle text not null check (handle ~ '^[A-Za-z0-9_]{1,15}$'),
  type text not null check (type in ('project', 'creator', 'personality')),
  status text not null default 'draft' check (status in ('draft', 'pending', 'published', 'rejected', 'suspended')),
  owner_id uuid references auth.users (id) on delete set null,
  x_id text,
  claimed_at timestamptz,
  name text not null check (length(name) between 1 and 80),
  bio text check (length(bio) <= 280),
  avatar_path text check (avatar_path ~ '^[a-z0-9-]+/[a-z0-9-]{1,60}\.(png|jpg|webp)$'),
  banner_path text check (banner_path ~ '^[a-z0-9-]+/[a-z0-9-]{1,60}\.(png|jpg|webp)$'),
  website text check (website ~ '^https://[^\s]{3,}$' and length(website) <= 300),
  socials jsonb not null default '{}',
  featured_toys text[] not null default '{}',
  featured_courses text[] not null default '{}',
  color text not null default '#FFD93D' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  flags text[] not null default '{}',
  admin_note text,
  created_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pages_handle on public.pages (lower(handle));
create index if not exists pages_owner on public.pages (owner_id);
alter table public.pages enable row level security;
drop policy if exists "published pages public" on public.pages;
create policy "published pages public" on public.pages for select using (status = 'published' or owner_id = auth.uid() or public.is_admin());

-- Handles nobody can use (the same list as data/business/pages.json; a test compares them).
create or replace function public.page_reserved(p_handle text) returns boolean language sql immutable as $$
  select lower(p_handle) = any (array[
    'admin', 'api', 'p', 'pages', 'my-page', 'web3toys', 'web3_toys', 'toys', 'support', 'help', 'team', 'official', 'settings', 'login', 'logout', 'signup',
    'about', 'academy', 'advertise', 'assets', 'book-a-call', 'books', 'builder', 'contact', 'crypto-in-5', 'data', 'dead-projects', 'docs', 'dont-lose-money',
    'earn-small', 'getting-started', 'hall-of-fame', 'images', 'invest-100', 'js', 'launch-your-toy', 'leaderboard', 'marketing', 'privacy', 'progress',
    'quizzes', 'real-toys', 'refunds', 'scam', 'simulator', 'soon', 'styles', 'supabase', 'terms', 'test-your-product', 'testers', 'tests', 'token-split',
    'tools', 'verify', 'web3-hacks', 'web3-roles', 'work-with-us', 'buildwithaki'])
$$;

-- Words that send a page to your review (the same list as pages.json flagWords).
create or replace function public.page_flags(p_text text) returns text[] language sql immutable as $$
  select array(select w from unnest(array['presale', 'pre-sale', 'airdrop', 'whitelist', '100x', '1000x', 'to the moon', 'pump', 'guaranteed',
    'buy now', 'mint now', 'token sale', 'ico', 'ido']) w
    where lower(coalesce(p_text, '')) ~ ('(^|[^a-z0-9])' || replace(w, ' ', '\s+') || '($|[^a-z0-9])'))
  || case when coalesce(p_text, '') ~ '[$][A-Z]{2,10}([^A-Za-z]|$)' then array['$TICKER'] else '{}'::text[] end
$$;

-- The X account this player logged in with (from Supabase, not editable).
create or replace function public.my_x()
returns table (x_id text, handle text)
language sql stable security definer set search_path = '' as $$
  select i.provider_id, coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username', i.identity_data ->> 'screen_name')
  from auth.identities i where i.user_id = auth.uid() and i.provider in ('x', 'twitter') limit 1;
$$;
revoke all on function public.my_x() from public, anon;
grant execute on function public.my_x() to authenticated;

-- One page, as the page shows it. Owners and admins also see drafts.
create or replace function public.page_public(p_handle text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'handle', p.handle, 'type', p.type, 'status', p.status, 'name', p.name, 'bio', p.bio,
    'avatar_path', p.avatar_path, 'banner_path', p.banner_path, 'website', p.website, 'socials', p.socials,
    'featured_toys', p.featured_toys, 'featured_courses', p.featured_courses, 'color', p.color,
    'claimed', p.owner_id is not null, 'verified', p.owner_id is not null and p.x_id is not null,
    'is_owner', p.owner_id is not null and p.owner_id = auth.uid(), 'published_at', p.published_at,
    'admin_note', case when p.owner_id = auth.uid() or public.is_admin() then p.admin_note end,
    'flags', case when p.owner_id = auth.uid() or public.is_admin() then to_jsonb(p.flags) end)
  from public.pages p
  where lower(p.handle) = lower(p_handle) and (p.status = 'published' or p.owner_id = auth.uid() or public.is_admin())
$$;
grant execute on function public.page_public(text) to anon, authenticated;

-- My pages (usually one).
create or replace function public.my_pages()
returns setof public.pages language sql stable security definer set search_path = '' as $$
  select * from public.pages where owner_id = auth.uid() order by created_at;
$$;
revoke all on function public.my_pages() from public, anon;
grant execute on function public.my_pages() to authenticated;

-- Claim: 'claimed', 'login', 'no_x', 'mismatch:<your handle>', 'taken', 'missing'.
create or replace function public.claim_page(p_handle text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me record;
  pg public.pages;
begin
  if auth.uid() is null then return 'login'; end if;
  select * into pg from public.pages where lower(handle) = lower(p_handle) for update;
  if not found or pg.status in ('suspended') then return 'missing'; end if;
  if pg.owner_id is not null then return case when pg.owner_id = auth.uid() then 'claimed' else 'taken' end; end if;
  select * into me from public.my_x();
  if me.x_id is null then return 'no_x'; end if;
  if lower(me.handle) <> lower(pg.handle) then return 'mismatch:' || coalesce(me.handle, ''); end if;
  update public.pages set owner_id = auth.uid(), x_id = me.x_id, claimed_at = now(), updated_at = now() where id = pg.id;
  insert into public.admin_audit (admin_id, action, target_kind, target_id, detail)
  values (auth.uid(), 'claimed via X', 'pages', pg.id::text, jsonb_build_object('label', pg.handle));
  return 'claimed';
end; $$;
revoke all on function public.claim_page(text) from public, anon;
grant execute on function public.claim_page(text) to authenticated;

-- Make my own page, for the X account I logged in with. It starts as a draft.
create or replace function public.create_my_page(p_type text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me record;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if p_type not in ('project', 'creator', 'personality') then raise exception 'Pick a page type.'; end if;
  select * into me from public.my_x();
  if me.x_id is null or me.handle is null then raise exception 'Pages need Log in with X, so the page is tied to your X account.'; end if;
  if public.page_reserved(me.handle) then raise exception 'That name is reserved. Contact us and we will help.'; end if;
  if exists (select 1 from public.pages where lower(handle) = lower(me.handle)) then
    raise exception 'A page for @% already exists. Open web3.toys/@% to claim it.', me.handle, me.handle;
  end if;
  if length(btrim(coalesce(p_name, ''))) < 1 then raise exception 'Add a name.'; end if;
  insert into public.pages (handle, type, owner_id, x_id, claimed_at, name, created_by)
  values (me.handle, p_type, auth.uid(), me.x_id, now(), left(btrim(p_name), 80), auth.uid()) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.create_my_page(text, text) from public, anon;
grant execute on function public.create_my_page(text, text) to authenticated;

-- Shared checks for owner and admin edits; returns the cleaned socials.
create or replace function public.page_clean_socials(p_socials jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  k text; v text; out jsonb := '{}';
begin
  if p_socials is null or jsonb_typeof(p_socials) <> 'object' then return '{}'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_socials) loop
    if k not in ('x', 'telegram', 'discord', 'youtube', 'github', 'farcaster', 'linkedin') then continue; end if;
    if coalesce(v, '') = '' then continue; end if;
    if v !~ '^https://[^\s]{3,}$' or length(v) > 300 then raise exception 'Links must start with https:// (%).', k; end if;
    out := out || jsonb_build_object(k, v);
  end loop;
  return out;
end; $$;

create or replace function public.update_my_page(p_id uuid, p_name text, p_bio text, p_avatar text, p_banner text, p_website text,
  p_socials jsonb, p_toys text[], p_courses text[], p_color text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  pg public.pages;
  f text[];
begin
  select * into pg from public.pages where id = p_id and owner_id = auth.uid() for update;
  if not found then raise exception 'This is not your page.'; end if;
  if pg.status = 'suspended' then raise exception 'This page is paused. Contact us.'; end if;
  if length(coalesce(p_bio, '')) > 280 then raise exception 'The bio can be up to 280 characters.'; end if;
  if coalesce(p_avatar, '') <> '' and split_part(p_avatar, '/', 1) <> auth.uid()::text and p_avatar is distinct from pg.avatar_path then raise exception 'Unknown picture.'; end if;
  if coalesce(p_banner, '') <> '' and split_part(p_banner, '/', 1) <> auth.uid()::text and p_banner is distinct from pg.banner_path then raise exception 'Unknown picture.'; end if;
  if coalesce(array_length(p_toys, 1), 0) > 6 or coalesce(array_length(p_courses, 1), 0) > 6 then raise exception 'Feature up to 6 toys and 6 courses.'; end if;
  f := public.page_flags(concat_ws(' ', p_name, p_bio, p_website, p_socials::text));
  update public.pages set name = left(btrim(p_name), 80), bio = nullif(btrim(coalesce(p_bio, '')), ''), avatar_path = nullif(p_avatar, ''), banner_path = nullif(p_banner, ''),
    website = nullif(btrim(coalesce(p_website, '')), ''), socials = public.page_clean_socials(p_socials),
    featured_toys = coalesce(p_toys, '{}'), featured_courses = coalesce(p_courses, '{}'), color = coalesce(nullif(p_color, ''), '#FFD93D'),
    flags = f, updated_at = now(),
    -- A live page that now mentions a flagged word waits for your look (hidden meanwhile).
    status = case when array_length(f, 1) > 0 and pg.status = 'published' then 'pending' else pg.status end
  where id = p_id;
  return case when array_length(f, 1) > 0 then 'flagged' else 'saved' end;
end; $$;
revoke all on function public.update_my_page(uuid, text, text, text, text, text, jsonb, text[], text[], text) from public, anon;
grant execute on function public.update_my_page(uuid, text, text, text, text, text, jsonb, text[], text[], text) to authenticated;

-- Send my draft (or a page you sent back) for review.
create or replace function public.submit_my_page(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.pages set status = 'pending', updated_at = now() where id = p_id and owner_id = auth.uid() and status in ('draft', 'rejected');
  if not found then raise exception 'Nothing to send.'; end if;
end; $$;
revoke all on function public.submit_my_page(uuid) from public, anon;
grant execute on function public.submit_my_page(uuid) to authenticated;

-- ---------- Requests for a project page ----------
create table if not exists public.page_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  handle text not null check (handle ~ '^[A-Za-z0-9_]{1,15}$'),
  name text not null check (length(name) between 1 and 80),
  website text check (website ~ '^https://[^\s]{3,}$' and length(website) <= 300),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  note text check (length(note) <= 1000),
  status text not null default 'open' check (status in ('open', 'done', 'declined')),
  admin_note text,
  created_at timestamptz not null default now()
);
alter table public.page_requests enable row level security;
drop policy if exists "own page requests read" on public.page_requests;
create policy "own page requests read" on public.page_requests for select using (auth.uid() = user_id or public.is_admin());

create or replace function public.request_page(p_handle text, p_name text, p_website text, p_email text, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; h text := ltrim(btrim(coalesce(p_handle, '')), '@');
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if h !~ '^[A-Za-z0-9_]{1,15}$' then raise exception 'Use the project''s X handle (letters, numbers and _).'; end if;
  if public.page_reserved(h) then raise exception 'That name is reserved.'; end if;
  if (select count(*) from public.page_requests where user_id = auth.uid() and status = 'open') >= 3 then raise exception 'You already have 3 requests waiting. We will get to them soon.'; end if;
  insert into public.page_requests (user_id, handle, name, website, email, note)
  values (auth.uid(), h, left(btrim(p_name), 80), nullif(btrim(coalesce(p_website, '')), ''), nullif(btrim(coalesce(p_email, '')), ''), left(nullif(btrim(coalesce(p_note, '')), ''), 1000))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.request_page(text, text, text, text, text) from public, anon;
grant execute on function public.request_page(text, text, text, text, text) to authenticated;

-- ---------- Reports ----------
create table if not exists public.page_reports (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  reason text not null check (length(reason) between 3 and 80),
  details text check (length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'done')),
  admin_note text,
  created_at timestamptz not null default now()
);
alter table public.page_reports enable row level security;
drop policy if exists "admins read page reports" on public.page_reports;
create policy "admins read page reports" on public.page_reports for select using (public.is_admin());

create or replace function public.report_page(p_handle text, p_reason text, p_details text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_page uuid;
begin
  select id into v_page from public.pages where lower(handle) = lower(p_handle) and status = 'published';
  if v_page is null then raise exception 'Unknown page.'; end if;
  if (select count(*) from public.page_reports where created_at > now() - interval '1 hour') >= 60
     or (auth.uid() is not null and (select count(*) from public.page_reports where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10) then
    raise exception 'Too many reports right now. Please use the Contact page.';
  end if;
  insert into public.page_reports (page_id, user_id, reason, details) values (v_page, auth.uid(), left(btrim(p_reason), 80), left(nullif(btrim(coalesce(p_details, '')), ''), 1000));
end; $$;
grant execute on function public.report_page(text, text, text) to anon, authenticated;

-- ---------- Admin ----------
-- Make or edit a page. New pages without an owner are for projects only,
-- from public information, and are published straight away (as "Not claimed yet").
create or replace function public.admin_save_page(p_id uuid, p_handle text, p_type text, p_name text, p_bio text, p_avatar text, p_banner text,
  p_website text, p_socials jsonb, p_toys text[], p_courses text[], p_color text, p_request uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; h text := ltrim(btrim(coalesce(p_handle, '')), '@');
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if length(coalesce(p_bio, '')) > 280 then raise exception 'The bio can be up to 280 characters.'; end if;
  if v_id is null then
    if p_type <> 'project' then raise exception 'You can only make pages for projects. Creators and personalities make their own.'; end if;
    if h !~ '^[A-Za-z0-9_]{1,15}$' then raise exception 'Use the project''s X handle.'; end if;
    if public.page_reserved(h) then raise exception 'That name is reserved.'; end if;
    insert into public.pages (handle, type, status, name, bio, avatar_path, banner_path, website, socials, featured_toys, featured_courses, color, created_by, published_at)
    values (h, 'project', 'published', left(btrim(p_name), 80), nullif(btrim(coalesce(p_bio, '')), ''), nullif(p_avatar, ''), nullif(p_banner, ''),
      nullif(btrim(coalesce(p_website, '')), ''), public.page_clean_socials(p_socials), coalesce(p_toys, '{}'), coalesce(p_courses, '{}'),
      coalesce(nullif(p_color, ''), '#FFD93D'), auth.uid(), now())
    returning id into v_id;
    if p_request is not null then update public.page_requests set status = 'done' where id = p_request; end if;
  else
    update public.pages set name = left(btrim(p_name), 80), bio = nullif(btrim(coalesce(p_bio, '')), ''), avatar_path = nullif(p_avatar, ''), banner_path = nullif(p_banner, ''),
      website = nullif(btrim(coalesce(p_website, '')), ''), socials = public.page_clean_socials(p_socials), featured_toys = coalesce(p_toys, '{}'),
      featured_courses = coalesce(p_courses, '{}'), color = coalesce(nullif(p_color, ''), '#FFD93D'), updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end; $$;
grant execute on function public.admin_save_page(uuid, text, text, text, text, text, text, text, jsonb, text[], text[], text, uuid) to authenticated;

-- approve, reject, clear_flags, suspend, unsuspend, unclaim, transfer (p_target:
-- the X handle of the new owner, who must have logged in with X), delete.
create or replace function public.admin_page_action(p_id uuid, p_action text, p_note text default null, p_target text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pg public.pages;
  v_user uuid; v_x text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into pg from public.pages where id = p_id for update;
  if not found then raise exception 'Unknown page.'; end if;
  if p_action = 'approve' then
    update public.pages set status = 'published', published_at = coalesce(published_at, now()), flags = '{}', admin_note = coalesce(p_note, admin_note), updated_at = now() where id = p_id;
  elsif p_action = 'reject' then
    update public.pages set status = 'rejected', admin_note = p_note, updated_at = now() where id = p_id;
  elsif p_action = 'clear_flags' then
    update public.pages set flags = '{}', updated_at = now() where id = p_id;
  elsif p_action = 'suspend' then
    update public.pages set status = 'suspended', admin_note = coalesce(p_note, admin_note), updated_at = now() where id = p_id;
  elsif p_action = 'unsuspend' then
    update public.pages set status = case when published_at is null then 'pending' else 'published' end, updated_at = now() where id = p_id;
  elsif p_action = 'unclaim' then
    update public.pages set owner_id = null, x_id = null, claimed_at = null, updated_at = now() where id = p_id;
  elsif p_action = 'transfer' then
    select i.user_id, i.provider_id into v_user, v_x from auth.identities i
    where i.provider in ('x', 'twitter') and lower(coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username', i.identity_data ->> 'screen_name')) = lower(ltrim(coalesce(p_target, ''), '@'))
    limit 1;
    if v_user is null then raise exception 'Nobody has logged in to web3.toys with @% yet. Ask them to log in with X once, then try again.', ltrim(coalesce(p_target, ''), '@'); end if;
    update public.pages set owner_id = v_user, x_id = v_x, claimed_at = now(), admin_note = coalesce(p_note, admin_note), updated_at = now() where id = p_id;
  elsif p_action = 'delete' then
    delete from public.pages where id = p_id;
  else
    raise exception 'Unknown action';
  end if;
end; $$;
grant execute on function public.admin_page_action(uuid, text, text, text) to authenticated;

create or replace function public.admin_page_request(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.page_requests set status = p_status, admin_note = coalesce(p_note, admin_note) where id = p_id;
end; $$;
grant execute on function public.admin_page_request(uuid, text, text) to authenticated;

create or replace function public.admin_page_report(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.page_reports set status = 'done', admin_note = coalesce(p_note, admin_note) where id = p_id;
end; $$;
grant execute on function public.admin_page_report(uuid, text) to authenticated;

-- Pages with their owner's display name, for the admin Pages tab.
create or replace function public.admin_pages()
returns table (id uuid, handle text, type text, status text, name text, owner_name text, claimed boolean, flags text[], admin_note text,
  created_at timestamptz, published_at timestamptz, open_reports bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select p.id, p.handle, p.type, p.status, p.name, pr.display_name, p.owner_id is not null, p.flags, p.admin_note, p.created_at, p.published_at,
    (select count(*) from public.page_reports r where r.page_id = p.id and r.status = 'open')
  from public.pages p left join public.profiles pr on pr.id = p.owner_id order by p.created_at desc;
end; $$;
grant execute on function public.admin_pages() to authenticated;

-- ---------- Pictures: public, each owner uploads into their own folder ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('page-images', 'page-images', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];
drop policy if exists "owners upload page images" on storage.objects;
create policy "owners upload page images" on storage.objects for insert to authenticated
  with check (bucket_id = 'page-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- Operations home queues and the audit log ----------
create or replace function public.ops_extra()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_array(
    (select jsonb_build_object('id', 'pagereq', 'count', count(*), 'oldest', min(created_at)) from public.page_requests where status = 'open'),
    (select jsonb_build_object('id', 'pageapprove', 'count', count(*), 'oldest', min(updated_at)) from public.pages where status = 'pending'),
    (select jsonb_build_object('id', 'pagereports', 'count', count(*), 'oldest', min(created_at)) from public.page_reports where status = 'open'))
$$;
revoke all on function public.ops_extra() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['pages', 'page_requests', 'page_reports'] loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t);
  end loop;
end $$;
