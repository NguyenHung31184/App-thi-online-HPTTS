-- Run after deploying /api/exam-maintenance and setting CRON_SECRET in Vercel.
-- In Supabase Vault, create exam_maintenance_url (the full HTTPS endpoint) and
-- exam_maintenance_secret (the same value as CRON_SECRET). No secrets belong in this file.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'exam_maintenance_url' AND decrypted_secret LIKE 'https://%/api/exam-maintenance')
    OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'exam_maintenance_secret' AND length(decrypted_secret) >= 32) THEN
    RAISE EXCEPTION 'Configure exam_maintenance_url and exam_maintenance_secret in Vault first';
  END IF;
END;
$$;
SELECT cron.schedule('exam-maintenance', '* * * * *', $job$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'exam_maintenance_url'),
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'exam_maintenance_secret')),
    timeout_milliseconds := 55000
  );
$job$);
COMMIT;
