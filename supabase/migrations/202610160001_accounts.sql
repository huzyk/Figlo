begin;
-- Sessions are checked as well as JWTs: revoked tokens cannot read profiles
-- while waiting for their JWT expiry. This helper exposes no session details.
create or replace function public.account_session_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions s
    where s.id::text = (auth.jwt()->>'session_id')
      and s.user_id = auth.uid()
      and (s.not_after is null or s.not_after > now()));
$$;
revoke all on function public.account_session_active() from public, anon;
grant execute on function public.account_session_active() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24 and nickname ~ '^[[:alnum:]_ -]+$'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id,nickname), update (id,nickname) on public.profiles to authenticated;
create policy own_profile_read on public.profiles for select to authenticated
  using ((select auth.uid()) = id and (select public.account_session_active()));
create policy own_profile_insert on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id and (select public.account_session_active()));
create policy own_profile_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id and (select public.account_session_active()))
  with check ((select auth.uid()) = id and (select public.account_session_active()));

-- Only the server can read aggregate security signals. No IPs/emails/tokens leave the DB.
create or replace function public.security_counts()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('window_minutes', 10, 'events', count(*),
    'signups', count(*) filter (where payload->>'action' = 'user_signedup'),
    'identity_changes', count(*) filter (where payload->>'action' in
      ('identity_unlinked','factor_unenrolled','factor_deleted','user_updated_password')))
  from auth.audit_log_entries where created_at > now() - interval '10 minutes';
$$;
revoke all on function public.security_counts() from public, anon, authenticated;
grant execute on function public.security_counts() to service_role;
commit;
