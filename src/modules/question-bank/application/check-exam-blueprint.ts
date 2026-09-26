import { checkBlueprintCoverage, type BlueprintCoverage } from '../domain/blueprint-coverage';
import { listDrawPool } from '../data/question-repository';

/** Whether start_exam_attempt can fill the blueprint from the module's question bank. */
export async function checkExamBlueprint(moduleId: string, blueprint: unknown): Promise<BlueprintCoverage> {
  return checkBlueprintCoverage(blueprint, await listDrawPool(moduleId));
}
