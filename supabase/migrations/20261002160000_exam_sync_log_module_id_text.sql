-- TTDT module ids are text ("m07", "mod1773…"); the theory sync log stored them as uuid, so every server sync since
-- 2026-09-29 delivered the grade and then failed to write its log row. practical_sync_log was changed the same way
-- in May 2026.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.exam_sync_log ALTER COLUMN module_id TYPE text USING module_id::text;
COMMIT;
