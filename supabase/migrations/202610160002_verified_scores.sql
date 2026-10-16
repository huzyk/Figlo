-- PUZLI competitive backend. Apply AFTER 202610160001_accounts.sql.
-- No new table can be written to by a browser. Only the Edge Function's
-- service role can begin, hint or finish a verified attempt.
begin;

create table public.puzli_puzzles (
  puzzle_id text primary key,
  puzzle_date date not null,
  game_id text not null check (game_id in ('korony','duet','bloki','latarnie','zip','sudoku')),
  difficulty text not null,
  target_seconds integer not null check (target_seconds between 30 and 3600),
  solution jsonb not null check (jsonb_typeof(solution) = 'array'),
  created_at timestamptz not null default now(),
  unique(puzzle_date,game_id)
);
create index puzli_puzzles_date_idx on public.puzli_puzzles(puzzle_date);
create table public.puzli_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id text not null references public.puzli_puzzles(puzzle_id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  hints_used integer not null default 0 check (hints_used between 0 and 999),
  unique(user_id,puzzle_id)
);
create index puzli_attempts_user_idx on public.puzli_attempts(user_id);
create table public.puzli_verified_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id text not null references public.puzli_puzzles(puzzle_id),
  game_id text not null,
  puzzle_date date not null,
  elapsed_ms bigint not null check (elapsed_ms between 3000 and 86400000),
  hints_used integer not null check (hints_used between 0 and 999),
  base_points integer not null check (base_points = 10),
  speed_points integer not null check (speed_points between 0 and 10),
  clean_points integer not null check (clean_points in (0,5)),
  points integer generated always as (base_points + speed_points + clean_points) stored,
  finished_at timestamptz not null default now(),
  primary key(user_id,puzzle_id),
  unique(user_id,game_id,puzzle_date)
);
create index puzli_result_period_idx on public.puzli_verified_results(puzzle_date,user_id);
create index puzli_result_percentile_idx on public.puzli_verified_results(puzzle_id,elapsed_ms);
create table public.puzli_set_bonuses (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_date date not null,
  points integer not null default 20 check (points = 20),
  primary key(user_id,puzzle_date)
);
create table public.puzli_leaderboard_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24
    and nickname ~ '^[[:alnum:]_ -]+$'),
  opted_in boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.puzli_puzzles enable row level security;
alter table public.puzli_attempts enable row level security;
alter table public.puzli_verified_results enable row level security;
alter table public.puzli_set_bonuses enable row level security;
alter table public.puzli_leaderboard_members enable row level security;
revoke all on public.puzli_puzzles,public.puzli_attempts,public.puzli_verified_results,
 public.puzli_set_bonuses,public.puzli_leaderboard_members from public,anon,authenticated;
grant select,insert,update,delete on public.puzli_puzzles,public.puzli_attempts,
 public.puzli_verified_results,public.puzli_set_bonuses,public.puzli_leaderboard_members to service_role;

