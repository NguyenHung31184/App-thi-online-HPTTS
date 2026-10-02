import { checkBlueprintCoverage, type BlueprintCoverage } from '../domain/blueprint-coverage';
import { listDrawPool, listModuleQuestionRows } from '../data/question-repository';
import type { QuestionBankItem } from '../../../types';

/** Whether start_exam_attempt can fill the blueprint from the module's question bank. */
export async function checkExamBlueprint(moduleId: string, blueprint: unknown): Promise<BlueprintCoverage> {
  return checkBlueprintCoverage(blueprint, await listDrawPool(moduleId));
}

/** Questions the draw can use for a module: published and not deleted, the pool start_exam_attempt draws from. */
export async function countDrawableQuestions(moduleId: string): Promise<number> {
  return (await listDrawPool(moduleId)).length;
}

/** Every non-deleted question of a module, for pages that review the module's bank. */
export function listModuleQuestions(moduleId: string): Promise<QuestionBankItem[]> {
  return listModuleQuestionRows(moduleId);
}
