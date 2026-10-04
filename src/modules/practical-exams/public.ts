export {
  addDefaultCriterion, createPracticalCriteria, createPracticalTemplate, deletePracticalCriteria, deletePracticalTemplate, getPracticalTemplate,
  listCriteriaByTemplate, listPracticalTemplates, updatePracticalCriteria, updatePracticalTemplate,
} from './application/templates';
export {
  createPracticalSession, deletePracticalSession, getPracticalSession, getPracticalSessionWithTemplate, listPracticalSessions,
  updatePracticalSession,
} from './application/sessions';
export type {
  CreateCriteriaInput, CreatePracticalSessionInput, CreatePracticalTemplateInput, UpdateCriteriaInput, UpdatePracticalSessionInput,
  UpdatePracticalTemplateInput,
} from './domain/inputs';
export type { PracticalSessionWithTemplate } from './domain/sessions';
export { default as TemplatesPage } from './ui/TemplatesPage';
export { default as TemplateFormPage } from './ui/template-form/TemplateFormPage';
export { default as TemplateImportPage } from './ui/template-import/TemplateImportPage';
export { default as SessionsPage } from './ui/SessionsPage';
export { default as SessionFormPage } from './ui/SessionFormPage';
export { default as ResultsPage } from './ui/results/ResultsPage';
export { default as ResultDetailPage } from './ui/results/ResultDetailPage';
