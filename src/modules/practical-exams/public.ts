export {
  addDefaultCriterion, createPracticalCriteria, createPracticalTemplate, deletePracticalCriteria, deletePracticalTemplate, getPracticalTemplate,
  listCriteriaByTemplate, listPracticalTemplates, updatePracticalCriteria, updatePracticalTemplate,
} from './application/templates';
export {
  createPracticalSession, deletePracticalSession, getAllowedPracticalSessions, getPracticalSession, getPracticalSessionWithTemplate,
  listPracticalSessions, updatePracticalSession,
} from './application/sessions';
export {
  completePracticalGrading, createPracticalAttempt, deletePracticalPhoto, getPracticalAttempt, listPracticalAttemptsBySession, listPracticalPhotos,
  listPracticalScores, submitPracticalAttempt, uploadPracticalPhoto, upsertPracticalScore,
} from './application/attempts';
export type {
  CreateCriteriaInput, CreatePracticalSessionInput, CreatePracticalTemplateInput, UpdateCriteriaInput, UpdatePracticalSessionInput,
  UpdatePracticalTemplateInput,
} from './domain/inputs';
export type { PracticalSessionWithTemplate } from './domain/sessions';
