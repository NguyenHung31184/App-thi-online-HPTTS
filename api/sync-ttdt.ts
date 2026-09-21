import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const receiveGradesUrl = process.env.TTDT_RECEIVE_GRADES_URL || '';
const ttdtApiKey = process.env.TTDT_API_KEY || '';

function fail(res: VercelResponse, status: number, message: string): void {
  res.status(status).json({ success: false, message });
}

function isStaff(role: unknown): boolean {
  return role === 'admin' || role === 'teacher';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { fail(res, 405, 'Method not allowed'); return; }
  if (!supabaseUrl || !serviceRoleKey || !receiveGradesUrl || !ttdtApiKey) { fail(res, 500, 'Thiếu cấu hình đồng bộ TTDT trên máy chủ.'); return; }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { fail(res, 401, 'Bạn chưa đăng nhập.'); return; }
  const body = typeof req.body === 'string' ? JSON.parse(req.body) as Record<string, unknown> : req.body as Record<string, unknown>;
  const source = body?.source;
  const attemptId = typeof body?.attempt_id === 'string' ? body.attempt_id : '';
  if (!attemptId || (source !== 'theory' && source !== 'practical')) { fail(res, 400, 'Dữ liệu đồng bộ không hợp lệ.'); return; }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) { fail(res, 401, 'Phiên đăng nhập không hợp lệ.'); return; }
  const callerId = authData.user.id;
  const { data: caller } = await admin.from('profiles').select('role').eq('id', callerId).maybeSingle();

  try {
    if (source === 'theory') {
      const { data: attempt, error } = await admin.from('attempts').select('id, user_id, window_id, score, raw_score, disqualified, status, exam_id').eq('id', attemptId).maybeSingle();
      if (error || !attempt) { fail(res, 404, 'Không tìm thấy bài làm.'); return; }
      if (attempt.status !== 'completed') { fail(res, 409, 'Bài thi chưa được nộp.'); return; }
      if (attempt.user_id !== callerId && !isStaff(caller?.role)) { fail(res, 403, 'Bạn không có quyền đồng bộ bài làm này.'); return; }
      const [{ data: exam }, { data: window }, { data: student }] = await Promise.all([
        admin.from('exams').select('module_id, title, pass_threshold').eq('id', attempt.exam_id).maybeSingle(),
        admin.from('exam_windows').select('class_id, is_trial').eq('id', attempt.window_id).maybeSingle(),
        admin.from('profiles').select('student_id').eq('id', attempt.user_id).maybeSingle(),
      ]);
      if (!exam?.module_id || !window?.class_id || !student?.student_id) { fail(res, 422, 'Thiếu mã mô-đun, lớp hoặc học viên để đồng bộ TTDT.'); return; }
      if (window.is_trial) { res.status(200).json({ success: true, message: 'Kỳ thi thử không cần đồng bộ.' }); return; }
      const score = Number(attempt.score ?? 0);
      const payload = { attempt_id: attempt.id, source: 'theory', enrollment_id: null, student_id: student.student_id, class_id: window.class_id, module_id: exam.module_id, final_exam_score: Number((score * 10).toFixed(1)), raw_score: Number(attempt.raw_score ?? 0), passed: !attempt.disqualified && score >= Number(exam.pass_threshold ?? 0.7), disqualified: Boolean(attempt.disqualified) };
      const upstream = await fetch(receiveGradesUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ttdtApiKey }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000) });
      const responseText = await upstream.text();
      await admin.from('exam_sync_log').insert({ attempt_id: attempt.id, module_id: exam.module_id, payload, status: upstream.ok ? 'success' : 'failed', response: responseText.slice(0, 2000), exam_title: exam.title, window_id: attempt.window_id, class_id: window.class_id });
      if (upstream.ok) await admin.from('attempts').update({ synced_to_ttdt_at: new Date().toISOString() }).eq('id', attempt.id);
      res.status(upstream.ok ? 200 : 502).json({ success: upstream.ok, message: upstream.ok ? undefined : `TTDT: ${responseText.slice(0, 200)}` });
      return;
    }
    if (!isStaff(caller?.role)) { fail(res, 403, 'Chỉ giảng viên hoặc quản trị viên được đồng bộ điểm thực hành.'); return; }
    const { data: practical, error } = await admin.from('practical_attempts').select('id, session_id, user_id, total_score, status').eq('id', attemptId).maybeSingle();
    if (error || !practical) { fail(res, 404, 'Không tìm thấy bài thi thực hành.'); return; }
    if (practical.status !== 'graded') { fail(res, 409, 'Bài thi thực hành chưa được chấm xong.'); return; }
    const [{ data: session }, { data: student }] = await Promise.all([
      admin.from('practical_exam_sessions').select('class_id, template_id').eq('id', practical.session_id).maybeSingle(),
      admin.from('profiles').select('student_id').eq('id', practical.user_id).maybeSingle(),
    ]);
    const { data: template } = session ? await admin.from('practical_exam_templates').select('module_id').eq('id', session.template_id).maybeSingle() : { data: null };
    if (!session?.class_id || !template?.module_id || !student?.student_id) { fail(res, 422, 'Thiếu mã mô-đun, lớp hoặc học viên để đồng bộ TTDT.'); return; }
    const score = Number(practical.total_score ?? 0);
    const payload = { attempt_id: practical.id, source: 'practical', enrollment_id: null, student_id: student.student_id, class_id: session.class_id, module_id: template.module_id, final_exam_score: score, raw_score: score, passed: score > 0, disqualified: false };
    const upstream = await fetch(receiveGradesUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ttdtApiKey }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000) });
    const responseText = await upstream.text();
    await admin.from('practical_sync_log').insert({ practical_attempt_id: practical.id, module_id: template.module_id, payload, status: upstream.ok ? 'success' : 'failed', response: responseText.slice(0, 2000) });
    if (upstream.ok) await admin.from('practical_attempts').update({ synced_to_ttdt_at: new Date().toISOString() }).eq('id', practical.id);
    res.status(upstream.ok ? 200 : 502).json({ success: upstream.ok, message: upstream.ok ? undefined : `TTDT: ${responseText.slice(0, 200)}` });
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Không thể đồng bộ TTDT.');
  }
}
