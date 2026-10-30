-- DBX History: private setup template for the three approved Founder identities.
-- SECURITY: never commit actual Auth emails or usernames to the repository.
-- Before running, replace every REPLACE_WITH_* value in a PRIVATE copy opened in
-- Supabase SQL Editor. This script never creates Auth users or stores passwords.
-- Run only as a trusted project owner after all three Auth users are confirmed.

do $$
declare
  v_gabriel_email text := 'REPLACE_WITH_GABRIEL_AUTH_EMAIL';
  v_daffxy_email text := 'REPLACE_WITH_DAFFXY_AUTH_EMAIL';
  v_maru_email text := 'REPLACE_WITH_MARU_AUTH_EMAIL';
  v_gabriel_username text := 'REPLACE_WITH_GABRIEL_USERNAME';
  v_daffxy_username text := 'REPLACE_WITH_DAFFXY_USERNAME';
  v_maru_username text := 'REPLACE_WITH_MARU_USERNAME';
  v_gabriel_id uuid;
  v_daffxy_id uuid;
  v_maru_id uuid;
begin
  if v_gabriel_email like 'REPLACE_WITH_%'
     or v_daffxy_email like 'REPLACE_WITH_%'
     or v_maru_email like 'REPLACE_WITH_%'
     or v_gabriel_username like 'REPLACE_WITH_%'
     or v_daffxy_username like 'REPLACE_WITH_%'
     or v_maru_username like 'REPLACE_WITH_%' then
    raise exception 'Safe stop: replace all private Auth email and username placeholders in your private SQL copy.';
  end if;

  if v_gabriel_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$'
     or v_daffxy_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$'
     or v_maru_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$'
     or (select count(distinct u.username) from unnest(array[
       v_gabriel_username, v_daffxy_username, v_maru_username
     ]) as u(username)) <> 3 then
    raise exception 'Safe stop: usernames must be unique and match the allowed 3–32 character format.';
  end if;

  select id into v_gabriel_id from auth.users
  where lower(email) = lower(v_gabriel_email) and email_confirmed_at is not null limit 1;
  select id into v_daffxy_id from auth.users
  where lower(email) = lower(v_daffxy_email) and email_confirmed_at is not null limit 1;
  select id into v_maru_id from auth.users
  where lower(email) = lower(v_maru_email) and email_confirmed_at is not null limit 1;

  if v_gabriel_id is null or v_daffxy_id is null or v_maru_id is null then
    raise exception 'Safe stop: all three distinct Auth users must exist and be confirmed. No Founder membership was changed.';
  end if;

  if v_gabriel_id = v_daffxy_id or v_gabriel_id = v_maru_id or v_daffxy_id = v_maru_id then
    raise exception 'Safe stop: the three private Auth emails resolved to the same identity.';
  end if;

  if exists (
    select 1 from public.admin_usernames
    where username = any(array[v_gabriel_username, v_daffxy_username, v_maru_username])
      and user_id not in (v_gabriel_id, v_daffxy_id, v_maru_id)
  ) then
    raise exception 'Safe stop: a requested username is already mapped to another Auth user.';
  end if;

  insert into public.admin_users (user_id, role)
  values (v_gabriel_id, 'founder'), (v_daffxy_id, 'founder'), (v_maru_id, 'founder')
  on conflict (user_id) do update set role = excluded.role;

  insert into public.admin_usernames (user_id, username)
  values
    (v_gabriel_id, v_gabriel_username),
    (v_daffxy_id, v_daffxy_username),
    (v_maru_id, v_maru_username)
  on conflict (user_id) do update set username = excluded.username;
end $$;

select count(*) as configured_founder_accounts
from public.admin_users
where role = 'founder';
