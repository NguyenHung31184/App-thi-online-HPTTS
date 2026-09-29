import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processSyncJob, type SyncJob } from '../server/exam-sync.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).end(); return; }
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(req.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) { res.status(401).end(); return; }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const config = { url: process.env.TTDT_RECEIVE_GRADES_URL ?? '', apiKey: process.env.TTDT_API_KEY ?? '' };
  if (!url || !key || !config.url || !config.apiKey) { res.status(503).json({ error: 'Missing server configuration' }); return; }
  const admin = createClient(url, key, { auth: { persistSession: false } });
  try {
    const { data: finalized, error } = await admin.rpc('finalize_expired_exam_attempts', { p_limit: 50 });
    if (error) throw new Error(error.message);
    const started = Date.now();
    let processed = 0;
    let failed = 0;
    // Two batches of five give each delivery its 20-second timeout within a 60-second function.
    for (let batch = 0; batch < 2 && Date.now() - started < 25000; batch++) {
      const jobs: SyncJob[] = [];
      for (let index = 0; index < 5; index++) {
        const { data, error: claimError } = await admin.rpc('claim_exam_sync_job');
        if (claimError) throw new Error(claimError.message);
        const job = (data as SyncJob[] | null)?.[0];
        if (!job) break;
        jobs.push(job);
      }
      if (jobs.length === 0) break;
      const results = await Promise.allSettled(jobs.map((job) => processSyncJob(admin, job, config)));
      processed += jobs.length;
      failed += results.filter((result) => result.status === 'rejected' || !result.value.success).length;
    }
    res.status(200).json({ finalized, processed, failed });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Maintenance failed' });
  }
}
