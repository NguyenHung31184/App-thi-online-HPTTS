import type { QuestionBankItem } from '../../../types';
import { listModuleQuestions } from '../../question-bank/public';
import { selectDrawnQuestionIds } from '../data/attempt-draw-repository';
import { countDraws } from '../domain/exam-inputs';

/** Questions of the exam's module, as listed on the bank check page. */
export function listQuestionsByModule(moduleId: string): Promise<QuestionBankItem[]> {
  return listModuleQuestions(moduleId);
}

/** How many attempts of the exam drew each question. */
export async function getQuestionDrawFrequency(examId: string): Promise<Record<string, number>> {
  return countDraws(await selectDrawnQuestionIds(examId));
}
