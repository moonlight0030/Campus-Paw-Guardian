-- 1. 在 profiles 表新增寻宠广播订阅开关，默认开启
ALTER TABLE public.profiles
  ADD COLUMN lost_pet_broadcast boolean NOT NULL DEFAULT true;

-- 2. 触发器函数：当新的寻找中寻宠启事发布时，向所有开启订阅的用户发送站内通知
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
  -- 仅对寻找中的启事触发广播
  IF NEW.status <> 'searching' THEN
    RETURN NEW;
  END IF;

  -- 拼装通知文案
  v_message := '【寻宠广播】' || COALESCE(NEW.pet_name, '一只萌宠') || '疑似走失！走失地点：' ||
    COALESCE(NEW.lost_location, '校园某处') || '。快去看看能否提供线索吧～';

  -- 遍历所有开启订阅的用户（排除发布者本人）
  FOR v_subscriber IN
    SELECT id FROM public.profiles
    WHERE lost_pet_broadcast = true
      AND id <> NEW.user_id
  LOOP
    PERFORM public.send_app_notification(
      v_subscriber.id,
      'lost_pet_broadcast',
      NEW.user_id,
      NEW.pet_id,
      NEW.pet_name,
      v_message
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 3. 绑定触发器到 lost_pets 的 INSERT
CREATE TRIGGER trg_lost_pet_broadcast
  AFTER INSERT ON public.lost_pets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_lost_pet_broadcast();