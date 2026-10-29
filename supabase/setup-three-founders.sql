-- DBX History: map three trusted Supabase Auth users to Founder permissions.
-- First create and auto-confirm the users in Supabase Dashboard > Authentication > Users:
--   ellias8890@dbx-history.vercel.app
--   daffxy7778@dbx-history.vercel.app
--   maru7712@dbx-history.vercel.app
-- This file never creates Auth users or stores passwords. It only grants DBX Founder membership
-- after it finds all three confirmed Auth identities. Run in SQL Editor as a trusted project owner.

do $$
declare
  v_ellias uuid;
  v_daffxy uuid;
  v_maru uuid;
begin
  select id into v_ellias
  from auth.users
  where lower(email) = 'ellias8890@dbx-history.vercel.app'
    and email_confirmed_at is not null
  limit 1;

  select id into v_daffxy
  from auth.users
  where lower(email) = 'daffxy7778@dbx-history.vercel.app'
    and email_confirmed_at is not null
  limit 1;

  select id into v_maru
  from auth.users
  where lower(email) = 'maru7712@dbx-history.vercel.app'
    and email_confirmed_at is not null
  limit 1;

  if v_ellias is null or v_daffxy is null or v_maru is null then
    raise exception 'Safe stop: create and auto-confirm all three internal Auth users first. No Founder membership was changed.';
  end if;

  if v_ellias = v_daffxy or v_ellias = v_maru or v_daffxy = v_maru then
    raise exception 'Safe stop: internal Auth identities must belong to three different users.';
  end if;

  if exists (
    select 1 from public.admin_usernames
    where username in ('ellias8890', 'daffxy7778', 'maru7712')
      and user_id not in (v_ellias, v_daffxy, v_maru)
  ) then
    raise exception 'Safe stop: a requested username is already mapped to a different user. Resolve it before proceeding.';
  end if;

  insert into public.admin_users (user_id, role)
  values (v_ellias, 'founder'), (v_daffxy, 'founder'), (v_maru, 'founder')
  on conflict (user_id) do update set role = excluded.role;

  insert into public.admin_usernames (user_id, username)
  values (v_ellias, 'ellias8890'), (v_daffxy, 'daffxy7778'), (v_maru, 'maru7712')
  on conflict (user_id) do update set username = excluded.username;
end $$;

select u.username, a.role
from public.admin_usernames u
join public.admin_users a on a.user_id = u.user_id
where u.username in ('ellias8890', 'daffxy7778', 'maru7712')
order by u.username;
