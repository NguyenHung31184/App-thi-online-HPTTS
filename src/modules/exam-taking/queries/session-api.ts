export { DEFAULT_AI_RISK_THRESHOLD, MAX_MAIN_VIOLATIONS, canRecordLeaveViolation } from '../domain/proctoring-policy';
export { optionLetter, referencesOtherOptions } from '../domain/option-order';
export { useAttemptHeartbeat } from './use-attempt-heartbeat';
export { getBrowserProctoringState, recordBrowserViolation, attachBrowserViolationEvidence } from '../application/manage-theory-attempt';
export type { BrowserProctoringState, BrowserViolationKind } from '../domain/browser-proctoring';
export type { AiProctoringState } from '../domain/exam-attempt';
export type { AiViolationKind } from '../domain/proctoring-policy';
