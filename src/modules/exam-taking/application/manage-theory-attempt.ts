import * as repository from '../data/exam-attempt-repository';

export const listAvailableTheoryWindows = repository.fetchAvailableTheoryWindows;
export const startTheoryAttempt = repository.startTheoryAttempt;
export const saveTheoryAttemptAnswers = repository.saveAttemptAnswers;
export const getTheoryAttemptWindowContext = repository.fetchAttemptWindowContext;
export const getTheoryAttemptQuestions = repository.fetchAttemptQuestions;
export const submitTheoryAttempt = repository.gradeTheoryAttempt;
export const disqualifyTheoryAttempt = repository.disqualifyTheoryAttempt;
export const recordTheoryAttemptAuditEvent = repository.writeAttemptAuditEvent;
