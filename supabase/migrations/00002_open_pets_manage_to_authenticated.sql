-- 萌宠管理：允许登录用户修改/删除任意档案（社区共同维护模式）
DROP POLICY IF EXISTS "Authors can update their pets" ON public.pets;
CREATE POLICY "Authenticated users can update pets" ON public.pets
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authors can delete their pets" ON public.pets;
CREATE POLICY "Authenticated users can delete pets" ON public.pets
  FOR DELETE USING (auth.role() = 'authenticated');