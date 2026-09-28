import { supabase } from '../../../platform/supabase/client';
import type { LiveAttemptRow } from '../domain/live-status';

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);
const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value ?? 0) || 0);

function fromRow(row: Row): LiveAttemptRow {
  return {
    windowId: String(row.window_id),
    classId: String(row.class_id ?? ''),
    className: text(row.class_name),
    enrolled: num(row.enrolled),
    examTitle: text(row.exam_title) ?? 'Đề thi',
    isTrial: row.is_trial === true,
    windowEndAt: num(row.window_end_at),
    attemptId: String(row.attempt_id),
    studentCode: text(row.student_code),
    studentName: text(row.student_name),
    status: String(row.status ?? ''),
    startedAt: num(row.started_at),
    answered: num(row.answered),
    totalQuestions: num(row.total_questions),
    violations: num(row.violations),
    lastViolation: text(row.last_violation),
    disqualified: row.disqualified === true,
    secondsSinceSeen: num(row.seconds_since_seen),
    secondsSinceViolation: row.seconds_since_violation == null ? null : num(row.seconds_since_violation),
  };
}

/** Attempts of windows open now or closed less than 30 minutes ago (RPC checks the exam role). */
export async function fetchLiveAttempts(): Promise<LiveAttemptRow[]> {
  const { data, error } = await supabase.rpc('get_live_exam_monitor');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}
