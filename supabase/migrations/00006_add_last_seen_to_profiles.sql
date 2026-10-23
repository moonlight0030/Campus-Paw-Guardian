-- profiles 增加 last_seen_at 字段
alter table public.profiles add column last_seen_at timestamptz;

-- 重建 public_profiles 视图，包含 last_seen_at
create or replace view public.public_profiles as
  select id, nickname, avatar_url, role, last_seen_at from public.profiles;

-- SECURITY DEFINER 函数：更新当前登录用户的 last_seen_at
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid();
$$;

grant execute on function public.touch_last_seen() to authenticated;