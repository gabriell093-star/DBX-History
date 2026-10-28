create table if not exists public.admin_usernames (
  user_id uuid primary key references public.admin_users(user_id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint admin_usernames_username_format
    check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$')
);

alter table public.admin_usernames enable row level security;
revoke all on table public.admin_usernames from anon, authenticated;
grant all on table public.admin_usernames to service_role;
