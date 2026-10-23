-- ============ sightings 目击打卡记录表 ============
CREATE TABLE IF NOT EXISTS public.sightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  location_name text NOT NULL,
  sighted_at timestamptz NOT NULL DEFAULT now(),
  reporter_name text,
  remark text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sightings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sightings_pet_sighted ON public.sightings (pet_id, sighted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sightings_sighted_at ON public.sightings (sighted_at DESC);

-- RLS 策略：所有人可查看目击记录
CREATE POLICY "Anyone can view sightings" ON public.sightings
  FOR SELECT TO anon, authenticated USING (true);

-- 所有人（包括匿名游客和登录用户）均可上报目击打卡
CREATE POLICY "Anyone can insert sightings" ON public.sightings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 登录用户可管理自己上报的记录，管理员可全权限
CREATE POLICY "Users can update own sightings" ON public.sightings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sightings" ON public.sightings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
