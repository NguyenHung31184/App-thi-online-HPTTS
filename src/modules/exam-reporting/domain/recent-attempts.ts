import { DEFAULT_PASS_THRESHOLD, studentDisplayName, type ReportDirectory } from './report-rows';

/** One submitted attempt on the dashboard: exam, window, time taken, score, result. */
export interface DashboardRecentAttemptRow {
  id: string;
  exam_id: string;
  exam_title: string;
  window_id: string;
  window_label: string;
  student_label: string;
  started_at: number;
  completed_at: number;
  duration_label: string;
  score: number | null;
  raw_display: string;
  passed: boolean;
  disqualified: boolean;
  /** Time taken is longer than the exam's duration_minutes. */
  overtime: boolean;
}

export interface RecentAttemptRecord {
  id: string;
  exam_id: string;
  window_id: string;
  started_at: number;
  completed_at: number | null;
  score: number | null;
  raw_score: number | null;
  total_max: number | null;
  disqualified: boolean | null;
  user_id: string | null;
  exams?: { title?: string | null; pass_threshold?: number | null; duration_minutes?: number | null } | null;
  exam_windows?: { id?: string; start_at?: number; end_at?: number; access_code?: string | null; class_id?: string | null } | null;
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 120) return `${Math.floor(m / 60)} giờ ${m % 60} phút`;
  return `${m} phút ${s} giây`;
}

export function formatWindowRange(startAt: number, endAt: number): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  try {
    return `${new Date(Number(startAt)).toLocaleString('vi-VN', opts)} → ${new Date(Number(endAt)).toLocaleString('vi-VN', opts)}`;
  } catch {
    return '—';
  }
}

export function toRecentAttemptRow(r: RecentAttemptRecord, directory: ReportDirectory): DashboardRecentAttemptRow {
  const exam = r.exams;
  const win = r.exam_windows;
  const threshold = exam?.pass_threshold ?? DEFAULT_PASS_THRESHOLD;
  const scoreNum = r.score != null ? Number(r.score) : null;
  const passed = Boolean(!r.disqualified && scoreNum != null && scoreNum >= threshold);
  const completedAt = r.completed_at != null ? Number(r.completed_at) : 0;
  const startedAt = Number(r.started_at);
  const durationMs = completedAt > 0 && startedAt > 0 ? completedAt - startedAt : -1;
  const raw = r.raw_score != null ? Number(r.raw_score) : null;
  const max = r.total_max != null ? Number(r.total_max) : null;
  const rawDisplay =
    raw != null && max != null && max > 0
      ? `${Math.round(raw)} / ${Math.round(max)}`
      : scoreNum != null
        ? `${Math.round(scoreNum * 100)}%`
        : '—';

  const profile = directory.profiles.get(r.user_id ?? '');
  const studentLabel = studentDisplayName(profile, directory) || '—';

  // Window label: class, time range, access code.
  const winStart = win?.start_at != null ? Number(win.start_at) : 0;
  const winEnd = win?.end_at != null ? Number(win.end_at) : 0;
  const className = win?.class_id ? directory.classNames.get(win.class_id) : null;
  const timeRange = winStart > 0 && winEnd > 0 ? formatWindowRange(winStart, winEnd) : null;
  const accessCode = win?.access_code ? `Mã ${win.access_code}` : null;
  const windowLabel = [className, timeRange, accessCode].filter(Boolean).join(' · ') || '—';

  const examDurationMs = (exam?.duration_minutes ?? 0) * 60 * 1000;

  return {
    id: r.id,
    exam_id: r.exam_id,
    exam_title: exam?.title ?? '—',
    window_id: r.window_id,
    window_label: windowLabel,
    student_label: studentLabel,
    started_at: startedAt,
    completed_at: completedAt,
    duration_label: formatDurationMs(durationMs),
    score: scoreNum,
    raw_display: rawDisplay,
    passed,
    disqualified: Boolean(r.disqualified),
    overtime: examDurationMs > 0 && durationMs > 0 && durationMs > examDurationMs,
  };
}
