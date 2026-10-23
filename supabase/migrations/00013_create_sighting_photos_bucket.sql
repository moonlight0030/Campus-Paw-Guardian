-- 创建目击照片存储桶（公开读）
INSERT INTO storage.buckets (id, name, public)
VALUES ('sighting-photos', 'sighting-photos', true);

-- 允许所有人读取目击照片
CREATE POLICY "sighting_photos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sighting-photos');

-- 允许已登录用户上传目击照片
CREATE POLICY "sighting_photos_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sighting-photos');