DO $$
DECLARE
  first_pet_id uuid;
BEGIN
  SELECT id INTO first_pet_id FROM public.pets ORDER BY created_at ASC LIMIT 1;
  IF first_pet_id IS NOT NULL THEN
    INSERT INTO public.sightings (pet_id, location, sighted_at, recorder_name, notes)
    VALUES (
      first_pet_id,
      '图书馆后花园',
      now() - interval '20 minutes',
      '小林同学',
      '在草地上开心地伸懒腰，精神很好，看到有人走过还会喵喵叫～'
    );
  END IF;
END $$;