-- Explicit opt-in. A private profile nickname is NEVER published automatically.
create function public.puzli_set_leaderboard(p_nickname text,p_opted_in boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.account_session_active() then
   raise exception 'Unauthorized';
 end if;
 if p_opted_in is null or p_nickname is null or char_length(p_nickname) not between 2 and 24
   or p_nickname !~ '^[[:alnum:]_ -]+$' then
   raise exception 'Invalid nickname';
 end if;
 insert into public.puzli_leaderboard_members(user_id,nickname,opted_in)
 values(auth.uid(),p_nickname,p_opted_in)
 on conflict(user_id) do update set nickname=excluded.nickname,
   opted_in=excluded.opted_in,updated_at=now();
end $$;
revoke all on function public.puzli_set_leaderboard(text,boolean) from public,anon;
grant execute on function public.puzli_set_leaderboard(text,boolean) to authenticated;

-- Read model: one authenticated player sees only their own verified rows.
create function public.puzli_my_results()
returns table(game_id text,puzzle_date date,points integer,elapsed_ms bigint,hints_used integer)
language sql stable security definer set search_path = '' as $$
 select r.game_id,r.puzzle_date,r.points,r.elapsed_ms,r.hints_used
 from public.puzli_verified_results r
 where r.user_id=auth.uid() and public.account_session_active()
 order by r.puzzle_date desc,r.game_id limit 500;
$$;
revoke all on function public.puzli_my_results() from public,anon;
grant execute on function public.puzli_my_results() to authenticated;

-- A single score ledger, grouped into four periods. Ranked players have opted in.
create function public.puzli_leaderboard(p_period text,p_anchor date,p_limit integer default 50)
returns table(place bigint,nickname text,points bigint)
language plpgsql stable security definer set search_path = '' as $$
declare start_date date; end_date date;
begin
 if p_period not in ('week','month','year','all') or p_anchor is null
   or p_anchor > (now() at time zone 'Europe/Warsaw')::date
   or p_limit not between 1 and 100 then raise exception 'Invalid leaderboard parameters'; end if;
 if p_period='week' then
   start_date := p_anchor-(extract(isodow from p_anchor)::integer-1);
   end_date := start_date+7;
 elsif p_period='month' then
   start_date := date_trunc('month',p_anchor::timestamp)::date;
   end_date := (start_date+interval '1 month')::date;
 elsif p_period='year' then
   start_date := date_trunc('year',p_anchor::timestamp)::date;
   end_date := (start_date+interval '1 year')::date;
 else
   start_date := '2026-01-01'::date;
   end_date := '9999-12-31'::date;
 end if;
 return query
 with scored as (
   select r.user_id,r.points as score from public.puzli_verified_results r
   where r.puzzle_date >= start_date and r.puzzle_date < end_date
   union all
   select b.user_id,b.points from public.puzli_set_bonuses b
   where b.puzzle_date >= start_date and b.puzzle_date < end_date
 ), totals as (
   select m.nickname,sum(s.score)::bigint total,m.user_id
   from scored s join public.puzli_leaderboard_members m on m.user_id=s.user_id
   where m.opted_in = true group by m.user_id,m.nickname
 )
 select dense_rank() over(order by t.total desc)::bigint,t.nickname,t.total
 from totals t order by t.total desc,t.user_id limit p_limit;
end $$;
revoke all on function public.puzli_leaderboard(text,date,integer) from public,anon;
grant execute on function public.puzli_leaderboard(text,date,integer) to authenticated;

-- Percentile only for a user's OWN solved board, with >=100 opted-in players.
-- No player IDs or per-person durations are exposed.
create function public.puzli_my_percentile(p_puzzle_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare own_ms bigint; sample_count integer; slower_count integer;
begin
 if auth.uid() is null or not public.account_session_active() then raise exception 'Unauthorized'; end if;
 select r.elapsed_ms into own_ms from public.puzli_verified_results r
 where r.user_id=auth.uid() and r.puzzle_id=p_puzzle_id;
 if own_ms is null then return null; end if;
 select count(*)::integer,count(*) filter (where r.elapsed_ms >= own_ms)::integer
 into sample_count,slower_count
 from public.puzli_verified_results r
 join public.puzli_leaderboard_members m on m.user_id=r.user_id and m.opted_in
 where r.puzzle_id=p_puzzle_id;
 if sample_count < 100 then return null; end if;
 return jsonb_build_object('better_than_percent',least(99,round(100.0 * slower_count / sample_count)), 'sample_size',sample_count);
end $$;
revoke all on function public.puzli_my_percentile(text) from public,anon;
grant execute on function public.puzli_my_percentile(text) to authenticated;

create function public.puzli_required_count(p_date date)
returns integer language sql immutable set search_path = '' as $$
 select case when p_date < date '2026-08-24' then 1
 when p_date < date '2026-08-25' then 2
 when p_date < date '2026-08-27' then 4
 when p_date < date '2026-10-14' then 5 else 6 end;
$$;
revoke all on function public.puzli_required_count(date) from public,anon,authenticated;
grant execute on function public.puzli_required_count(date) to service_role;

-- Service-only functions: the Edge Function validates JWT, ownership,
-- solution and Origin before invoking these privileged, atomic operations.
create function public.puzli_begin_attempt(p_user uuid,p_puzzle_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare rec public.puzli_attempts%rowtype;
begin
 if not exists (
   select 1 from public.puzli_puzzles p where p.puzzle_id=p_puzzle_id
     and p.puzzle_date=(now() at time zone 'Europe/Warsaw')::date
 ) then raise exception 'Puzzle is not available today'; end if;
 insert into public.puzli_attempts(user_id,puzzle_id) values(p_user,p_puzzle_id)
 on conflict(user_id,puzzle_id) do nothing;
 select * into rec from public.puzli_attempts a where a.user_id=p_user and a.puzzle_id=p_puzzle_id;
 return jsonb_build_object('attempt_id',rec.id,'started_at',rec.started_at,'finished',rec.finished_at is not null);
end $$;
revoke all on function public.puzli_begin_attempt(uuid,text) from public,anon,authenticated;
grant execute on function public.puzli_begin_attempt(uuid,text) to service_role;

create function public.puzli_add_hint(p_user uuid,p_attempt uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare result integer;
begin
 update public.puzli_attempts set hints_used=hints_used+1 where id=p_attempt
 and user_id=p_user and finished_at is null and hints_used < 999
 returning hints_used into result;
 if result is null then raise exception 'Attempt not active'; end if;
 return result;
end $$;
revoke all on function public.puzli_add_hint(uuid,uuid) from public,anon,authenticated;
grant execute on function public.puzli_add_hint(uuid,uuid) to service_role;

create function public.puzli_finish_attempt(p_user uuid,p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.puzli_attempts%rowtype; p public.puzli_puzzles%rowtype;
 ms bigint; speed integer; clean integer; complete_count integer; bonus integer := 0;
 existing_points integer;
begin
 select * into a from public.puzli_attempts x where x.id=p_attempt and x.user_id=p_user for update;
 if not found then raise exception 'Unknown attempt'; end if;
 if a.finished_at is not null then
   select r.points into existing_points from public.puzli_verified_results r where r.user_id=p_user and r.puzzle_id=a.puzzle_id;
   return jsonb_build_object('points',existing_points,'already_finished',true,'bonus',0);
 end if;
 select * into p from public.puzli_puzzles x where x.puzzle_id=a.puzzle_id;
 if not found then raise exception 'Unknown puzzle'; end if;
 -- Grace period for a game crossing midnight, but no offline score imports.
 if p.puzzle_date < (now() at time zone 'Europe/Warsaw')::date - 1
    or p.puzzle_date > (now() at time zone 'Europe/Warsaw')::date then
   raise exception 'Attempt expired';
 end if;
 ms := floor(extract(epoch from (clock_timestamp()-a.started_at))*1000)::bigint;
 if ms < 3000 or ms > 86400000 then raise exception 'Invalid attempt duration'; end if;
 speed := greatest(0,least(10,round(10 * (2 - ms::numeric/(p.target_seconds*1000))/1.5)::integer));
 clean := case when a.hints_used=0 then 5 else 0 end;
 insert into public.puzli_verified_results
 (user_id,puzzle_id,game_id,puzzle_date,elapsed_ms,hints_used,base_points,speed_points,clean_points)
 values(p_user,p.puzzle_id,p.game_id,p.puzzle_date,ms,a.hints_used,10,speed,clean)
 on conflict do nothing;
 update public.puzli_attempts set finished_at=clock_timestamp() where id=a.id;
 select count(*)::integer into complete_count from public.puzli_verified_results r
   where r.user_id=p_user and r.puzzle_date=p.puzzle_date;
 if complete_count=public.puzli_required_count(p.puzzle_date) then
   insert into public.puzli_set_bonuses(user_id,puzzle_date)
   values(p_user,p.puzzle_date) on conflict do nothing;
   if found then bonus := 20; end if;
 end if;
 return jsonb_build_object('points',10+speed+clean,'base',10,'speed',speed,
    'clean',clean,'bonus',bonus,'elapsed_ms',ms,'hints_used',a.hints_used,
    'already_finished',false);
end $$;
revoke all on function public.puzli_finish_attempt(uuid,uuid) from public,anon,authenticated;
grant execute on function public.puzli_finish_attempt(uuid,uuid) to service_role;

commit;
