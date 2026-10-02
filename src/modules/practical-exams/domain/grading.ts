import type { PracticalAttempt, PracticalAttemptScore, PracticalExamCriteria } from '../../../types';

/** Sum of score × weight; a criterion without a score counts 0, without a weight counts 1. */
export function weightedTotal(criteria: Pick<PracticalExamCriteria, 'id' | 'weight'>[], scores: Record<string, number>): number {
  let total = 0;
  for (const c of criteria) total += (scores[c.id] ?? 0) * (c.weight ?? 1);
  return total;
}

export function scoresByCriteria(rows: Pick<PracticalAttemptScore, 'criteria_id' | 'score'>[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of rows) map[r.criteria_id] = r.score;
  return map;
}

/** Slider range of a criterion: 0 to max_score (10 when unset), in steps of score_step (1 when unset). */
export function scoreRange(c: Pick<PracticalExamCriteria, 'max_score' | 'score_step'>): { max: number; step: number } {
  return { max: c.max_score ?? 10, step: c.score_step ?? 1 };
}

/** The next criterion added to a template: "Tiêu chí n", 10 points, weight 1, at the end. */
export function newCriterionInput(templateId: string, existingCount: number) {
  return {
    template_id: templateId,
    order_index: existingCount,
    name: `Tiêu chí ${existingCount + 1}`,
    max_score: 10,
    weight: 1,
  };
}

/** Why a graded attempt cannot be sent to TTDT, or null when it can. */
export function ttdtSyncBlocker(studentId: string | null, moduleId: string | null): string | null {
  if (!studentId) return 'Không tìm thấy student_id trong profiles. Thí sinh chưa được gắn với TTDT.';
  if (!moduleId) return 'Đề thi chưa gắn module_id. Vào Admin → Đề thi thực hành → chỉnh sửa để chọn mô-đun.';
  return null;
}

export function canSyncToTtdt(attempt: Pick<PracticalAttempt, 'status' | 'total_score'>): boolean {
  return attempt.status === 'graded' && attempt.total_score != null;
}
