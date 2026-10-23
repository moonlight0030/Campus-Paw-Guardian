-- ============ 领养申请表 ============
CREATE TABLE public.adoptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  applicant_name text NOT NULL,
  contact text NOT NULL,
  housing text NOT NULL CHECK (housing IN ('campus_dorm', 'off_campus_rent', 'own_home')),
  experience text NOT NULL CHECK (experience IN ('experienced', 'some', 'none')),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.adoptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_adoptions_pet ON public.adoptions (pet_id, created_at DESC);
CREATE INDEX idx_adoptions_user ON public.adoptions (user_id, created_at DESC);

-- 登录用户可查看：自己提交的申请 + 自己发布的萌宠收到的申请
CREATE POLICY "Users can view related adoptions" ON public.adoptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.pets p WHERE p.id = adoptions.pet_id AND p.author_id = auth.uid()
  ));

-- 登录用户可提交申请（user_id 由默认值自动填充）
CREATE POLICY "Authenticated users can apply adoption" ON public.adoptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 萌宠发布者可更新申请状态（审核）
CREATE POLICY "Pet authors can update adoptions" ON public.adoptions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pets p WHERE p.id = adoptions.pet_id AND p.author_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pets p WHERE p.id = adoptions.pet_id AND p.author_id = auth.uid()
  ));

-- 申请者可撤回自己的申请
CREATE POLICY "Users can delete own adoptions" ON public.adoptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ 通知类型扩展：adoption ============
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('comment','favorite','adoption'));

-- ============ 领养申请通知触发器 ============
CREATE FUNCTION public.notify_on_adoption()
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
    VALUES (v_author, 'adoption', NEW.user_id, NEW.pet_id, v_name, '申请领养你发布的萌宠');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_adoption
  AFTER INSERT ON public.adoptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_adoption();