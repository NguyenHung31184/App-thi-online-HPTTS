import { supabase } from '../lib/supabaseClient';

/** Một dòng bài đã nộp trên dashboard báo cáo (đề + kỳ thi + thời gian làm + điểm + đạt). */
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
  /** true nếu thời gian làm vượt quá duration_minutes của đề thi */
  overtime: boolean;
}

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 120) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h} giờ ${rm} phút`;
  }
  return `${m} phút ${s} giây`;
}

function formatWindowRange(startAt: number, endAt: number): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  try {
    const a = new Date(Number(startAt)).toLocaleString('vi-VN', opts);
    const b = new Date(Number(endAt)).toLocaleString('vi-VN', opts);
    return `${a} → ${b}`;
  } catch {
    return '—';
  }
}

/** Danh sách bài làm đã hoàn thành gần đây (admin/teacher). Hiển thị trực tiếp trên dashboard. */
export async function listRecentCompletedAttemptsForDashboard(
  limit: number,
): Promise<DashboardRecentAttemptRow[]> {
  const cap = Math.min(200, Math.max(1, Math.floor(limit) || 80));
  const { data, error } = await supabase
    .from('attempts')
    .select(
      `
      id,
      exam_id,
      window_id,
      started_at,
      completed_at,
      score,
      raw_score,
      total_max,
      disqualified,
      user_id,
      exams ( title, pass_threshold, duration_minutes ),
      exam_windows ( id, start_at, end_at, access_code, class_id )
    `,
    )
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(cap);

  if (error) throw error;

  const rows = (data ?? []) as {
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
    exam_windows?: {
      id?: string;
      start_at?: number;
      end_at?: number;
      access_code?: string | null;
      class_id?: string | null;
    } | null;
  }[];

  // Batch fetch profiles (name, email, student_id) theo user_id
  const userIds = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => typeof id === 'string'))];
  const profileMap = new Map<string, { name?: string | null; email?: string | null; student_id?: string | null }>();
  if (userIds.length > 0) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, name, email, student_id')
      .in('id', userIds);
    for (const p of (profileData ?? []) as { id: string; name?: string | null; email?: string | null; student_id?: string | null }[]) {
      profileMap.set(p.id, { name: p.name, email: p.email, student_id: p.student_id });
    }
  }

  // Batch fetch tên học viên từ bảng students (TTDT) — theo student_id và theo exam_account_email
  const studentIds = [...new Set(Array.from(profileMap.values()).map((p) => p.student_id).filter((id): id is string => typeof id === 'string'))];
  const profileEmails = [...new Set(Array.from(profileMap.values()).map((p) => p.email).filter((e): e is string => typeof e === 'string' && e.length > 0))];
  const studentNameById = new Map<string, string>();
  const studentNameByEmail = new Map<string, string>();
  const [studentByIdRes, studentByEmailRes] = await Promise.all([
    studentIds.length > 0
      ? supabase.from('students').select('id, name').in('id', studentIds)
      : Promise.resolve({ data: [] }),
    profileEmails.length > 0
      ? supabase.from('students').select('exam_account_email, name').in('exam_account_email', profileEmails)
      : Promise.resolve({ data: [] }),
  ]);
  for (const s of ((studentByIdRes as { data: unknown[] }).data ?? []) as { id: string; name?: string | null }[]) {
    if (s.name?.trim()) studentNameById.set(s.id, s.name.trim());
  }
  for (const s of ((studentByEmailRes as { data: unknown[] }).data ?? []) as { exam_account_email?: string | null; name?: string | null }[]) {
    if (s.exam_account_email && s.name?.trim()) studentNameByEmail.set(s.exam_account_email, s.name.trim());
  }

  // Batch fetch class names theo class_id của exam_windows
  const classIds = [
    ...new Set(
      rows.map((r) => r.exam_windows?.class_id).filter((id): id is string => typeof id === 'string'),
    ),
  ];
  const classNameMap = new Map<string, string>();
  if (classIds.length > 0) {
    const { data: classData } = await supabase.from('classes').select('id, name').in('id', classIds);
    for (const c of (classData ?? []) as { id: string; name: string }[]) {
      classNameMap.set(c.id, c.name);
    }
  }

  return rows.map((r) => {
    const exam = r.exams;
    const win = r.exam_windows;
    const threshold = exam?.pass_threshold ?? 0.7;
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

    // Tên học viên: students.name (by student_id) → students.name (by email) → profiles.name → profiles.email → '—'
    const profile = profileMap.get(r.user_id ?? '');
    const nameByStudentId = profile?.student_id ? studentNameById.get(profile.student_id) : undefined;
    const nameByEmail = profile?.email ? studentNameByEmail.get(profile.email) : undefined;
    const studentLabel = nameByStudentId || nameByEmail || profile?.name?.trim() || profile?.email?.trim() || '—';

    // Nhãn kỳ thi: lớp + ngày giờ + mã (nếu có)
    const winStart = win?.start_at != null ? Number(win.start_at) : 0;
    const winEnd = win?.end_at != null ? Number(win.end_at) : 0;
    const className = win?.class_id ? classNameMap.get(win.class_id) : null;
    const timeRange = winStart > 0 && winEnd > 0 ? formatWindowRange(winStart, winEnd) : null;
    const accessCode = win?.access_code ? `Mã ${win.access_code}` : null;
    const windowLabel = [className, timeRange, accessCode].filter(Boolean).join(' · ') || '—';

    // Kiểm tra vượt giờ
    const examDurationMs = (exam?.duration_minutes ?? 0) * 60 * 1000;
    const overtime = examDurationMs > 0 && durationMs > 0 && durationMs > examDurationMs;

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
      overtime,
    };
  });
}

export interface AttemptsPerDay {
  date: string; // YYYY-MM-DD
  completed: number;
  passed: number;
  failedOrDisqualified: number;
}

export interface ViolationCounts {
  focus_lost: number;
  visibility_hidden: number;
  fullscreen_exited: number;
  copy_paste_blocked: number;
  photo_taken: number;
}

export interface AdminDashboardStats {
  openWindowsToday: number;
  attemptsToday: number;
  attemptsLast7Days: number;
  passedRateLast7Days: number; // 0–1
  attemptsPerDay: AttemptsPerDay[];
  violationsLast24h: ViolationCounts;
  syncFailedToday: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  const [windowsRes, attemptsRes, violationsRes, syncFailedRes] = await Promise.all([
    supabase
      .from('exam_windows')
      .select('id')
      .lte('start_at', now)
      .gte('end_at', now),
    supabase
      .from('attempts')
      .select('completed_at, score, disqualified, exams(pass_threshold)')
      .eq('status', 'completed')
      .gte('completed_at', Math.floor(sevenDaysAgo)),
    supabase
      .from('attempt_audit_logs')
      .select('event, created_at')
      .gte('created_at', new Date(twentyFourHoursAgo).toISOString()),
    supabase
      .from('exam_sync_log')
      .select('id, created_at, status')
      .eq('status', 'failed')
      .gte('created_at', startOfToday.toISOString()),
  ]);

  const openWindowsToday = (windowsRes.data ?? []).length;

  const attempts = (attemptsRes.data ?? []) as {
    completed_at: number | null;
    score: number | null;
    disqualified: boolean | null;
    exams?: { pass_threshold?: number | null } | null;
  }[];

  const attemptsPerDayMap = new Map<string, AttemptsPerDay>();
  let attemptsToday = 0;
  let attemptsLast7Days = 0;
  let passedCount = 0;

  attempts.forEach((a) => {
    if (!a.completed_at) return;
    const ts = typeof a.completed_at === 'number' ? a.completed_at : Number(a.completed_at);
    const d = new Date(ts);
    const key = d.toISOString().slice(0, 10);
    const isToday = ts >= startOfToday.getTime();
    const threshold = a.exams?.pass_threshold ?? 0.7;
    const score = a.score ?? 0;
    const passed = !a.disqualified && score >= threshold;

    attemptsLast7Days += 1;
    if (isToday) attemptsToday += 1;
    if (passed) passedCount += 1;

    const existing =
      attemptsPerDayMap.get(key) ??
      {
        date: key,
        completed: 0,
        passed: 0,
        failedOrDisqualified: 0,
      };
    existing.completed += 1;
    if (passed) existing.passed += 1;
    else existing.failedOrDisqualified += 1;
    attemptsPerDayMap.set(key, existing);
  });

  const attemptsPerDay = Array.from(attemptsPerDayMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const passedRateLast7Days = attemptsLast7Days > 0 ? passedCount / attemptsLast7Days : 0;

  const violations = (violationsRes.data ?? []) as { event: string }[];
  const violationsLast24h: ViolationCounts = {
    focus_lost: 0,
    visibility_hidden: 0,
    fullscreen_exited: 0,
    copy_paste_blocked: 0,
    photo_taken: 0,
  };
  violations.forEach((v) => {
    if (v.event in violationsLast24h) {
      // @ts-expect-error dynamic key
      violationsLast24h[v.event] += 1;
    }
  });

  const syncFailedToday = (syncFailedRes.data ?? []).length;

  return {
    openWindowsToday,
    attemptsToday,
    attemptsLast7Days,
    passedRateLast7Days,
    attemptsPerDay,
    violationsLast24h,
    syncFailedToday,
  };
}

