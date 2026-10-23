DO $$
DECLARE
  v_admin_id UUID := 'beb50507-d5f0-4698-b21b-57a7c88f2c63';
  v_pet_xiaoju UUID;
  v_lost_pet_1 UUID;
  v_lost_pet_2 UUID;
BEGIN
  -- 获取小橘的 ID
  SELECT id INTO v_pet_xiaoju FROM public.pets WHERE name LIKE '%橘%' LIMIT 1;

  -- 1. 插入第一条寻宠启事：正在寻找中
  INSERT INTO public.lost_pets (
    pet_id,
    user_id,
    title,
    pet_name,
    species,
    breed,
    gender,
    color,
    features,
    lost_date,
    lost_location,
    contact_name,
    contact_phone,
    reward_amount,
    description,
    photo_urls,
    status,
    views_count
  ) VALUES (
    v_pet_xiaoju,
    v_admin_id,
    '【紧急寻宠】图书馆后花园橘猫「小橘」昨日走失，盼师生提供线索！',
    '小橘',
    'cat',
    '中华田园橘猫',
    'male',
    '橘白相间',
    '左耳绝育剪耳标记，圆脸微胖，性格亲人粘人，脖子有蓝色防走失牌',
    NOW() - INTERVAL '1 day',
    '图书馆东侧花园与银杏林周边',
    '动协李同学',
    '13800138000',
    '爱心大杯奶茶与校动协专属徽章',
    '平时经常在图书馆长椅晒太阳，昨天傍晚被施工声惊吓后往西区跑去，至今未归。天气转凉，急盼知情同学提供目击线索打卡！',
    ARRAY['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80'],
    'searching',
    128
  ) RETURNING id INTO v_lost_pet_1;

  -- 2. 插入第一条启事的 2 条线索打卡
  INSERT INTO public.lost_pet_clues (
    lost_pet_id,
    user_id,
    sighting_time,
    sighting_location,
    description,
    photo_url,
    contact_info,
    status
  ) VALUES 
  (
    v_lost_pet_1,
    v_admin_id,
    NOW() - INTERVAL '6 hours',
    '第二教学楼北侧车棚',
    '中午下课看到一只橘白猫在车棚草丛里觅食，体型圆润，左耳确实有剪耳痕迹，叫了小橘它抬头回应了，之后跑向林荫道。',
    'https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=600&q=80',
    '张同学 13912345678',
    'normal'
  ),
  (
    v_lost_pet_1,
    v_admin_id,
    NOW() - INTERVAL '2 hours',
    '学一食堂后勤门口',
    '傍晚看到阿姨给它倒了一点温水，它喝了几口就躲进绿化带了，精神状态还不错，没有外伤。',
    NULL,
    '王同学',
    'normal'
  );

  -- 3. 插入第二条寻宠启事：已平安找回
  INSERT INTO public.lost_pets (
    pet_id,
    user_id,
    title,
    pet_name,
    species,
    breed,
    gender,
    color,
    features,
    lost_date,
    lost_location,
    contact_name,
    contact_phone,
    reward_amount,
    description,
    photo_urls,
    status,
    views_count
  ) VALUES (
    NULL,
    v_admin_id,
    '【已找回】物理实验楼附近走失的小黑柴「旺财」已安全归队！',
    '旺财',
    'dog',
    '柴犬',
    'male',
    '黑色',
    '胸前有白斑，两只立耳，摇尾巴很欢快',
    NOW() - INTERVAL '3 days',
    '物理实验楼南门草坪',
    '陈同学',
    '13700001111',
    '已当面谢过热心校友',
    '感谢全校师生的接力打卡，已在风雨操场附近由保卫处叔叔与热心同学协助找回！已妥善安顿。',
    ARRAY['https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=800&q=80'],
    'found',
    256
  ) RETURNING id INTO v_lost_pet_2;

END $$;