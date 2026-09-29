import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prepareSync, processSyncJob, SyncError, type SyncJob } from '../server/exam-sync.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ success: false, message: 'Method not allowed' }); return; }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const config = { url: process.env.TTDT_RECEIVE_GRADES_URL ?? '', apiKey: process.env.TTDT_API_KEY ?? '' };
  if (!url || !key || !config.url || !config.apiKey) { res.status(500).json({ success: false, message: 'Thiếu cấu hình đồng bộ TTDT trên máy chủ.' }); return; }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập.' }); return; }
  try {
    let body: Record<string, unknown>;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { throw new SyncError(400, 'Dữ liệu JSON không hợp lệ.'); }
    const source = body?.source;
    const attemptId = body?.attempt_id;
    if ((source !== 'theory' && source !== 'practical') || typeof attemptId !== 'string'
      || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(attemptId)) throw new SyncError(400, 'Dữ liệu đồng bộ không hợp lệ.');
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) throw new SyncError(401, 'Phiên đăng nhập không hợp lệ.');
    const { data: profile, error: profileError } = await admin.from('profiles').select('exam_role').eq('id', auth.user.id).maybeSingle();
    if (profileError) throw new Error(profileError.message);
    const staff = profile?.exam_role === 'admin' || profile?.exam_role === 'teacher';
    const table = source === 'theory' ? 'attempts' : 'practical_attempts';
    const { data: owner, error: ownerError } = await admin.from(table).select('user_id').eq('id', attemptId).maybeSingle();
    if (ownerError) throw new Error(ownerError.message);
    if (!owner || (!staff && (source === 'practical' || owner.user_id !== auth.user.id))) throw new SyncError(403, 'Bạn không có quyền đồng bộ bài làm này.');
    const prepared = await prepareSync(admin, source, attemptId);
    if (prepared.trial) { res.status(200).json({ success: true, message: 'Kỳ thi thử không cần đồng bộ.' }); return; }
    // Admit older completed attempts without resetting jobs already delivered.
    const { error: enqueueError } = await admin.from('exam_sync_jobs').upsert({
      source, attempt_id: attemptId, target_key: prepared.targetKey, completed_at: prepared.completedAt,
    }, { onConflict: 'source,attempt_id', ignoreDuplicates: true });
    if (enqueueError) throw new Error(enqueueError.message);
    const { data: jobs, error } = await admin.rpc('claim_exam_sync_job', { p_source: source, p_attempt_id: attemptId });
    if (error) throw new Error(error.message);
    const job = (jobs as SyncJob[] | null)?.[0];
    if (!job) {
      const { data: existing, error: existingError } = await admin.from('exam_sync_jobs').select('status').eq('source', source).eq('attempt_id', attemptId).single();
      if (existingError) throw new Error(existingError.message);
      const success = existing.status === 'success' || existing.status === 'superseded';
      res.status(success ? 200 : 202).json({ success, message: success ? 'Điểm đã được đồng bộ hoặc đã có kết quả mới hơn.' : 'Điểm đang chờ đồng bộ tự động.' });
      return;
    }
    const result = await processSyncJob(admin, job, config);
    res.status(result.success ? 200 : 502).json(result);
  } catch (error) {
    res.status(error instanceof SyncError ? error.status : 500).json({ success: false, message: error instanceof Error ? error.message : 'Không thể đồng bộ TTDT.' });
  }
}
