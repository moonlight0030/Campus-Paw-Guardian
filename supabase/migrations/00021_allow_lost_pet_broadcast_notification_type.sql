ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_type_check,
  ADD CONSTRAINT notifications_type_check
    CHECK (type = ANY (ARRAY['comment', 'favorite', 'adoption', 'pet_review', 'lost_pet_broadcast']));