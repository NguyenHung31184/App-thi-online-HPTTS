export type ResultState = 'waiting' | 'grading' | 'graded' | 'disqualified' | 'not_eligible';

export interface ResultStudent {
  id: string;
  name: string;
  birthDate: string | null;
}

export interface ResultAttempt {
  id: string;
  studentId: string;
  status: string;
  /** Protective equipment was recorded: grading has started. */
  started: boolean;
  totalScore: number | null;
  isDisqualified: boolean;
  syncedAt: string | null;
  gradedAt: string | null;
  /** Sum of the criterion scores saved so far, while the attempt is still open. */
  liveTotal: number | null;
}

export interface ResultRow {
  studentId: string;
  name: string;
  birthDate: string | null;
  attemptId: string | null;
  state: ResultState;
  /** Out of 100: final when locked, provisional while being graded. */
  total: number | null;
  /** What TTDT receives; only for a locked result. */
  outOf10: number | null;
  passed: boolean | null;
  synced: boolean;
  gradedAt: string | null;
}

export interface ResultSummary {
  students: number;
  done: number;
  grading: number;
  waiting: number;
  passed: number;
  notPassed: number;
  notEligible: number;
  /** Locked results TTDT does not have yet. */
  toSend: number;
}

const finished = (a: ResultAttempt) => a.status === 'graded' || a.status === 'not_eligible';

/** Per student the attempt that counts: a finished one, else one already started, else the newest (rows oldest first). */
export function currentResultAttempts(attempts: ResultAttempt[]): Record<string, ResultAttempt> {
  const rank = (a: ResultAttempt) => (finished(a) ? 2 : a.started ? 1 : 0);
  const chosen: Record<string, ResultAttempt> = {};
  for (const a of attempts) {
    const current = chosen[a.studentId];
    if (!current || rank(a) >= rank(current)) chosen[a.studentId] = a;
  }
  return chosen;
}

function rowOf(student: ResultStudent, a: ResultAttempt | undefined, passScore: number): ResultRow {
  const base = { studentId: student.id, name: student.name, birthDate: student.birthDate };
  if (!a || (!finished(a) && !a.started)) {
    return { ...base, attemptId: a?.id ?? null, state: 'waiting', total: null, outOf10: null, passed: null, synced: false, gradedAt: null };
  }
  if (a.status === 'not_eligible') {
    return { ...base, attemptId: a.id, state: 'not_eligible', total: null, outOf10: null, passed: null, synced: false, gradedAt: a.gradedAt };
  }
  if (a.status !== 'graded') {
    return { ...base, attemptId: a.id, state: 'grading', total: a.liveTotal, outOf10: null, passed: null, synced: false, gradedAt: null };
  }
  const total = a.isDisqualified ? 0 : a.totalScore ?? 0;
  return {
    ...base, attemptId: a.id, state: a.isDisqualified ? 'disqualified' : 'graded', total, outOf10: Number((total / 10).toFixed(1)),
    passed: !a.isDisqualified && total >= passScore, synced: a.syncedAt != null, gradedAt: a.gradedAt,
  };
}

/** One row per enrolled student, then students who were graded but are no longer enrolled. */
export function resultRows(students: ResultStudent[], attempts: ResultAttempt[], passScore: number): ResultRow[] {
  const current = currentResultAttempts(attempts);
  const enrolled = new Set(students.map((s) => s.id));
  const gone = Object.keys(current).filter((id) => !enrolled.has(id)).map((id) => ({ id, name: 'Không còn trong danh sách lớp', birthDate: null }));
  return [...students, ...gone].map((s) => rowOf(s, current[s.id], passScore));
}

export function resultSummary(rows: ResultRow[]): ResultSummary {
  const count = (test: (r: ResultRow) => boolean) => rows.filter(test).length;
  const locked = (r: ResultRow) => r.state === 'graded' || r.state === 'disqualified';
  return {
    students: rows.length,
    done: count((r) => locked(r) || r.state === 'not_eligible'),
    grading: count((r) => r.state === 'grading'),
    waiting: count((r) => r.state === 'waiting'),
    passed: count((r) => r.passed === true),
    notPassed: count((r) => locked(r) && r.passed === false),
    notEligible: count((r) => r.state === 'not_eligible'),
    toSend: count((r) => locked(r) && !r.synced),
  };
}

/** "3:05" for 185 seconds. */
export function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Protective equipment items the examiner did not tick. */
export function missingPpe(items: string[], check: unknown): string[] {
  const ticked = (check && typeof check === 'object' ? check : {}) as Record<string, unknown>;
  return items.filter((item) => ticked[item] !== true);
}
