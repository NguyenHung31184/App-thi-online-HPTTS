/**
 * Đọc exam_sync_log và practical_sync_log; dùng cho màn Đồng bộ điểm.
 */
import { supabase } from '../lib/supabaseClient';

interface ProfileInfo {
  name: string;
  email: string;
  student_id?: string;
}

async function fetchProfilesById(userIds: string[]): Promise<Map<string, ProfileInfo>> {
  const map = new Map<string, ProfileInfo>();
  if (userIds.length === 0) return map;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, student_id')
    .in('id', userIds);
  if (error) return map;
  (data ?? []).forEach(
    (p: { id: string; name: string | null; email?: string | null; student_id?: string | null }) => {
      const name = p?.name?.trim() ?? '';
      const email = (p?.email ?? '').trim();
      const student_id = (p?.student_id ?? undefined) || undefined;
      map.set(p.id, { name, email, student_id });
    }
  );
  return map;
}

async function fetchClassNamesById(classIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (classIds.length === 0) return map;
  const { data, error } = await supabase
    .from('classes')
    .select('id, name')
    .in('id', classIds);
  if (error) return map;
  (data ?? []).forEach((c: { id: string; name: string | null }) => {
    if (c?.name) map.set(c.id, c.name.trim());
  });
  return map;
}

async function fetchStudentNamesById(
  studentIds: string[]
): Promise<Map<string, { name: string; code?: string }>> {
  const map = new Map<string, { name: string; code?: string }>();
  if (studentIds.length === 0) return map;
  const { data, error } = await supabase
    .from('students')
    .select('id, name, code')
    .in('id', studentIds);
  if (error) return map;
  (data ?? []).forEach((s: { id: string; name?: string | null; code?: string | null }) => {
    const name = (s.name || '').trim();
    const code = (s.code ?? undefined) || undefined;
    map.set(s.id, { name, code });
  });
  return map;
}

async function fetchStudentNamesByExamEmail(
  emails: string[]
): Promise<Map<string, { name: string; code?: string }>> {
  const map = new Map<string, { name: string; code?: string }>();
  if (emails.length === 0) return map;
  const { data, error } = await supabase
    .from('students')
    .select('exam_account_email, name, student_code')
    .in('exam_account_email', emails);
  if (error) return map;
  (data ?? []).forEach(
    (s: { exam_account_email?: string | null; name?: string | null; student_code?: string | null }) => {
      const email = (s.exam_account_email ?? '').trim();
      if (!email) return;
      const name = (s.name ?? '').trim();
      const code = (s.student_code ?? undefined) || undefined;
      map.set(email, { name, code });
    }
  );
  return map;
}

export type SyncStatus = 'success' | 'failed';

export interface ExamSyncLogEntry {
  id: string;
  attempt_id: string;
  enrollment_id: string | null;
  module_id: string | null;
  payload: unknown;
  status: SyncStatus;
  response: string | null;
  created_at: string;
  user_id?: string | null;
  user_name?: string;
  user_email?: string;
  exam_title?: string;
  window_id?: string | null;
  class_id?: string | null;
  class_name?: string;
}

export interface PracticalSyncLogEntry {
  id: string;
  practical_attempt_id: string;
  enrollment_id: string | null;
  module_id: string | null;
  payload: unknown;
  status: SyncStatus;
  response: string | null;
  created_at: string;
}

export interface SyncLogFilters {
  status?: SyncStatus;
}

export interface CleanupOptions {
  days?: number;
  status?: SyncStatus;
}

