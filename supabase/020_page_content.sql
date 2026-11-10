-- web3.toys: what each profile page shows (part B), and the consent table
-- that part C fills in. Paste into Supabase: SQL Editor, New query, Run.
-- Safe to run again. Needs 019_pages.sql first.
--
-- Project pages: players with the project's Pro badge (an Academy course
-- certificate, toy 'academy:<course>') and a leaderboard for its toys.
-- Creator pages: how many players joined with the creator's invite link.
-- Creator and personality pages: the owner's rank and certificates.
-- Names of players are shown ONLY when they said yes to that page
-- (page_consents); everyone else is just counted (or "A player" on the
-- leaderboard).
-- Owners (and you) see basic stats: views, plays and players.

-- ---------- Consent (part C adds the questions and the export) ----------
create table if not exists public.page_consents (
  user_id uuid not null references auth.users (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  source text not null check (source in ('pro', 'referral')),
  share_handle boolean not null default false,
  share_email boolean not null default false,
  agreed_at timestamptz,
  withdrawn_at timestamptz,
  asked_at timestamptz not null default now(),
  primary key (user_id, page_id)
);
alter table public.page_consents enable row level security;
drop policy if exists "own consents read" on public.page_consents;
create policy "own consents read" on public.page_consents for select using (auth.uid() = user_id or public.is_admin());

-- Yes, and not withdrawn.
create or replace function public.page_consented(p_user uuid, p_page uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.page_consents c where c.user_id = p_user and c.page_id = p_page and c.share_handle and c.agreed_at is not null and c.withdrawn_at is null)
$$;
revoke all on function public.page_consented(uuid, uuid) from public, anon, authenticated;

-- ---------- What a page shows ----------
create or replace function public.page_showcase(p_handle text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  pg public.pages;
  pro_toys text[];
  out jsonb := '{}';
begin
  select * into pg from public.pages where lower(handle) = lower(p_handle) and (status = 'published' or owner_id = auth.uid() or public.is_admin());
  if not found then return null; end if;

  if pg.type = 'project' then
    pro_toys := array(select 'academy:' || c from unnest(pg.featured_courses) c);
    out := out || jsonb_build_object(
      'pro_count', (select count(distinct user_id) from public.certificates where toy = any (pro_toys)),
      'pro_fans', coalesce((select jsonb_agg(x) from (
          select pr.display_name, pr.avatar_seed, pr.badge_frame, min(c.cert_date) as since
          from public.certificates c join public.profiles pr on pr.id = c.user_id
          where c.toy = any (pro_toys) and pr.display_name is not null and public.page_consented(c.user_id, pg.id)
          group by pr.id, pr.display_name, pr.avatar_seed, pr.badge_frame order by since limit 30) x), '[]'),
      'leaderboard', coalesce((select jsonb_agg(x) from (
          -- Ranked by everyone; named only when the player said yes to this page.
          select case when public.page_consented(pr.id, pg.id) then pr.display_name end as display_name,
            case when public.page_consented(pr.id, pg.id) then pr.avatar_seed end as avatar_seed,
            case when public.page_consented(pr.id, pg.id) then pr.badge_frame end as badge_frame,
            count(*)::int as certificates, round(avg(c.score))::int as score
          from public.certificates c join public.profiles pr on pr.id = c.user_id
          where c.toy = any (pg.featured_toys || pro_toys)
          group by pr.id, pr.display_name, pr.avatar_seed, pr.badge_frame
          order by certificates desc, score desc, min(c.saved_at) limit 10) x), '[]'));
  end if;

  if pg.type in ('creator', 'personality') and pg.owner_id is not null then
    out := out || jsonb_build_object(
      'certificates', coalesce((select jsonb_agg(jsonb_build_object('toy', c.toy, 'title', c.title, 'pro', c.toy like 'academy:%') order by c.cert_date)
        from public.certificates c where c.user_id = pg.owner_id), '[]'),
      'avatar_seed', (select avatar_seed from public.profiles where id = pg.owner_id));
  end if;

  if pg.type = 'creator' and pg.owner_id is not null then
    out := out || jsonb_build_object(
      'ref_code', (select referral_code from public.profiles where id = pg.owner_id),
      'joined', (select count(*) from public.referrals where referrer = pg.owner_id),
      'joined_fans', coalesce((select jsonb_agg(x) from (
          select pr.display_name, pr.avatar_seed, pr.badge_frame
          from public.referrals r join public.profiles pr on pr.id = r.referee
          where r.referrer = pg.owner_id and pr.display_name is not null and public.page_consented(r.referee, pg.id)
          order by r.created_at limit 30) x), '[]'));
  end if;
  return out;
end; $$;
grant execute on function public.page_showcase(text) to anon, authenticated;

-- Basic stats for the owner (and you): views and plays from the page, and
-- players (project: players with a certificate in its toys or courses;
-- creator: players who joined with the invite link). Last 30 days and all time.
create or replace function public.page_stats(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  pg public.pages;
  path1 text; path2 text; tag text;
  toys text[];
begin
  select * into pg from public.pages where id = p_id;
  if not found or not (coalesce(pg.owner_id = auth.uid(), false) or public.is_admin()) then raise exception 'Only the owner can see these stats.'; end if;
  path1 := '/@' || lower(pg.handle); path2 := path1 || '/'; tag := '%@' || lower(pg.handle);
  toys := pg.featured_toys || array(select 'academy:' || c from unnest(pg.featured_courses) c);
  return jsonb_build_object(
    'views', jsonb_build_array(
      (select count(*) from public.events where name = 'page_view' and lower(page) in (path1, path2) and created_at > now() - interval '30 days'),
      (select count(*) from public.events where name = 'page_view' and lower(page) in (path1, path2))),
    'plays', jsonb_build_array(
      (select count(*) from public.events where name = 'play' and lower(item) like tag and created_at > now() - interval '30 days'),
      (select count(*) from public.events where name = 'play' and lower(item) like tag)),
    'players', case
      when pg.type = 'creator' and pg.owner_id is not null then jsonb_build_array(
        (select count(*) from public.referrals where referrer = pg.owner_id and created_at > now() - interval '30 days'),
        (select count(*) from public.referrals where referrer = pg.owner_id))
      else jsonb_build_array(
        (select count(distinct user_id) from public.certificates where toy = any (toys) and saved_at > now() - interval '30 days'),
        (select count(distinct user_id) from public.certificates where toy = any (toys)))
      end);
end; $$;
revoke all on function public.page_stats(uuid) from public, anon;
grant execute on function public.page_stats(uuid) to authenticated;

-- A creator's invite code, made if missing (for the "Join with my link" button).
create or replace function public.my_page_ref_code()
returns text language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if auth.uid() is null then return null; end if;
  select code into c from public.my_referrals();
  return c;
end; $$;
revoke all on function public.my_page_ref_code() from public, anon;
grant execute on function public.my_page_ref_code() to authenticated;
