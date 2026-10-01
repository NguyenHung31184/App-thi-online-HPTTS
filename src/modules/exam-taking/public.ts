export {
  getTheoryAttemptQuestions,
  getTheoryAttemptWindowContext,
  getTheoryAiProctoringState,
  disqualifyTheoryAttempt,
  listAvailableTheoryWindows,
  recordTheoryAttemptAuditEvent,
  recordTheoryAiProctoringIncident,
  saveTheoryAttemptAnswers,
  startTheoryAttempt,
  submitTheoryAttempt,
} from './application/manage-theory-attempt';
export { optionLetter, referencesOtherOptions } from './domain/option-order';
export {
  AI_DETECTION_RULES,
  AI_RISK_WEIGHTS,
  DEFAULT_AI_RISK_THRESHOLD,
  MAX_MAIN_VIOLATIONS,
  advanceDetectionWindow,
  aiRiskPoints,
  canRecordLeaveViolation,
  createDetectionWindowState,
  shouldAutoSubmitForAi,
} from './domain/proctoring-policy';
export { examTakingKeys } from './queries/keys';
export { useAvailableTheoryWindows, useStartTheoryAttempt } from './queries/use-theory-attempt';
export { useAttemptHeartbeat } from './queries/use-attempt-heartbeat';
export { default as AvailableTheoryExamsPage } from './ui/AvailableTheoryExamsPage';
export type {
  AiProctoringState,
  Attempt,
  AttemptWindowContext,
  AvailableTheoryWindow,
  QuestionForStudent,
  RecordAiProctoringIncidentResult,
} from './domain/exam-attempt';
export type {
  AiViolationKind,
  DetectionRule,
  DetectionWindowState,
  ProctoringMode,
} from './domain/proctoring-policy';
