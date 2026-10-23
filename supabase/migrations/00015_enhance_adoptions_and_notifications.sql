-- 1. 为 adoptions 表增加审核附言、审核时间、审核人字段
ALTER TABLE adoptions 
ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES profiles(id) DEFAULT NULL;

-- 2. 完善 notifications 表的 RLS 策略，允许已登录用户创建通知（例如管理员给普通用户发审核通知，或用户操作触发系统通知）
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications"
ON notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. 创建便捷的发通知存储过程 (SECURITY DEFINER)，防止任何由于权限或外键引起的通知发送失败
CREATE OR REPLACE FUNCTION send_app_notification(
  p_recipient_id UUID,
  p_type TEXT,
  p_actor_id UUID,
  p_pet_id UUID,
  p_pet_name TEXT,
  p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_id UUID;
BEGIN
  INSERT INTO notifications (
    recipient_id,
    type,
    actor_id,
    pet_id,
    pet_name,
    message,
    is_read,
    created_at
  ) VALUES (
    p_recipient_id,
    p_type,
    COALESCE(p_actor_id, p_recipient_id),
    COALESCE(p_pet_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(p_pet_name, '校园萌宠'),
    p_message,
    false,
    NOW()
  )
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$;
