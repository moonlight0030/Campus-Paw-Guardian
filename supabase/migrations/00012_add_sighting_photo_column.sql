-- 为目击记录增加现场照片字段
ALTER TABLE public.sightings ADD COLUMN photo_url text;

-- 同步触发器：保证 photo_url 字段在插入/更新时可用（无需额外同步，仅占位说明）
-- 视图层直接读取 photo_url 即可