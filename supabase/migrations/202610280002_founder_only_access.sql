-- Founder-only authorization for all archive mutations.
-- Public SELECT policies remain unchanged; admin_users is still visible only to its own user row.

alter table public.admin_users
  add column if not exists role text not null default 'editor';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_users'::regclass
      and conname = 'admin_users_role_check'
  ) then
    alter table public.admin_users
      add constraint admin_users_role_check check (role in ('founder', 'editor'));
  end if;
end $$;

create unique index if not exists admin_users_one_founder_idx
  on public.admin_users (role) where role = 'founder';

revoke insert, update, delete, truncate, references, trigger
  on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'tiers','tournaments','debatters','participations',
    'characters','matches','match_characters','titles'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'admins_manage_' || tbl, tbl);
    execute format('drop policy if exists %I on public.%I', 'founder_manage_' || tbl, tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated ' ||
      'using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()) and a.role = ''founder'')) ' ||
      'with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()) and a.role = ''founder''))',
      'founder_manage_' || tbl, tbl
    );
  end loop;
end $$;

drop policy if exists admins_read_audit_logs on public.audit_logs;
drop policy if exists admins_insert_audit_logs on public.audit_logs;
drop policy if exists founders_read_audit_logs on public.audit_logs;
drop policy if exists founders_insert_audit_logs on public.audit_logs;

create policy founders_read_audit_logs on public.audit_logs
for select to authenticated
using (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid()) and a.role = 'founder'
));

create policy founders_insert_audit_logs on public.audit_logs
for insert to authenticated
with check (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid()) and a.role = 'founder'
));

drop policy if exists dbx_assets_admin_insert on storage.objects;
drop policy if exists dbx_assets_admin_update on storage.objects;
drop policy if exists dbx_assets_admin_delete on storage.objects;
drop policy if exists dbx_assets_founder_insert on storage.objects;
drop policy if exists dbx_assets_founder_update on storage.objects;
drop policy if exists dbx_assets_founder_delete on storage.objects;

create policy dbx_assets_founder_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'dbx-assets'
  and exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()) and a.role = 'founder')
);

create policy dbx_assets_founder_update on storage.objects
for update to authenticated
using (
  bucket_id = 'dbx-assets'
  and exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()) and a.role = 'founder')
)
with check (
  bucket_id = 'dbx-assets'
  and exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()) and a.role = 'founder')
);

create policy dbx_assets_founder_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'dbx-assets'
  and exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()) and a.role = 'founder')
);
