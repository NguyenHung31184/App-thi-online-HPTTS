/**
 * Báo cáo kết quả & vi phạm — lấy danh sách bài làm, audit log, xuất CSV/Excel.
 */
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import type { AuditEvent } from '../types';

export interface AttemptReportRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  exam_id: string;
  exam_title: string;
  window_id: string;
  class_id: string;
  class_name: string;
  score: number | null;
  raw_score: number | null;
  passed: boolean;
  disqualified: boolean;
  completed_at: string | null;
  synced_to_ttdt_at: string | null;
}

export interface ViolationReportRow {
  id: string;
  attempt_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  exam_id: string;
  exam_title: string;
  window_id: string;
  class_id: string;
  class_name: string;
  event: AuditEvent;
  created_at: string;
}

export interface ReportFilters {
  exam_id?: string;
  window_id?: string;
}

/** Danh sách bài làm đã hoàn thành để báo cáo (có join đề thi + kỳ thi). Không join profiles trong query để tránh lỗi/trống khi FK hoặc RLS khác schema.
 * Khi lọc theo exam_id: hiển thị cả bài làm thuộc kỳ thi "nhiều đề" (exam_ids chứa exam_id đó), không chỉ attempt.exam_id = exam_id.
 */
export async function listAttemptsForReport(
  filters: ReportFilters
): Promise<AttemptReportRow[]> {
  let q = supabase
    .from('attempts')
    .select(
      `
      id,
      user_id,
      exam_id,
      window_id,
      score,
      raw_score,
      disqualified,
      completed_at,
      synced_to_ttdt_at,
      exams (title, pass_threshold),
      exam_windows (class_id)
    `
    )
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (filters.exam_id) {
    const examId = filters.exam_id;
    const { data: windowRows } = await supabase
      .from('exam_windows')
      .select('id')
      .or(`exam_id.eq.${examId},exam_ids.ov.{"${examId}"}`);
    const windowIds = (windowRows ?? []).map((r: { id: string }) => r.id);
    const idsToFetch = new Set<string>();
    const { data: byExam } = await supabase
      .from('attempts')
      .select('id')
      .eq('status', 'completed')
      .eq('exam_id', examId);
    (byExam ?? []).forEach((r: { id: string }) => idsToFetch.add(r.id));
    if (windowIds.length > 0) {
      const { data: byWindow } = await supabase
        .from('attempts')
        .select('id')
        .eq('status', 'completed')
        .in('window_id', windowIds);
      (byWindow ?? []).forEach((r: { id: string }) => idsToFetch.add(r.id));
    }
    if (idsToFetch.size > 0) {
      q = q.in('id', [...idsToFetch]);
    } else {
      q = q.eq('exam_id', examId);
    }
  }
  if (filters.window_id) q = q.eq('window_id', filters.window_id);

  const { data, error } = await q;
  if (error) throw error;

  type AttemptRow = {
    id: string;
    user_id: string | null;
    exam_id: string | null;
    window_id: string | null;
    score: number | null;
    raw_score: number | null;
    disqualified: boolean | null;
    completed_at: number | null;
    synced_to_ttdt_at: string | null;
    exams?: { title?: string | null; pass_threshold?: number | null } | null;
    exam_windows?: { class_id?: string | null } | null;
  };
  const rows = (data ?? []) as AttemptRow[];

  const userIds = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => Boolean(id)))];
  const classIds = [...new Set(rows.map((r) => r.exam_windows?.class_id).filter((id): id is string => Boolean(id)))];

  const profileByUserId = await fetchProfilesById(userIds);
  const studentIds = [...new Set(Array.from(profileByUserId.values()).map((p) => p.student_id).filter(Boolean))] as string[];
  const emails = [...new Set(Array.from(profileByUserId.values()).map((p) => p.email).filter(Boolean))] as string[];
  const [classNamesById, studentNamesById, studentNamesByExamEmail] = await Promise.all([
    fetchClassNamesById(classIds),
    fetchStudentNamesById(studentIds),
    fetchStudentNamesByExamEmail(emails),
  ]);

  return rows.map((r) => {
    const exam = r.exams;
    const window = r.exam_windows;
    const classId = window?.class_id ?? '';
    const profile = profileByUserId.get(r.user_id);
    const studentInfoById = profile?.student_id ? studentNamesById.get(profile.student_id) : undefined;
    const studentInfoByEmail = profile?.email ? studentNamesByExamEmail.get(profile.email) : undefined;
    const displayName =
      studentInfoById?.name ||
      studentInfoByEmail?.name ||
      profile?.name ||
      profile?.email ||
      '';
    const threshold =
      exam?.pass_threshold ?? 0.7;
    const score = r.score != null ? Number(r.score) : null;
    const passed = score != null && !r.disqualified && score >= threshold;
    return {
      id: r.id,
      user_id: r.user_id,
      user_name: displayName,
      user_email: profile?.email ?? '',
      exam_id: r.exam_id,
      exam_title: exam?.title ?? '',
      window_id: r.window_id,
      class_id: classId,
      class_name: (classNamesById.get(classId) ?? classId) || '',
      score,
      raw_score: r.raw_score != null ? Number(r.raw_score) : null,
      passed,
      disqualified: Boolean(r.disqualified),
      completed_at: r.completed_at != null ? new Date(r.completed_at).toLocaleString('vi-VN') : null,
      synced_to_ttdt_at: r.synced_to_ttdt_at ?? null,
    } as AttemptReportRow;
  });
}

