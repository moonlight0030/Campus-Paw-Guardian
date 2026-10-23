-- notifications.pet_id 改为可空，以支持无关联萌宠的广播类通知
ALTER TABLE public.notifications
  ALTER COLUMN pet_id DROP NOT NULL;

-- 重写广播触发器函数：直接插入通知，pet_id 使用走失启事关联的萌宠（可能为空）
CREATE OR REPLACE FUNCTION public.notify_lost_pet_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subscriber RECORD;
  v_message TEXT;
BEGIN
  IF NEW.status <> 'searching' THEN
    RETURN NEW;
  END IF;

  v_message := '【寻宠广播】' || COALESCE(NEW.pet_name, '一只萌宠') || '疑似走失！走失地点：' ||
    COALESCE(NEW.lost_location, '校园某处') || '。快去看看能否提供线索吧～';

  FOR v_subscriber IN
    SELECT id FROM public.profiles
    WHERE lost_pet_broadcast = true
      AND id <> NEW.user_id
  LOOP
    INSERT INTO public.notifications (
      recipient_id, type, actor_id, pet_id, pet_name, message, is_read, created_at
    ) VALUES (
      v_subscriber.id,
      'lost_pet_broadcast',
      NEW.user_id,
      NEW.pet_id,
      COALESCE(NEW.pet_name, '校园萌宠'),
      v_message,
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$function$;