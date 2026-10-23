DO $$
DECLARE
  p1 uuid;
  p2 uuid;
  p3 uuid;
  p4 uuid;
  p5 uuid;
BEGIN
  SELECT id INTO p1 FROM public.pets WHERE name = '小橘' LIMIT 1;
  SELECT id INTO p2 FROM public.pets WHERE name = '花花' LIMIT 1;
  SELECT id INTO p3 FROM public.pets WHERE name = '黑妞' LIMIT 1;
  SELECT id INTO p4 FROM public.pets WHERE name = '雪球' LIMIT 1;
  SELECT id INTO p5 FROM public.pets WHERE name = '奶牛' LIMIT 1;

  -- 如果没找到特定名字就取前5个
  IF p1 IS NULL THEN
    SELECT id INTO p1 FROM public.pets ORDER BY created_at ASC LIMIT 1 OFFSET 0;
  END IF;
  IF p2 IS NULL THEN
    SELECT id INTO p2 FROM public.pets ORDER BY created_at ASC LIMIT 1 OFFSET 1;
  END IF;
  IF p3 IS NULL THEN
    SELECT id INTO p3 FROM public.pets ORDER BY created_at ASC LIMIT 1 OFFSET 2;
  END IF;
  IF p4 IS NULL THEN
    SELECT id INTO p4 FROM public.pets ORDER BY created_at ASC LIMIT 1 OFFSET 3;
  END IF;
  IF p5 IS NULL THEN
    SELECT id INTO p5 FROM public.pets ORDER BY created_at ASC LIMIT 1 OFFSET 4;
  END IF;

  -- 操场边：高频热点 (6次目击)
  IF p1 IS NOT NULL THEN
    INSERT INTO public.sightings (pet_id, location, sighted_at, recorder_name, notes)
    VALUES
      (p1, '操场边', now() - interval '2 hours', '小李同学', '在操场跑道边散步，毛茸茸的好可爱'),
      (p1, '操场边', now() - interval '1 day', '晨跑学长', '坐在看台阴凉处看大家跑步'),
      (p1, '图书馆后花园', now() - interval '3 days', '小王同学', '在长椅下打盹'),
      (p1, '教学楼前', now() - interval '5 days', '自习同学', '在台阶上求摸摸'),
      (p1, '宿舍楼下', now() - interval '8 days', '宿管阿姨', '在花坛边晒太阳'),
      (p1, '食堂旁草丛', now() - interval '15 days', '干饭人', '在等香肠吃');
  END IF;

  -- 食堂旁草丛：高频热点 (4次目击)
  IF p2 IS NOT NULL THEN
    INSERT INTO public.sightings (pet_id, location, sighted_at, recorder_name, notes)
    VALUES
      (p2, '食堂旁草丛', now() - interval '3 hours', '吃货同学', '正在吃好心人投喂的罐头'),
      (p2, '食堂旁草丛', now() - interval '2 days', '学妹小张', '和小伙伴一起蹲在树荫下'),
      (p2, '教学楼前', now() - interval '4 days', '上课路过', '在二教大厅门口乘凉'),
      (p2, '操场边', now() - interval '12 days', '晚自习同学', '在草坪里抓蝴蝶');
  END IF;

  -- 图书馆后花园：次高频 (3次目击)
  IF p3 IS NOT NULL THEN
    INSERT INTO public.sightings (pet_id, location, sighted_at, recorder_name, notes)
    VALUES
      (p3, '图书馆后花园', now() - interval '5 hours', '考研战士', '在灌木丛里睡大觉'),
      (p3, '图书馆后花园', now() - interval '1 day', '图书馆常客', '被阳光晒得翻肚皮'),
      (p3, '宿舍楼下', now() - interval '6 days', '3栋舍友', '在电动车旁边乘凉');
  END IF;

  -- 教学楼前 (3次目击)
  IF p4 IS NOT NULL THEN
    INSERT INTO public.sightings (pet_id, location, sighted_at, recorder_name, notes)
    VALUES
      (p4, '教学楼前', now() - interval '6 hours', '大一萌新', '在一教雕塑旁边'),
      (p4, '教学楼前', now() - interval '18 days', '课代表', '在自行车棚蹭车轮');
  END IF;

  -- 宿舍楼下 (2次目击)
  IF p5 IS NOT NULL THEN
    INSERT INTO public.sightings (pet_id, location, sighted_at, recorder_name, notes)
    VALUES
      (p5, '宿舍楼下', now() - interval '1 day', '外卖小哥', '蹲在门口看人来人往');
  END IF;

END $$;