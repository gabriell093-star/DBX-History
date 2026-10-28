-- Run after applying all schema migrations and creating exactly one intended founder in Supabase Auth.
-- It safely refuses to continue if the project has zero or multiple Auth users.
do $$
declare
  v_user_count integer;
  v_user_id uuid;
  v_email text;
  v_username text := 'gabriel';
begin
  select count(*) into v_user_count from auth.users;
  if v_user_count <> 1 then
    raise exception 'Expected exactly one Auth user, found %. No administrator was assigned.', v_user_count;
  end if;

  select id, email into v_user_id, v_email from auth.users limit 1;
  if v_user_id is null or v_email is null then
    raise exception 'The existing Auth user has no email identity.';
  end if;

  insert into public.admin_users (user_id, role)
  values (v_user_id, 'founder')
  on conflict (user_id) do update set role = 'founder';

  insert into public.admin_usernames (user_id, username)
  values (v_user_id, v_username)
  on conflict (user_id) do update set username = excluded.username;
end $;

select username from public.admin_usernames;
