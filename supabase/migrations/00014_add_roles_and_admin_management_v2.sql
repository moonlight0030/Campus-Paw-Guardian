-- 1. 先将种子管理员账号设为 admin
UPDATE public.profiles
SET role = 'admin'::user_role
WHERE email = 'campus_friend@miaoda.com';

-- 2. 给 sightings 增加 status 字段（支持待确认目击）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sightings' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.sightings ADD COLUMN status text NOT NULL DEFAULT 'confirmed';
  END IF;
END $$;

-- 3. 给 pets 增加 status 字段（支持档案审核与归档）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pets' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.pets ADD COLUMN status text NOT NULL DEFAULT 'published';
  END IF;
END $$;

-- 4. 创建举报处理表 reports
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reporter_name text,
  target_type text NOT NULL, -- 'pet' | 'sighting' | 'comment' | 'feeding'
  target_id text NOT NULL,
  target_title text,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'resolved' | 'dismissed'
  handle_result text,
  handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- 5. 创建管理员操作日志表 admin_audit_logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL,
  operator_email text,
  operator_name text,
  action text NOT NULL,
  target_user_id uuid,
  target_user_email text,
  target_user_name text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. 创建安全检查函数 is_admin (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_role text;
BEGIN
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT role::text INTO u_role FROM public.profiles WHERE id = check_user_id;
  RETURN u_role = 'admin';
END;
$$;

-- 7. 给 admin_audit_logs 和 reports 增加管理员的 RLS 策略
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view all audit logs" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "System can insert audit logs" ON public.admin_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view and update all reports" ON public.reports;
CREATE POLICY "Admins can view and update all reports" ON public.reports
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 8. 增强 profiles 的 RLS 策略，确保普通用户不能直接提权为 admin
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 如果是在客户端请求中(auth.uid()存在)，且 role 发生变化
  IF auth.uid() IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    -- 如果当前操作者不是管理员，强行禁止修改 role
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION '权限不足：仅管理员可以调整角色字段';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_profile_role ON public.profiles;
CREATE TRIGGER trigger_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- 9. 编写安全 RPC 函数 change_user_role，供管理员在后台调用
CREATE OR REPLACE FUNCTION public.change_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_caller_email text;
  v_caller_name text;
  v_target_role text;
  v_target_email text;
  v_target_name text;
  v_admin_count integer;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION '未授权：请先登录';
  END IF;

  -- 校验操作者是否是管理员
  SELECT role::text, email, nickname INTO v_caller_role, v_caller_email, v_caller_name
  FROM public.profiles WHERE id = v_caller_id;

  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION '权限不足：仅管理员可调整用户角色';
  END IF;

  -- 不能修改自己
  IF v_caller_id = p_target_user_id THEN
    RAISE EXCEPTION '操作被拒绝：管理员不能调整自身角色';
  END IF;

  -- 校验目标角色合法性
  IF p_new_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION '无效的目标角色：%s', p_new_role;
  END IF;

  -- 获取目标用户信息
  SELECT role::text, email, nickname INTO v_target_role, v_target_email, v_target_name
  FROM public.profiles WHERE id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION '目标用户不存在';
  END IF;

  -- 若是降级为 user，必须检查是否是最后一个管理员
  IF v_target_role = 'admin' AND p_new_role = 'user' THEN
    SELECT count(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin'::user_role;
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION '操作被拒绝：系统必须保留至少一名管理员，无法降级';
    END IF;
  END IF;

  -- 执行角色更新
  UPDATE public.profiles
  SET role = p_new_role::user_role
  WHERE id = p_target_user_id;

  -- 写入管理员操作审计日志
  INSERT INTO public.admin_audit_logs (
    operator_id,
    operator_email,
    operator_name,
    action,
    target_user_id,
    target_user_email,
    target_user_name,
    details
  ) VALUES (
    v_caller_id,
    v_caller_email,
    v_caller_name,
    CASE WHEN p_new_role = 'admin' THEN 'grant_admin' ELSE 'revoke_admin' END,
    p_target_user_id,
    v_target_email,
    v_target_name,
    jsonb_build_object(
      'from_role', v_target_role,
      'to_role', p_new_role,
      'operated_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'new_role', p_new_role
  );
END;
$$;