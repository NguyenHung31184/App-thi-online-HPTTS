import type { AuditEvent } from '../../../types';
import { selectReportDirectory } from '../data/directory-repository';
import { signEvidencePaths } from '../data/evidence-storage';
import { reviewIncident, selectAuditLogs, selectCompletedAttempts } from '../data/report-repository';
import {
  aiRiskPoints, classNameOf, DEFAULT_PASS_THRESHOLD, evidenceFramesOf, evidencePathsOf, evidenceUrlOf, isPassed, reviewStatusOf,
  studentDisplayName, type AttemptReportRow, type ReportFilters, type ViolationReportRow,
} from '../domain/report-rows';

const presentIds = (ids: (string | null | undefined)[]) => [...new Set(ids.filter((id): id is string => Boolean(id)))];

/** Completed attempts of an exam or a window, with student and class names. */
export async function listAttemptsForReport(filters: ReportFilters): Promise<AttemptReportRow[]> {
  const rows = await selectCompletedAttempts(filters);
  const directory = await selectReportDirectory(
    presentIds(rows.map((r) => r.user_id)),
    presentIds(rows.map((r) => r.exam_windows?.class_id)),
  );
  return rows.map((r) => {
    const classId = r.exam_windows?.class_id ?? '';
    const profile = r.user_id ? directory.profiles.get(r.user_id) : undefined;
    const score = r.score != null ? Number(r.score) : null;
    return {
      id: r.id,
      user_id: r.user_id,
      user_name: studentDisplayName(profile, directory),
      user_email: profile?.email ?? '',
      exam_id: r.exam_id,
      exam_title: r.exams?.title ?? '',
      window_id: r.window_id,
      class_id: classId,
      class_name: classNameOf(classId, directory),
      score,
      raw_score: r.raw_score != null ? Number(r.raw_score) : null,
      passed: isPassed(score, r.disqualified, r.exams?.pass_threshold ?? DEFAULT_PASS_THRESHOLD),
      disqualified: Boolean(r.disqualified),
      completed_at: r.completed_at != null ? new Date(r.completed_at).toLocaleString('vi-VN') : null,
      synced_to_ttdt_at: r.synced_to_ttdt_at ?? null,
    } as AttemptReportRow;
  });
}

/** Monitoring signals of an exam or a window, with names, AI points and freshly signed evidence links. */
export async function listViolationsForReport(filters: ReportFilters): Promise<ViolationReportRow[]> {
  const rows = await selectAuditLogs(filters);
  const [directory, signed] = await Promise.all([
    selectReportDirectory(presentIds(rows.map((r) => r.attempts?.user_id)), presentIds(rows.map((r) => r.attempts?.exam_windows?.class_id))),
    signEvidencePaths(rows.flatMap((r) => evidencePathsOf(r.metadata))),
  ]);
  return rows.map((r) => {
    const attempt = r.attempts;
    const userId = attempt?.user_id ?? '';
    const classId = attempt?.exam_windows?.class_id ?? '';
    const profile = directory.profiles.get(userId);
    return {
      id: r.id,
      attempt_id: r.attempt_id,
      user_id: userId,
      user_name: studentDisplayName(profile, directory),
      user_email: profile?.email ?? '',
      exam_id: attempt?.exam_id ?? '',
      exam_title: attempt?.exams?.title ?? '',
      window_id: attempt?.window_id ?? '',
      class_id: classId,
      class_name: classNameOf(classId, directory),
      event: r.event as AuditEvent,
      created_at: r.created_at ? new Date(r.created_at).toLocaleString('vi-VN') : '',
      metadata: r.metadata ?? null,
      risk_points: aiRiskPoints(r.event, r.metadata),
      review_status: reviewStatusOf(r.metadata),
      evidence_url: evidenceUrlOf(r.metadata, signed),
      evidence: evidenceFramesOf(r.metadata, signed),
    };
  });
}

export function reviewAiProctoringIncident(logId: string, decision: 'confirmed' | 'rejected'): Promise<void> {
  return reviewIncident(logId, decision);
}
