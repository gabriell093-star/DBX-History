-- Allow both approved DBX Founders to have role='founder'.
drop index if exists public.admin_users_one_founder_idx;
