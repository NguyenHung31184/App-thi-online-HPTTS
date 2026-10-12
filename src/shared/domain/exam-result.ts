/** Scores use the stored ratio; rounding for display must not change the result. */
export function isExamPassed(score: number | null | undefined, disqualified: boolean | null | undefined, threshold: number): boolean {
  return score != null && Number.isFinite(score) && Number.isFinite(threshold) && !disqualified && score >= threshold;
}
