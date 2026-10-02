import type { PracticalExamCriteria, PracticalExamTemplate } from '../../../types';
import {
  deleteCriteriaRow, deleteTemplateRow, insertCriteria, insertTemplate, selectCriteria, selectTemplate, selectTemplates, updateCriteriaRow,
  updateTemplateRow,
} from '../data/template-repository';
import { newCriterionInput } from '../domain/grading';
import type { CreateCriteriaInput, CreatePracticalTemplateInput, UpdateCriteriaInput, UpdatePracticalTemplateInput } from '../domain/inputs';

export const listPracticalTemplates = (): Promise<PracticalExamTemplate[]> => selectTemplates();
export const getPracticalTemplate = (id: string): Promise<PracticalExamTemplate | null> => selectTemplate(id);
export const createPracticalTemplate = (input: CreatePracticalTemplateInput) => insertTemplate(input);
export const updatePracticalTemplate = (id: string, input: UpdatePracticalTemplateInput) => updateTemplateRow(id, input);
export const deletePracticalTemplate = (id: string): Promise<void> => deleteTemplateRow(id);

export const listCriteriaByTemplate = (templateId: string): Promise<PracticalExamCriteria[]> => selectCriteria(templateId);
export const createPracticalCriteria = (input: CreateCriteriaInput) => insertCriteria(input);
export const updatePracticalCriteria = (id: string, input: UpdateCriteriaInput) => updateCriteriaRow(id, input);
export const deletePracticalCriteria = (id: string): Promise<void> => deleteCriteriaRow(id);

/** Adds "Tiêu chí n" (10 points, weight 1) at the end of the template. */
export function addDefaultCriterion(templateId: string, existingCount: number): Promise<PracticalExamCriteria> {
  return insertCriteria(newCriterionInput(templateId, existingCount));
}
