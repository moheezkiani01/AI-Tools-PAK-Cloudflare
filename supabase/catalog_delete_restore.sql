-- Run ONCE in Supabase SQL Editor AFTER backing up your database.
-- No new tables or columns. The current status field also stores an item's
-- pre-delete status, so restore brings back its exact earlier visibility.
-- This does not delete any products, orders, reviews, or source records.
BEGIN;
ALTER TABLE public.ai_tools_catalog
  DROP CONSTRAINT IF EXISTS ai_tools_catalog_status_check;
ALTER TABLE public.ai_tools_catalog
  ADD CONSTRAINT ai_tools_catalog_status_check
  CHECK (status IN (
    'pending','published','hidden','rejected',
    'deleted-pending','deleted-published','deleted-hidden','deleted-rejected'
  ));
COMMIT;
