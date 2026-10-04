import {
  selectEnrolledStudents, selectProfileName, selectResultAttempt, selectResultAttempts, selectResultPhotos, selectResultScores, selectStudentName,
  type ResultAttemptRow, type ResultScoreRow,
} from '../data/results-repository';
import { selectClassName, selectSessionWithTemplate } from '../data/session-repository';
import { selectCriteria } from '../data/template-repository';
import { readDeductions, readFieldConfig, type Deduction } from '../domain/field-config';
import { missingPpe, resultRows, resultSummary, type ResultAttempt, type ResultRow, type ResultState, type ResultSummary } from '../domain/results';

export interface SessionResults {
  className: string;
  templateTitle: string;
  passScore: number;
  rows: ResultRow[];
  summary: ResultSummary;
}

export interface CriterionResult {
  id: string;
  name: string;
  maxScore: number;
  isTime: boolean;
  /** Null when nothing was saved for this criterion. */
  score: number | null;
  deductions: Deduction[];
}

export interface AttemptResult {
  sessionId: string;
  className: string;
  templateTitle: string;
  passScore: number;
  row: ResultRow;
  criteria: CriterionResult[];
  cycleSeconds: number[];
  missingPpe: string[];
  disqualifyReason: string | null;
  examiner: string | null;
  photos: { id: string; label: string; kind: string | null; url: string | null }[];
}

function toAttempt(row: ResultAttemptRow, scores: ResultScoreRow[]): ResultAttempt {
  const own = scores.filter((s) => s.attempt_id === row.id);
  return {
    id: row.id,
    // The old Sổ chuyên cần screens put the TTDT student id in user_id.
    studentId: String(row.student_id ?? row.user_id ?? ''),
    status: row.status,
    started: row.ppe_check != null,
    totalScore: row.total_score == null ? null : Number(row.total_score),
    isDisqualified: row.is_disqualified === true,
    syncedAt: row.synced_to_ttdt_at,
    gradedAt: row.graded_at,
    liveTotal: own.length ? own.reduce((sum, s) => sum + Number(s.score), 0) : null,
  };
}

/** Every enrolled student of the session's class with the state of their result. */
export async function loadSessionResults(sessionId: string): Promise<SessionResults | null> {
  const session = await selectSessionWithTemplate(sessionId);
  if (!session) return null;
  const [students, attempts, className] = await Promise.all([
    selectEnrolledStudents(session.class_id), selectResultAttempts(sessionId), selectClassName(session.class_id),
  ]);
  // Provisional totals are only needed for attempts still open.
  const scores = await selectResultScores(attempts.filter((a) => a.status === 'grading').map((a) => a.id));
  const passScore = Number(session.practical_exam_templates?.pass_score ?? 70);
  const rows = resultRows(students, attempts.map((a) => toAttempt(a, scores)), passScore);
  return { className: className ?? 'Lớp không rõ tên', templateTitle: session.practical_exam_templates?.title ?? '', passScore, rows, summary: resultSummary(rows) };
}

/** One student's result with everything the examiner recorded. */
export async function loadAttemptResult(attemptId: string): Promise<AttemptResult | null> {
  const attempt = await selectResultAttempt(attemptId);
  if (!attempt) return null;
  const session = await selectSessionWithTemplate(attempt.session_id);
  const template = session?.practical_exam_templates;
  if (!session || !template) return null;
  const studentId = String(attempt.student_id ?? attempt.user_id ?? '');
  const [criteria, scores, photos, student, className, examiner] = await Promise.all([
    selectCriteria(template.id), selectResultScores([attemptId]), selectResultPhotos(attemptId), selectStudentName(studentId),
    selectClassName(session.class_id), attempt.graded_by ? selectProfileName(attempt.graded_by) : Promise.resolve(null),
  ]);
  const passScore = Number(template.pass_score ?? 70);
  const row = resultRows(
    [{ id: studentId, name: student?.name ?? 'Không rõ tên', birthDate: student?.birthDate ?? null }], [toAttempt(attempt, scores)], passScore,
  )[0];
  const byCriterion = new Map(scores.map((s) => [s.criteria_id, s]));
  return {
    sessionId: session.id,
    className: className ?? 'Lớp không rõ tên',
    templateTitle: template.title,
    passScore,
    row,
    criteria: criteria.map((c) => {
      const saved = byCriterion.get(c.id);
      return {
        id: c.id, name: c.name, maxScore: c.max_score, isTime: c.kind === 'time',
        score: saved ? Number(saved.score) : null, deductions: readDeductions(saved?.deductions),
      };
    }),
    cycleSeconds: (attempt.cycle_seconds ?? []).filter((s) => Number.isFinite(s) && s > 0),
    missingPpe: attempt.ppe_check == null ? [] : missingPpe(readFieldConfig(template.config).ppe, attempt.ppe_check),
    disqualifyReason: attempt.is_disqualified ? attempt.disqualify_reason : null,
    examiner,
    photos: photos.map((p) => ({ id: p.id, label: p.label ?? '', kind: p.kind, url: p.url })),
  };
}

export type { ResultRow, ResultState, ResultSummary };
