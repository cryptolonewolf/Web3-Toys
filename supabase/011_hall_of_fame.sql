-- web3.toys: Who Built It? (Hall of Fame) numbers.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 001_accounts.sql first.
--
--   hof_answer(person, right): counts one answer, anonymously (no player is
--     stored). Gives "41% of players named them".
--   hof_vote(person): a logged-in player's favourite builder (one vote per
--     account; voting again moves it).
--   hof_numbers(): the public totals per person, for the game, the person
--     pages and your posts. Percentages show once 20 answers are in.

create table if not exists public.hof_stats (
  person_id text primary key check (person_id ~ '^[a-z0-9-]{2,40}$'),
  shown bigint not null default 0,
  right_answers bigint not null default 0
);
alter table public.hof_stats enable row level security;

create table if not exists public.hof_votes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  person_id text not null check (person_id ~ '^[a-z0-9-]{2,40}$'),
  voted_at timestamptz not null default now()
);
alter table public.hof_votes enable row level security;
drop policy if exists "own vote read" on public.hof_votes;
create policy "own vote read" on public.hof_votes for select using (auth.uid() = user_id);

create or replace function public.hof_answer(p_person text, p_right boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(p_person, '') !~ '^[a-z0-9-]{2,40}$' then return; end if;
  insert into public.hof_stats (person_id, shown, right_answers) values (p_person, 1, case when p_right then 1 else 0 end)
  on conflict (person_id) do update set shown = public.hof_stats.shown + 1,
    right_answers = public.hof_stats.right_answers + case when p_right then 1 else 0 end;
end; $$;
grant execute on function public.hof_answer(text, boolean) to anon, authenticated;

create or replace function public.hof_vote(p_person text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Log in to vote.'; end if;
  if coalesce(p_person, '') !~ '^[a-z0-9-]{2,40}$' then raise exception 'Unknown builder.'; end if;
  insert into public.hof_votes (user_id, person_id) values (auth.uid(), p_person)
  on conflict (user_id) do update set person_id = excluded.person_id, voted_at = now();
end; $$;
revoke all on function public.hof_vote(text) from public, anon;
grant execute on function public.hof_vote(text) to authenticated;

create or replace function public.hof_numbers()
returns table (person_id text, shown bigint, right_pct int, votes bigint)
language sql stable security definer set search_path = '' as $$
  select coalesce(s.person_id, v.person_id),
         coalesce(s.shown, 0),
         case when coalesce(s.shown, 0) >= 20 then round(100.0 * s.right_answers / s.shown)::int end,
         coalesce(v.votes, 0)
  from public.hof_stats s
  full join (select person_id, count(*) as votes from public.hof_votes group by person_id) v on v.person_id = s.person_id;
$$;
grant execute on function public.hof_numbers() to anon, authenticated;
