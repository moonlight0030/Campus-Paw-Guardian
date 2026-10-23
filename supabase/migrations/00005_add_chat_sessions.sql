-- 会话表
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null default '新对话',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.chat_sessions enable row level security;

-- 消息表
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;

create index idx_chat_sessions_user on public.chat_sessions(user_id, updated_at desc);
create index idx_chat_messages_session on public.chat_messages(session_id, created_at asc);

-- RLS: chat_sessions —— 仅本人可读写
create policy "chat_sessions_select_own" on public.chat_sessions for select to authenticated using (user_id = auth.uid());
create policy "chat_sessions_insert_own" on public.chat_sessions for insert to authenticated with check (user_id = auth.uid());
create policy "chat_sessions_update_own" on public.chat_sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "chat_sessions_delete_own" on public.chat_sessions for delete to authenticated using (user_id = auth.uid());

-- RLS: chat_messages —— 仅本人可读写（按 user_id 判断，避免 self-loop）
create policy "chat_messages_select_own" on public.chat_messages for select to authenticated using (user_id = auth.uid());
create policy "chat_messages_insert_own" on public.chat_messages for insert to authenticated with check (user_id = auth.uid());
create policy "chat_messages_update_own" on public.chat_messages for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "chat_messages_delete_own" on public.chat_messages for delete to authenticated using (user_id = auth.uid());

-- Storage bucket：对话图片
insert into storage.buckets (id, name, public) values ('chat-images', 'chat-images', true);

create policy "chat_images_read" on storage.objects for select to public using (bucket_id = 'chat-images');
create policy "chat_images_insert" on storage.objects for insert to authenticated with check (bucket_id = 'chat-images');
create policy "chat_images_update" on storage.objects for update to authenticated using (bucket_id = 'chat-images') with check (bucket_id = 'chat-images');
create policy "chat_images_delete" on storage.objects for delete to authenticated using (bucket_id = 'chat-images');