import { supabase } from '../../../platform/supabase/client';
import { SIGNAL_EVENT_GROUP, type LiveAttemptRow, type SignalEvent } from '../domain/live-status';

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
    completedAt: row.completed_at == null ? null : num(row.completed_at),
    score: row.score == null ? null : num(row.score),
    attemptNumber: num(row.attempt_number) || 1,
    answered: num(row.answered),
    totalQuestions: num(row.total_questions),
    violations: num(row.violations),
    lastViolation: text(row.last_violation),
    disqualified: row.disqualified === true,
    secondsSinceSeen: num(row.seconds_since_seen),
    secondsSinceViolation: row.seconds_since_violation == null ? null : num(row.seconds_since_violation),
    signalCounts: null,
  };
}

/** Attempts of windows open now or closed less than 30 minutes ago (RPC checks the exam role). */
export async function fetchLiveAttempts(): Promise<LiveAttemptRow[]> {
  const { data, error } = await supabase.rpc('get_live_exam_monitor');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}

const ATTEMPTS_PER_QUERY = 100;
const LOG_PAGE = 1000;
const MAX_LOG_PAGES = 5;

/** Monitoring signals of the given attempts, one row per signal (exam staff may read the audit log). */
export async function fetchSignalEvents(attemptIds: string[]): Promise<SignalEvent[]> {
  const events: SignalEvent[] = [];
  for (let start = 0; start < attemptIds.length; start += ATTEMPTS_PER_QUERY) {
    const ids = attemptIds.slice(start, start + ATTEMPTS_PER_QUERY);
    for (let page = 0; page < MAX_LOG_PAGES; page += 1) {
      const { data, error } = await supabase
        .from('attempt_audit_logs')
        .select('attempt_id, event')
        .in('attempt_id', ids)
        .in('event', Object.keys(SIGNAL_EVENT_GROUP))
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(page * LOG_PAGE, (page + 1) * LOG_PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Row[];
      for (const row of rows) events.push({ attemptId: String(row.attempt_id), event: String(row.event) });
      if (rows.length < LOG_PAGE) break;
      if (page === MAX_LOG_PAGES - 1) throw new Error('too many monitoring signals to count');
    }
  }
  return events;
}
