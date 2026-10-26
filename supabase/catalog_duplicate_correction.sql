-- OPTIONAL ONE-TIME DATA CORRECTION FOR THE EARLIER VIP/VIP+ COLLISION.
-- Back up Supabase first. Running this affects the LIVE catalogue immediately.
-- No orders, reviews, manually overridden prices, or unrelated records are changed.
-- Safe to repeat: only acts if the mistaken supplier ID is still on the VIP row.
BEGIN;
UPDATE public.ai_tools_catalog
SET source_ids = source_ids - '6aacd7575271203cb12cc28c',
    cost_cents = 96,
    price_pkr = (
      SELECT round((96::numeric / 100) * 1.25 * usd_to_pkr)::bigint
      FROM public.ai_tools_catalog_settings WHERE id=1
    ),
    updated_at = now()
WHERE slug = 'import-meitu-vip-7-days-full-warranty-ad3dfd80cac5'
  AND cost_cents = 97
  AND source_ids ? '6aacd7575271203cb12cc28c';
COMMIT;
-- NEXT: run 'node scripts/import-catalog.mjs --commit' on your machine
-- to attach the supplier ID to its correct VIP+ variant.
