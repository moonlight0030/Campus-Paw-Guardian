DO $$
BEGIN
  -- 尝试添加 lost_pets -> profiles 外键
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'lost_pets_user_id_fkey' AND table_name = 'lost_pets'
  ) THEN
    ALTER TABLE public.lost_pets
      ADD CONSTRAINT lost_pets_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  -- 尝试添加 lost_pet_clues -> profiles 外键
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'lost_pet_clues_user_id_fkey' AND table_name = 'lost_pet_clues'
  ) THEN
    ALTER TABLE public.lost_pet_clues
      ADD CONSTRAINT lost_pet_clues_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;