/** Danh sách log đồng bộ điểm lý thuyết (exam_sync_log), mới nhất trước. */
export async function listExamSyncLog(
  filters?: SyncLogFilters
): Promise<ExamSyncLogEntry[]> {
  let q = supabase
    .from('exam_sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (filters?.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) throw error;
  const logs = (data ?? []) as ExamSyncLogEntry[];

  if (logs.length === 0) return logs;

  const attemptIds = [...new Set(logs.map((l) => l.attempt_id).filter(Boolean))];
  if (attemptIds.length === 0) return logs;

  const { data: attemptsData } = await supabase
    .from('attempts')
    .select(
      `
      id,
      user_id,
      exam_id,
      window_id,
      exams (title),
      exam_windows (class_id)
    `
    )
    .in('id', attemptIds);

  type AttemptWithJoin = {
    id: string;
    user_id: string | null;
    window_id: string | null;
    exams?: { title?: string | null } | null;
    exam_windows?: { class_id?: string | null } | null;
  };
  const attempts = (attemptsData ?? []) as AttemptWithJoin[];
  const userIds = [...new Set(attempts.map((r) => r.user_id).filter((id): id is string => Boolean(id)))];
  const classIds = [...new Set(attempts.map((r) => r.exam_windows?.class_id).filter((id): id is string => Boolean(id)))];

  const profileByUserId = await fetchProfilesById(userIds);
  const studentIds = [
    ...new Set(Array.from(profileByUserId.values()).map((p) => p.student_id).filter(Boolean)),
  ] as string[];
  const emails = [
    ...new Set(Array.from(profileByUserId.values()).map((p) => p.email).filter(Boolean)),
  ] as string[];
  const [classNamesById, studentNamesById, studentNamesByExamEmail] = await Promise.all([
    fetchClassNamesById(classIds),
    fetchStudentNamesById(studentIds),
    fetchStudentNamesByExamEmail(emails),
  ]);

  const infoByAttemptId = new Map<
    string,
    {
      user_id: string | null;
      user_name: string;
      user_email: string;
      exam_title: string;
      window_id: string | null;
      class_id: string | null;
      class_name: string;
    }
  >();

  attempts.forEach((r) => {
    const exam = r.exams;
    const window = r.exam_windows;
    const userId = r.user_id ?? '';
    const classId = window?.class_id ?? '';
    const profile = profileByUserId.get(userId);
    const studentInfoById = profile?.student_id ? studentNamesById.get(profile.student_id) : undefined;
    const studentInfoByEmail = profile?.email
      ? studentNamesByExamEmail.get(profile.email)
      : undefined;
    const displayName =
      studentInfoById?.name ||
      studentInfoByEmail?.name ||
      profile?.name ||
      profile?.email ||
      '';
    const info = {
      user_id: userId || null,
      user_name: displayName,
      user_email: profile?.email ?? '',
      exam_title: exam?.title ?? '',
      window_id: r.window_id ?? null,
      class_id: classId || null,
      class_name: (classNamesById.get(classId) ?? classId) || '',
    };
    infoByAttemptId.set(r.id, info);
  });

  return logs.map((log) => {
    const extra = infoByAttemptId.get(log.attempt_id);
    return extra ? { ...log, ...extra } : log;
  });
}

/** Danh sách log đồng bộ điểm thực hành (practical_sync_log), mới nhất trước. */
export async function listPracticalSyncLog(
  filters?: SyncLogFilters
): Promise<PracticalSyncLogEntry[]> {
  let q = supabase
    .from('practical_sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (filters?.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PracticalSyncLogEntry[];
}

/** Xóa bớt log cũ (mặc định: lỗi > 30 ngày). */
export async function cleanupOldSyncLogs(options?: CleanupOptions): Promise<void> {
  const days = options?.days ?? 30;
  const status = options?.status ?? 'failed';
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    await supabase
      .from('exam_sync_log')
      .delete()
      .lt('created_at', cutoff)
      .eq('status', status);
  } catch (err) {
    console.warn('[cleanupOldSyncLogs] exam_sync_log:', err);
  }

  try {
    await supabase
      .from('practical_sync_log')
      .delete()
      .lt('created_at', cutoff)
      .eq('status', status);
  } catch (err) {
    console.warn('[cleanupOldSyncLogs] practical_sync_log:', err);
  }
}
