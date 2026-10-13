import * as repository from '../data/exam-attempt-repository';
export const getAttempt = repository.fetchAttempt;

export const listAvailableTheoryWindows = repository.fetchAvailableTheoryWindows;
export const startTheoryAttempt = repository.startTheoryAttempt;
export const beginTheoryAttemptClock = repository.beginExamClock;
export const saveTheoryAttemptAnswers = repository.saveAttemptAnswers;
export const getTheoryAttemptWindowContext = repository.fetchAttemptWindowContext;
export const getTheoryAiProctoringState = repository.fetchAiProctoringState;
export const recordTheoryAiProctoringIncident = repository.writeAiProctoringIncident;
export const getTheoryAttemptQuestions = repository.fetchAttemptQuestions;
export const submitTheoryAttempt = repository.gradeTheoryAttempt;
export const disqualifyTheoryAttempt = repository.disqualifyTheoryAttempt;
export const recordTheoryAttemptAuditEvent = repository.writeAttemptAuditEvent;
export const reportTheoryAttemptConnection = repository.touchAttempt;
export const getBrowserProctoringState = repository.fetchBrowserProctoringState;
export const recordBrowserViolation = repository.writeBrowserViolation;
export const attachBrowserViolationEvidence = repository.attachBrowserEvidence;
