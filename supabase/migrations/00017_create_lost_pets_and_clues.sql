-- 1. 创建寻宠启事表
CREATE TABLE IF NOT EXISTS public.lost_pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  pet_name VARCHAR(60) NOT NULL,
  species VARCHAR(20) NOT NULL DEFAULT 'cat' CHECK (species IN ('cat', 'dog', 'other')),
  breed VARCHAR(60),
  gender VARCHAR(20) DEFAULT 'unknown' CHECK (gender IN ('male', 'female', 'unknown')),
  color VARCHAR(60),
  features TEXT,
  lost_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  lost_location VARCHAR(120) NOT NULL,
  contact_name VARCHAR(60) NOT NULL,
  contact_phone VARCHAR(60) NOT NULL,
  reward_amount VARCHAR(60),
  description TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'searching' CHECK (status IN ('searching', 'found', 'closed')),
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. 创建寻宠线索打卡表
CREATE TABLE IF NOT EXISTS public.lost_pet_clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lost_pet_id UUID NOT NULL REFERENCES public.lost_pets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sighting_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sighting_location VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  contact_info VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'verified', 'hidden')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. 索引提升查询速度
CREATE INDEX IF NOT EXISTS idx_lost_pets_status ON public.lost_pets(status);
CREATE INDEX IF NOT EXISTS idx_lost_pets_created_at ON public.lost_pets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_pet_clues_lost_pet ON public.lost_pet_clues(lost_pet_id, created_at DESC);

-- 4. 开启 RLS
ALTER TABLE public.lost_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_pet_clues ENABLE ROW LEVEL SECURITY;

-- 5. RLS 策略
DROP POLICY IF EXISTS "Anyone can view lost pets" ON public.lost_pets;
CREATE POLICY "Anyone can view lost pets" ON public.lost_pets
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view lost pet clues" ON public.lost_pet_clues;
CREATE POLICY "Anyone can view lost pet clues" ON public.lost_pet_clues
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create lost pets" ON public.lost_pets;
CREATE POLICY "Authenticated users can create lost pets" ON public.lost_pets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authors and admins can update lost pets" ON public.lost_pets;
CREATE POLICY "Authors and admins can update lost pets" ON public.lost_pets
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Authenticated users can create clues" ON public.lost_pet_clues;
CREATE POLICY "Authenticated users can create clues" ON public.lost_pet_clues
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Clue authors and admins can update clues" ON public.lost_pet_clues;
CREATE POLICY "Clue authors and admins can update clues" ON public.lost_pet_clues
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );