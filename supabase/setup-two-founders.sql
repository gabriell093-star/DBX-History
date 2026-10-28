-- Run this only after both intended Founder accounts have been created and email-confirmed
-- in Supabase Auth using these non-mailbox internal identities:
--   ellias8890@dbx-history.vercel.app
--   daffxy7778@dbx-history.vercel.app
--
-- It checks both users before changing any access. On success it makes these two the
-- ONLY admin membership rows and the ONLY founder usernames. It never writes passwords.

do $$
declare
  v_ellias uuid;
  v_daffxy uuid;
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

  if v_ellias is null or v_daffxy is null then
    raise exception 'Safe stop: create and auto-confirm BOTH internal Auth users first. No admin memberships were changed.';
  end if;

  if v_ellias = v_daffxy then
    raise exception 'Safe stop: both usernames unexpectedly point to the same Auth user. No memberships were changed.';
  end if;

  delete from public.admin_users;

  insert into public.admin_users (user_id, role)
  values (v_ellias, 'founder'), (v_daffxy, 'founder');

  insert into public.admin_usernames (user_id, username)
  values (v_ellias, 'ellias8890'), (v_daffxy, 'daffxy7778');
end $$;

select u.username, a.role
from public.admin_usernames u
join public.admin_users a on a.user_id = u.user_id
order by u.username;
