/** One attempt as returned by get_live_exam_monitor. Elapsed seconds come from the server clock. */
export interface LiveAttemptRow {
  windowId: string;
  classId: string;
  className: string | null;
  enrolled: number;
  examTitle: string;
  isTrial: boolean;
  windowEndAt: number;
  attemptId: string;
  studentCode: string | null;
  studentName: string | null;
  status: string;
  startedAt: number;
  answered: number;
  totalQuestions: number;
  violations: number;
  lastViolation: string | null;
  disqualified: boolean;
  secondsSinceSeen: number;
  secondsSinceViolation: number | null;
}

export type LiveStatus = 'disconnected' | 'violation' | 'working' | 'disqualified' | 'submitted';

/** Attention order: what a proctor must act on comes first. */
export const LIVE_STATUS_ORDER: LiveStatus[] = ['disconnected', 'violation', 'working', 'disqualified', 'submitted'];

export const LIVE_STATUS_LABELS: Record<LiveStatus, string> = {
  disconnected: 'Mất kết nối',
  violation: 'Có vi phạm',
  working: 'Đang làm',
  disqualified: 'Đã hủy bài',
  submitted: 'Đã nộp',
};

export const VIOLATION_LABELS: Record<string, string> = {
  visibility_hidden: 'Rời tab',
  focus_lost: 'Mất focus',
  fullscreen_exited: 'Thoát toàn màn hình',
  ai_no_face: 'Không thấy mặt',
  ai_multiple_face: 'Nhiều người',
  ai_cell_phone: 'Điện thoại',
  ai_prohibited_object: 'Vật cấm',
};

// The exam page reports every 20 s; three missed signals mean the page is gone or offline.
export const DISCONNECT_AFTER_SECONDS = 60;

export function liveStatusOf(row: LiveAttemptRow): LiveStatus {
  if (row.disqualified) return 'disqualified';
  if (row.status !== 'in_progress') return 'submitted';
  if (row.secondsSinceSeen > DISCONNECT_AFTER_SECONDS) return 'disconnected';
  return row.violations > 0 ? 'violation' : 'working';
}

export interface LiveStudent extends LiveAttemptRow {
  liveStatus: LiveStatus;
}

export interface LiveClassGroup {
  classId: string;
  className: string;
  examTitles: string[];
  isTrial: boolean;
  endsAt: number;
  counts: Record<LiveStatus, number>;
  notStarted: number;
  students: LiveStudent[];
}

function compareStudents(a: LiveStudent, b: LiveStudent): number {
  const byStatus = LIVE_STATUS_ORDER.indexOf(a.liveStatus) - LIVE_STATUS_ORDER.indexOf(b.liveStatus);
  if (byStatus !== 0) return byStatus;
  if (a.violations !== b.violations) return b.violations - a.violations;
  return (a.studentName ?? '').localeCompare(b.studentName ?? '', 'vi');
}

function needsAttention(group: LiveClassGroup): number {
  return group.counts.disconnected + group.counts.violation;
}

/**
 * One group per class (a class can sit several windows at once). A student who retakes has two attempts; only the
 * latest one is shown. Classes with students needing attention come first.
 */
export function groupByClass(rows: LiveAttemptRow[]): LiveClassGroup[] {
  const byClass = new Map<string, LiveAttemptRow[]>();
  for (const row of rows) {
    const key = row.classId || row.windowId;
    byClass.set(key, [...(byClass.get(key) ?? []), row]);
  }

  const groups: LiveClassGroup[] = [];
  for (const [classId, classRows] of byClass) {
    const latest = new Map<string, LiveAttemptRow>();
    for (const row of classRows) {
      const student = row.studentCode ?? row.attemptId;
      const kept = latest.get(student);
      if (!kept || row.startedAt > kept.startedAt) latest.set(student, row);
    }
    const students = [...latest.values()].map((row) => ({ ...row, liveStatus: liveStatusOf(row) })).sort(compareStudents);
    const counts = Object.fromEntries(LIVE_STATUS_ORDER.map((status) => [status, 0])) as Record<LiveStatus, number>;
    for (const student of students) counts[student.liveStatus] += 1;
    groups.push({
      classId,
      className: classRows[0].className ?? 'Lớp chưa xác định',
      examTitles: [...new Set(classRows.map((row) => row.examTitle))],
      isTrial: classRows.some((row) => row.isTrial),
      endsAt: Math.max(...classRows.map((row) => row.windowEndAt)),
      counts,
      notStarted: Math.max(0, classRows[0].enrolled - students.length),
      students,
    });
  }

  return groups.sort((a, b) => needsAttention(b) - needsAttention(a) || a.className.localeCompare(b.className, 'vi'));
}

/** "vừa xong", "45 giây trước", "3 phút trước". */
export function formatSecondsAgo(seconds: number): string {
  if (seconds < 5) return 'vừa xong';
  if (seconds < 60) return `${seconds} giây trước`;
  return `${Math.floor(seconds / 60)} phút trước`;
}
