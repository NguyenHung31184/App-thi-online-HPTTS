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
export { default as TemplatesPage } from './ui/TemplatesPage';
export { default as TemplateFormPage } from './ui/template-form/TemplateFormPage';
export { default as SessionsPage } from './ui/SessionsPage';
export { default as SessionFormPage } from './ui/SessionFormPage';
export { default as GradingListPage } from './ui/GradingListPage';
export { default as GradingDetailPage } from './ui/GradingDetailPage';
export { default as PracticalTakePage } from './ui/PracticalTakePage';
