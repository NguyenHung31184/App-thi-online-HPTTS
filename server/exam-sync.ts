import type { SupabaseClient } from '@supabase/supabase-js';

export interface SyncJob { id: string; source: 'theory' | 'practical'; attempt_id: string; lease_token: string }
export interface SyncConfig { url: string; apiKey: string }
export class SyncError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function prepareSync(admin: SupabaseClient, source: 'theory' | 'practical', attemptId: string) {
  const table = source === 'theory' ? 'attempts' : 'practical_attempts';
  const { data: attempt, error } = await admin.from(table).select('*').eq('id', attemptId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!attempt) throw new SyncError(404, 'Không tìm thấy bài làm.');
  if (attempt.status !== (source === 'theory' ? 'completed' : 'graded')) throw new SyncError(409, 'Bài thi chưa chấm xong.');
  const { data: profile, error: profileError } = attempt.user_id
    ? await admin.from('profiles').select('student_id').eq('id', attempt.user_id).maybeSingle()
    : { data: null, error: null };
  if (profileError) throw new Error(profileError.message);
  // Field grading in Sổ chuyên cần stores the TTDT student id; its older screens put it in user_id.
  const studentId: string | null = source === 'practical'
    ? attempt.student_id ?? profile?.student_id ?? (profile ? null : attempt.user_id ?? null)
    : profile?.student_id ?? null;
  let moduleId: string | null = null;
  let classId: string | null = null;
  let title: string | null = null;
  let passThreshold = 0.7;
  let passScore = 70;
  let trial = false;
  if (source === 'theory') {
    const [examResult, windowResult] = await Promise.all([
      admin.from('exams').select('module_id,title,pass_threshold').eq('id', attempt.exam_id).single(),
      admin.from('exam_windows').select('class_id,is_trial').eq('id', attempt.window_id).single(),
    ]);
    if (examResult.error || windowResult.error) throw new Error(examResult.error?.message ?? windowResult.error?.message);
    moduleId = examResult.data.module_id; title = examResult.data.title;
    passThreshold = Number(examResult.data.pass_threshold ?? 0.7);
    classId = windowResult.data.class_id; trial = Boolean(windowResult.data.is_trial);
  } else {
    const { data: session, error: sessionError } = await admin.from('practical_exam_sessions').select('class_id,template_id').eq('id', attempt.session_id).single();
    if (sessionError) throw new Error(sessionError.message);
    const { data: template, error: templateError } = await admin.from('practical_exam_templates').select('module_id,pass_score').eq('id', session.template_id).single();
    if (templateError) throw new Error(templateError.message);
    moduleId = template.module_id; classId = session.class_id;
    passScore = Number(template.pass_score ?? 70);
  }
  if (!trial && (!moduleId || !classId || !studentId)) throw new SyncError(422, 'Thiếu mã mô-đun, lớp hoặc học viên để đồng bộ TTDT.');
  const score = Number(source === 'theory' ? attempt.score ?? 0 : attempt.total_score ?? 0);
  if (!Number.isFinite(score)) throw new SyncError(422, 'Điểm thi không hợp lệ.');
  const disqualified = Boolean(source === 'theory' ? attempt.disqualified : attempt.is_disqualified);
  return {
    table, ownerId: String(attempt.user_id ?? ''), trial,
    targetKey: [source, studentId ?? attempt.user_id, classId, moduleId].filter((x) => x != null).join(':'),
    completedAt: source === 'theory' ? new Date(Number(attempt.completed_at)).toISOString() : attempt.graded_at,
    payload: {
      attempt_id: attemptId, source, enrollment_id: null, student_id: studentId,
      class_id: classId, module_id: moduleId,
      // Theory scores are 0–1, practical totals 0–100; TTDT keeps both on 10.
      final_exam_score: disqualified ? 0 : Number((source === 'theory' ? score * 10 : score / 10).toFixed(1)),
      raw_score: Number(source === 'theory' ? attempt.raw_score ?? 0 : attempt.total_score ?? 0),
      passed: !disqualified && (source === 'theory' ? score >= passThreshold : score >= passScore), disqualified,
    },
    log: source === 'theory'
      ? { attempt_id: attemptId, module_id: moduleId, exam_title: title, window_id: attempt.window_id, class_id: classId }
      : { practical_attempt_id: attemptId, module_id: moduleId },
  };
}

export async function deliverGrade(config: SyncConfig, payload: unknown, send: typeof fetch = fetch): Promise<void> {
  const response = await send(config.url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body: { success?: boolean };
  try { body = JSON.parse(text) as { success?: boolean }; }
  catch { throw new Error(`TTDT trả dữ liệu không hợp lệ (HTTP ${response.status}).`); }
  if (!response.ok || body?.success !== true) throw new Error(`TTDT HTTP ${response.status}: ${text.slice(0, 500)}`);
}

export async function processSyncJob(admin: SupabaseClient, job: SyncJob, config: SyncConfig) {
  let prepared: Awaited<ReturnType<typeof prepareSync>> | undefined;
  let failure: string | null = null;
  try {
    prepared = await prepareSync(admin, job.source, job.attempt_id);
    if (!prepared.trial) {
      await deliverGrade(config, prepared.payload);
      const { error } = await admin.from(prepared.table).update({ synced_to_ttdt_at: new Date().toISOString() }).eq('id', job.attempt_id);
      if (error) throw new Error(error.message);
    }
  } catch (error) { failure = error instanceof Error ? error.message : 'Không thể đồng bộ TTDT.'; }
  const logTable = job.source === 'theory' ? 'exam_sync_log' : 'practical_sync_log';
  const fallbackLog = job.source === 'theory' ? { attempt_id: job.attempt_id } : { practical_attempt_id: job.attempt_id };
  const { error: logError } = await admin.from(logTable).insert({
    ...(prepared?.log ?? fallbackLog), payload: prepared?.payload ?? null,
    status: failure ? 'failed' : 'success', response: failure ?? 'TTDT đã nhận điểm.',
  });
  if (logError) failure ??= `Không ghi được nhật ký: ${logError.message}`;
  const { data: finished, error } = await admin.rpc('finish_exam_sync_job', {
    p_id: job.id, p_lease_token: job.lease_token, p_success: failure === null, p_error: failure,
  });
  if (error) throw new Error(error.message);
  if (!finished) throw new Error('Phiên xử lý đồng bộ đã hết hiệu lực.');
  return { success: failure === null, message: failure ?? undefined };
}
