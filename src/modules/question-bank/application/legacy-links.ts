import { findActiveLibraryIdForModule } from '../data/question-library-repository';
import { getQuestion } from '../data/question-repository';

export type LegacyTarget = 'questions' | 'new' | 'import' | 'question';

const LIBRARIES = '/admin/question-libraries';

/** Where an old /admin/questions/occupation/... URL now lives; the library list when it cannot be matched. */
export async function resolveLegacyQuestionBankPath({ target, moduleId, questionId }: { target: LegacyTarget; moduleId: string | null; questionId: string | null }): Promise<string> {
  if (target === 'question') {
    const question = questionId ? await getQuestion(questionId) : null;
    return question?.libraryId ? `${LIBRARIES}/${question.libraryId}/questions/${question.id}` : LIBRARIES;
  }
  const libraryId = moduleId ? await findActiveLibraryIdForModule(moduleId) : null;
  if (!libraryId) return LIBRARIES;
  return `${LIBRARIES}/${libraryId}/questions${target === 'questions' ? '' : `/${target}`}`;
}
