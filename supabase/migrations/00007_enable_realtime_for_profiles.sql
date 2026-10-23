-- 将 profiles 加入 supabase_realtime 发布，以支持前端实时监听用户注册
alter publication supabase_realtime add table public.profiles;