interface ProfileInfo {
  name: string;
  email: string;
  student_id?: string;
}

/** Lấy map user_id -> { name, email, student_id } từ bảng profiles. */
async function fetchProfilesById(userIds: string[]): Promise<Map<string, ProfileInfo>> {
  const map = new Map<string, ProfileInfo>();
  if (userIds.length === 0) return map;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, student_id')
    .in('id', userIds);
  if (error) return map;
  (data ?? []).forEach((p: { id: string; name: string | null; email?: string | null; student_id?: string | null }) => {
    const name = p?.name?.trim() ?? '';
    const email = (p?.email ?? '').trim();
    const student_id = (p?.student_id ?? undefined) || undefined;
    map.set(p.id, { name, email, student_id });
  });
  return map;
}

/** Lấy map class_id -> tên lớp từ bảng classes (TTDT). */
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

/** Danh sách log vi phạm (attempt_audit_logs) để báo cáo. Không join profiles trong attempts để tránh query trả 0 dòng. */
export async function listViolationsForReport(
  filters: ReportFilters
): Promise<ViolationReportRow[]> {
  let q = supabase
    .from('attempt_audit_logs')
    .select(
      `
      id,
      attempt_id,
      event,
      created_at,
      attempts (
        user_id,
        exam_id,
        window_id,
        exams (title),
        exam_windows (class_id)
      )
    `
    )
    .order('created_at', { ascending: false });

  if (filters.exam_id) q = q.eq('attempts.exam_id', filters.exam_id);
  if (filters.window_id) q = q.eq('attempts.window_id', filters.window_id);

  const { data, error } = await q;
  if (error) throw error;

  type ViolationRow = {
    id: string;
    attempt_id: string;
    event: string;
    created_at: string | null;
    attempts?: {
      user_id?: string | null;
      exam_id?: string | null;
      window_id?: string | null;
      exams?: { title?: string | null } | null;
      exam_windows?: { class_id?: string | null } | null;
    } | null;
  };
  const rows = (data ?? []) as ViolationRow[];

  const userIds = [...new Set(rows.map((r) => r.attempts?.user_id).filter((id): id is string => Boolean(id)))];
  const classIds = [...new Set(rows.map((r) => r.attempts?.exam_windows?.class_id).filter((id): id is string => Boolean(id)))];
  const profileByUserId = await fetchProfilesById(userIds);
  const studentIds = [...new Set(Array.from(profileByUserId.values()).map((p) => p.student_id).filter(Boolean))] as string[];
  const emails = [...new Set(Array.from(profileByUserId.values()).map((p) => p.email).filter(Boolean))] as string[];
  const [classNamesById, studentNamesById, studentNamesByExamEmail] = await Promise.all([
    fetchClassNamesById(classIds),
    fetchStudentNamesById(studentIds),
    fetchStudentNamesByExamEmail(emails),
  ]);

  return rows.map((r) => {
    const attempt = r.attempts;
    const exam = attempt?.exams;
    const window = attempt?.exam_windows;
    const userId = attempt?.user_id ?? '';
    const classId = window?.class_id ?? '';
    const profile = profileByUserId.get(userId);
    const studentInfoById = profile?.student_id ? studentNamesById.get(profile.student_id) : undefined;
    const studentInfoByEmail = profile?.email ? studentNamesByExamEmail.get(profile.email) : undefined;
    const displayName =
      studentInfoById?.name ||
      studentInfoByEmail?.name ||
      (profile ? (profile.name || profile.email || '') : '');
    return {
      id: r.id,
      attempt_id: r.attempt_id,
      user_id: userId,
      user_name: displayName,
      user_email: profile?.email ?? '',
      exam_id: attempt?.exam_id ?? '',
      exam_title: exam?.title ?? '',
      window_id: attempt?.window_id ?? '',
      class_id: classId,
      class_name: (classNamesById.get(classId) ?? classId) || '',
      event: r.event as AuditEvent,
      created_at: r.created_at ? new Date(r.created_at).toLocaleString('vi-VN') : '',
    } as ViolationReportRow;
  });
}

