DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sightings' AND column_name='location') THEN
    ALTER TABLE public.sightings ADD COLUMN location text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sightings' AND column_name='recorder_name') THEN
    ALTER TABLE public.sightings ADD COLUMN recorder_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sightings' AND column_name='notes') THEN
    ALTER TABLE public.sightings ADD COLUMN notes text;
  END IF;
END $$; CREATE OR REPLACE FUNCTION sync_sighting_columns() RETURNS trigger AS $$
BEGIN
  IF NEW.location IS NULL AND NEW.location_name IS NOT NULL THEN
    NEW.location := NEW.location_name;
  ELSIF NEW.location_name IS NULL AND NEW.location IS NOT NULL THEN
    NEW.location_name := NEW.location;
  END IF;

  IF NEW.recorder_name IS NULL AND NEW.reporter_name IS NOT NULL THEN
    NEW.recorder_name := NEW.reporter_name;
  ELSIF NEW.reporter_name IS NULL AND NEW.recorder_name IS NOT NULL THEN
    NEW.reporter_name := NEW.recorder_name;
  END IF;

  IF NEW.notes IS NULL AND NEW.remark IS NOT NULL THEN
    NEW.notes := NEW.remark;
  ELSIF NEW.remark IS NULL AND NEW.notes IS NOT NULL THEN
    NEW.remark := NEW.notes;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql; DROP TRIGGER IF EXISTS trg_sync_sighting_columns ON public.sightings; CREATE TRIGGER trg_sync_sighting_columns
  BEFORE INSERT OR UPDATE
  ON public.sightings
  FOR EACH ROW
  EXECUTE PROCEDURE sync_sighting_columns();