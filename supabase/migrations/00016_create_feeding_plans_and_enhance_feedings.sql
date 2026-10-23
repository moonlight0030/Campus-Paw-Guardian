-- 1. 扩展 feedings 表字段
ALTER TABLE public.feedings
ADD COLUMN IF NOT EXISTS amount_grams integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS food_type text DEFAULT 'dry_food',
ADD COLUMN IF NOT EXISTS photo_url text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS is_planned boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_forbidden boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS warning_notes text;

-- 2. 创建 feeding_plans 表
CREATE TABLE IF NOT EXISTS public.feeding_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_review', -- 'pending_review' 或 'confirmed'
  daily_amount_grams integer NOT NULL DEFAULT 60,
  feed_times_per_day integer NOT NULL DEFAULT 2,
  recommended_foods text[] NOT NULL DEFAULT ARRAY['优质全价宠粮', '主食罐头'],
  feeding_time_slots text[] NOT NULL DEFAULT ARRAY['早间 07:30 - 09:00', '傍晚 17:30 - 19:30'],
  forbidden_foods text[] NOT NULL DEFAULT ARRAY['巧克力', '洋葱与大蒜', '葡萄与葡萄干', '木糖醇制品', '尖锐骨头与生肉'],
  risk_notes text DEFAULT '',
  ai_suggestion_raw jsonb,
  confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uq_feeding_plans_pet UNIQUE (pet_id)
);

-- 3. 启用 RLS
ALTER TABLE public.feeding_plans ENABLE ROW LEVEL SECURITY;

-- 任何人可读投喂计划
CREATE POLICY "Public read feeding_plans"
ON public.feeding_plans FOR SELECT
USING (true);

-- 管理员或认证用户操作投喂计划（由后端或权限函数控制）
CREATE POLICY "Authenticated users upsert feeding_plans"
ON public.feeding_plans FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. 创建辅助函数：计算某动物今日已投喂量与次数
CREATE OR REPLACE FUNCTION public.get_pet_today_feeding_stats(p_pet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai');
  v_total_grams integer := 0;
  v_count integer := 0;
  v_overfed_count integer := 0;
  v_forbidden_count integer := 0;
BEGIN
  SELECT
    COALESCE(SUM(COALESCE(amount_grams, 50)), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'overfed' OR status = 'warning'),
    COUNT(*) FILTER (WHERE is_forbidden = true OR status = 'forbidden')
  INTO
    v_total_grams,
    v_count,
    v_overfed_count,
    v_forbidden_count
  FROM public.feedings
  WHERE pet_id = p_pet_id
    AND fed_at >= v_today_start;

  RETURN jsonb_build_object(
    'today_grams', v_total_grams,
    'today_count', v_count,
    'overfed_count', v_overfed_count,
    'forbidden_count', v_forbidden_count
  );
END;
$$;