/** Lấy map student_id -> { name, code } từ bảng students (TTDT). */
async function fetchStudentNamesById(
  studentIds: string[]
): Promise<Map<string, { name: string; code?: string }>> {
  const map = new Map<string, { name: string; code?: string }>();
  if (studentIds.length === 0) return map;
  const { data, error } = await supabase
    .from('students')
    .select('id, name, code')
    .in('id', studentIds);
  if (error) {
    console.warn('fetchStudentNamesById:', error.message);
    return map;
  }
  (data ?? []).forEach((s: { id: string; name?: string | null; code?: string | null }) => {
    const name = (s.name || '').trim();
    const code = (s.code ?? undefined) || undefined;
    map.set(s.id, { name, code });
  });
  return map;
}

/** Lấy map exam_account_email -> { name, code } từ bảng students (TTDT). */
async function fetchStudentNamesByExamEmail(
  emails: string[]
): Promise<Map<string, { name: string; code?: string }>> {
  const map = new Map<string, { name: string; code?: string }>();
  if (emails.length === 0) return map;
  const { data, error } = await supabase
    .from('students')
    .select('exam_account_email, name, student_code')
    .in('exam_account_email', emails);
  if (error) {
    console.warn('fetchStudentNamesByExamEmail:', error.message);
    return map;
  }
  (data ?? []).forEach((s: { exam_account_email?: string | null; name?: string | null; student_code?: string | null }) => {
    const email = (s.exam_account_email ?? '').trim();
    if (!email) return;
    const name = (s.name ?? '').trim();
    const code = (s.student_code ?? undefined) || undefined;
    map.set(email, { name, code });
  });
  return map;
}

/** Xuất danh sách ra Excel (xlsx). */
export function exportReportToExcel(rows: AttemptReportRow[], filename?: string): void {
  const wsData = [
    [
      'Mã bài làm',
      'Họ tên',
      'Email',
      'Đề thi',
      'Kỳ / Lớp',
      'Điểm',
      'Đạt',
      'Hoàn thành',
      'Đồng bộ TTDT',
    ],
    ...rows.map((r) => [
      r.id,
      r.user_name,
      r.user_email,
      r.exam_title,
      `${r.window_id} / ${r.class_name || r.class_id}`,
      r.score != null
        ? `${(r.score * 100).toFixed(1)}%${r.raw_score != null ? ` (${r.raw_score})` : ''}`
        : '',
      r.disqualified ? 'Loại' : r.passed ? 'Đạt' : 'Chưa đạt',
      r.completed_at ?? '',
      r.synced_to_ttdt_at ? 'Có' : 'Chưa',
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Kết quả thi');
  XLSX.writeFile(wb, filename ?? `ket-qua-thi-${Date.now()}.xlsx`);
}

/** Xuất danh sách vi phạm ra Excel (xlsx). */
export function exportViolationsToExcel(
  rows: {
    user_name: string;
    user_email: string;
    focusLostCount: number;
    visibilityHiddenCount: number;
    fullscreenExitedCount: number;
    copyPasteBlockedCount: number;
    photoTakenCount: number;
  }[],
  filename?: string
): void {
  const wsData = [
    [
      'Họ tên',
      'Email',
      'Mất focus',
      'Ẩn tab / thu nhỏ',
      'Thoát fullscreen',
      'Copy/Paste bị chặn',
      'Ảnh webcam',
    ],
    ...rows.map((r) => [
      r.user_name,
      r.user_email,
      r.focusLostCount,
      r.visibilityHiddenCount,
      r.fullscreenExitedCount,
      r.copyPasteBlockedCount,
      r.photoTakenCount,
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Vi pham');
  XLSX.writeFile(wb, filename ?? `bao-cao-vi-pham-${Date.now()}.xlsx`);
}
