import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const workerUrl = (process.env.QUESTION_IMPORT_WORKER_URL || '').replace(/\/$/, '');
const workerToken = process.env.QUESTION_IMPORT_WORKER_TOKEN || '';

function fail(res: VercelResponse, status: number, message: string): void { res.status(status).json({ message }); }

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { fail(res, 405, 'Method not allowed'); return; }
  if (!supabaseUrl || !serviceRoleKey || !workerUrl || !workerToken) { fail(res, 503, 'Worker nhập tài liệu chưa được cấu hình trên máy chủ.'); return; }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { fail(res, 401, 'Bạn chưa đăng nhập.'); return; }
  const body = typeof req.body === 'string' ? JSON.parse(req.body) as Record<string, unknown> : req.body as Record<string, unknown>;
  const jobId = typeof body?.job_id === 'string' ? body.job_id : '';
  if (!jobId) { fail(res, 400, 'Thiếu mã phiếu nhập.'); return; }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) { fail(res, 401, 'Phiên đăng nhập không hợp lệ.'); return; }
  const [{ data: profile }, { data: job, error: jobError }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', auth.user.id).maybeSingle(),
    admin.from('question_import_jobs').select('id, status, requested_by').eq('id', jobId).maybeSingle(),
  ]);
  if (profile?.role !== 'admin' && profile?.role !== 'teacher') { fail(res, 403, 'Chỉ giảng viên hoặc quản trị viên được nhập tài liệu.'); return; }
  if (jobError || !job) { fail(res, 404, 'Không tìm thấy phiếu nhập.'); return; }
  if (profile?.role !== 'admin' && job.requested_by !== auth.user.id) { fail(res, 403, 'Ban khong co quyen xu ly phieu nhap nay.'); return; }
  if (job.status !== 'queued') { fail(res, 409, 'Phiếu nhập này đã được xử lý.'); return; }
  try {
    const workerResponse = await fetch(`${workerUrl}/jobs/${jobId}`, { method: 'POST', headers: { Authorization: `Bearer ${workerToken}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000) });
    if (!workerResponse.ok) {
      const detail = (await workerResponse.text()).slice(0, 300);
      await admin.from('question_import_jobs').update({ status: 'failed', error_message: detail || 'Worker từ chối xử lý tài liệu.' }).eq('id', jobId);
      fail(res, 502, 'Worker không thể nhận tài liệu.');
      return;
    }
    res.status(202).json({ accepted: true });
  } catch (error) {
    await admin.from('question_import_jobs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Không thể kết nối worker.' }).eq('id', jobId);
    fail(res, 502, 'Không thể kết nối worker xử lý tài liệu.');
  }
}
