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
  getBrowserProctoringState,
  recordBrowserViolation,
  attachBrowserViolationEvidence,
} from './application/manage-theory-attempt';
export type { BrowserProctoringState, BrowserViolationKind } from './domain/browser-proctoring';
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
export { getAttempt } from './application/manage-theory-attempt';
export { default as DashboardPage } from './ui/dashboard/DashboardPage';
export { default as ExamIntroPage } from './ui/intro/ExamIntroPage';
export { default as ExamTakePage } from './ui/session/ExamTakePage';
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
