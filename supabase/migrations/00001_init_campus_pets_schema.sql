-- ============ ENUM & profiles ============
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  phone text,
  role public.user_role NOT NULL DEFAULT 'user',
  nickname text NOT NULL DEFAULT '同学',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 新用户自动同步
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, role, nickname)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    'user'::public.user_role,
    COALESCE(NEW.raw_user_meta_data->>'nickname', '同学')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 角色查询辅助函数
CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;

-- profiles 策略
CREATE POLICY "Admins have full access to profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM public.get_user_role(auth.uid()));

CREATE VIEW public.public_profiles AS
  SELECT id, nickname, avatar_url, role FROM public.profiles;

-- ============ pets 萌宠档案 ============
CREATE TABLE public.pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species text NOT NULL CHECK (species IN ('cat','dog')),
  name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male','female')),
  coat_color text NOT NULL,
  personality_tags text[] NOT NULL DEFAULT '{}',
  location_name text NOT NULL,
  lat double precision,
  lng double precision,
  photo_url text NOT NULL,
  is_neutered boolean NOT NULL DEFAULT false,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pets_discovered ON public.pets (discovered_at DESC);
CREATE INDEX idx_pets_author ON public.pets (author_id);

-- pets 策略：所有人可看，登录用户可发布，作者可改删
CREATE POLICY "Anyone can view pets" ON public.pets
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated users can create pets" ON public.pets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their pets" ON public.pets
  FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete their pets" ON public.pets
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- ============ favorites 收藏 ============
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pet_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_favorites_user ON public.favorites (user_id);

CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add favorites" ON public.favorites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ comments 评论 ============
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_comments_pet ON public.comments (pet_id, created_at DESC);

CREATE POLICY "Anyone can view comments" ON public.comments
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated users can comment" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ notifications 消息通知 ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('comment','favorite')),
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  pet_name text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_recipient ON public.notifications (recipient_id, created_at DESC);

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = recipient_id);

-- ============ 通知触发器 ============
CREATE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_name text;
BEGIN
  SELECT author_id, name INTO v_author, v_name FROM public.pets WHERE id = NEW.pet_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, type, actor_id, pet_id, pet_name, message)
    VALUES (v_author, 'comment', NEW.user_id, NEW.pet_id, v_name, '评论了你发布的萌宠');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

CREATE FUNCTION public.notify_on_favorite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_name text;
BEGIN
  SELECT author_id, name INTO v_author, v_name FROM public.pets WHERE id = NEW.pet_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, type, actor_id, pet_id, pet_name, message)
    VALUES (v_author, 'favorite', NEW.user_id, NEW.pet_id, v_name, '收藏了你发布的萌宠');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_favorite
  AFTER INSERT ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_favorite();

-- ============ Storage Bucket ============
INSERT INTO storage.buckets (id, name, public) VALUES ('pet-photos', 'pet-photos', true);

CREATE POLICY "Public can view pet photos" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'pet-photos');
CREATE POLICY "Authenticated can upload pet photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pet-photos');
CREATE POLICY "Users can update own pet photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'pet-photos' AND owner = auth.uid());
CREATE POLICY "Users can delete own pet photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'pet-photos' AND owner = auth.uid());