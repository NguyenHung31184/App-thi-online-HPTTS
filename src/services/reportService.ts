/**
 * Báo cáo kết quả & vi phạm — lấy danh sách bài làm, audit log, xuất CSV/Excel.
 */
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import type { AuditEvent } from '../types';

export interface AttemptReportRow {
  id: string;
  user_id: string;
  exam_id: string;
  exam_title: string;
  window_id: string;
  class_id: string;
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
  exam_id: string;
  exam_title: string;
  window_id: string;
  class_id: string;
  event: AuditEvent;
  created_at: string;
}

export interface ReportFilters {
  exam_id?: string;
  window_id?: string;
}

/** Danh sách bài làm đã hoàn thành để báo cáo (có join đề thi + kỳ thi). */
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

  if (filters.exam_id) q = q.eq('exam_id', filters.exam_id);
  if (filters.window_id) q = q.eq('window_id', filters.window_id);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as (typeof data extends (infer R)[] ? R : never)[];

  return rows.map((r: any) => {
    const exam = r.exams;
    const window = r.exam_windows;
    const threshold =
      exam?.pass_threshold ?? 0.7;
    const score = r.score != null ? Number(r.score) : null;
    const passed = score != null && !r.disqualified && score >= threshold;
    return {
      id: r.id,
      user_id: r.user_id,
      exam_id: r.exam_id,
      exam_title: exam?.title ?? '',
      window_id: r.window_id,
      class_id: window?.class_id ?? '',
      score,
      raw_score: r.raw_score != null ? Number(r.raw_score) : null,
      passed,
      disqualified: Boolean(r.disqualified),
      completed_at: r.completed_at != null ? new Date(r.completed_at).toLocaleString('vi-VN') : null,
      synced_to_ttdt_at: r.synced_to_ttdt_at ?? null,
    } as AttemptReportRow;
  });
}

/** Danh sách log vi phạm (attempt_audit_logs) để báo cáo. */
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

  const rows = (data ?? []) as (typeof data extends (infer R)[] ? R : never)[];

  return rows.map((r: any) => {
    const attempt = r.attempts;
    const exam = attempt?.exams;
    const window = attempt?.exam_windows;
    return {
      id: r.id,
      attempt_id: r.attempt_id,
      user_id: attempt?.user_id ?? '',
      exam_id: attempt?.exam_id ?? '',
      exam_title: exam?.title ?? '',
      window_id: attempt?.window_id ?? '',
      class_id: window?.class_id ?? '',
      event: r.event as AuditEvent,
      created_at: r.created_at ? new Date(r.created_at).toLocaleString('vi-VN') : '',
    } as ViolationReportRow;
  });
}

/** Xuất danh sách ra CSV (BOM UTF-8 để Excel mở đúng tiếng Việt). */
export function exportReportToCsv(rows: AttemptReportRow[], filename?: string): void {
  const headers = [
    'Mã bài làm',
    'User ID',
    'Đề thi',
    'Mã kỳ',
    'Lớp (class_id)',
    'Điểm (0-1)',
    'Điểm thô',
    'Đạt',
    'Loại',
    'Hoàn thành lúc',
    'Đồng bộ TTDT',
  ];
  const csvRows = rows.map((r) => [
    r.id,
    r.user_id,
    r.exam_title,
    r.window_id,
    r.class_id,
    r.score ?? '',
    r.raw_score ?? '',
    r.passed ? 'Đạt' : 'Chưa đạt',
    r.disqualified ? 'Loại' : '',
    r.completed_at ?? '',
    r.synced_to_ttdt_at ? 'Có' : 'Chưa',
  ]);
  const csv = [headers, ...csvRows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `ket-qua-thi-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Xuất danh sách ra Excel (xlsx). */
export function exportReportToExcel(rows: AttemptReportRow[], filename?: string): void {
  const wsData = [
    [
      'Mã bài làm',
      'User ID',
      'Đề thi',
      'Mã kỳ',
      'Lớp (class_id)',
      'Điểm (0-1)',
      'Điểm thô',
      'Đạt',
      'Loại',
      'Hoàn thành lúc',
      'Đồng bộ TTDT',
    ],
    ...rows.map((r) => [
      r.id,
      r.user_id,
      r.exam_title,
      r.window_id,
      r.class_id,
      r.score ?? '',
      r.raw_score ?? '',
      r.passed ? 'Đạt' : 'Chưa đạt',
      r.disqualified ? 'Loại' : '',
      r.completed_at ?? '',
      r.synced_to_ttdt_at ? 'Có' : 'Chưa',
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Kết quả thi');
  XLSX.writeFile(wb, filename ?? `ket-qua-thi-${Date.now()}.xlsx`);
}

/** Xuất danh sách vi phạm ra CSV. */
export function exportViolationsToCsv(rows: ViolationReportRow[], filename?: string): void {
  const headers = [
    'Mã log',
    'Mã bài làm',
    'User ID',
    'Đề thi',
    'Mã kỳ',
    'Lớp (class_id)',
    'Sự kiện',
    'Thời điểm',
  ];
  const csvRows = rows.map((r) => [
    r.id,
    r.attempt_id,
    r.user_id,
    r.exam_title,
    r.window_id,
    r.class_id,
    r.event,
    r.created_at,
  ]);
  const csv = [headers, ...csvRows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `bao-cao-vi-pham-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Xuất danh sách vi phạm ra Excel (xlsx). */
export function exportViolationsToExcel(rows: ViolationReportRow[], filename?: string): void {
  const wsData = [
    [
      'Mã log',
      'Mã bài làm',
      'User ID',
      'Đề thi',
      'Mã kỳ',
      'Lớp (class_id)',
      'Sự kiện',
      'Thời điểm',
    ],
    ...rows.map((r) => [
      r.id,
      r.attempt_id,
      r.user_id,
      r.exam_title,
      r.window_id,
      r.class_id,
      r.event,
      r.created_at,
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Vi pham');
  XLSX.writeFile(wb, filename ?? `bao-cao-vi-pham-${Date.now()}.xlsx`);
}
