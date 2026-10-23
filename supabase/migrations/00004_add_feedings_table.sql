-- ============ 每日投喂打卡表 ============
CREATE TABLE public.feedings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  food text NOT NULL,
  fed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_feedings_pet ON public.feedings (pet_id, fed_at DESC);

-- 详情页公开展示，所有人可读
CREATE POLICY "Anyone can view feedings" ON public.feedings
  FOR SELECT TO anon, authenticated USING (true);
-- 登录用户可打卡（user_id 由默认值自动填充）
CREATE POLICY "Authenticated users can check in feeding" ON public.feedings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- 本人可删除自己的打卡记录
CREATE POLICY "Users can delete own feedings" ON public.feedings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);