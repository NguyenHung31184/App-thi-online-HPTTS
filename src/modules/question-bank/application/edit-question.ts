import { validateMediaUrl } from '../../../utils/mediaUrlValidator';
import { buildQuestionPayload, draftFromQuestion, type QuestionDraft } from '../domain/question-draft';
import type { QuestionLibrary } from '../domain/question-library';
import { getQuestion, insertQuestion, updateQuestion, uploadQuestionImage } from '../data/question-repository';
import { resolveLibraryCourse } from './library-course';

export async function loadQuestionDraft(libraryId: string, questionId: string): Promise<QuestionDraft> {
  const question = await getQuestion(questionId);
  if (!question) throw new Error('Không tìm thấy câu hỏi này, hoặc câu hỏi đã bị xóa.');
  if (question.libraryId !== libraryId) throw new Error('Câu hỏi này thuộc ngân hàng khác.');
  return draftFromQuestion(question);
}

export interface SaveQuestionInput {
  library: QuestionLibrary;
  questionId: string | null;
  draft: QuestionDraft;
  imageFile: File | null;
}

/** Validates, uploads a new image if one was picked, then inserts or updates. Returns the question id. */
export async function saveQuestion({ library, questionId, draft, imageFile }: SaveQuestionInput): Promise<string> {
  const result = buildQuestionPayload(draft, validateMediaUrl, Boolean(imageFile || draft.imageUrl));
  if (!result.ok) throw new Error(result.error);

  const imageUrl = imageFile ? await uploadQuestionImage(imageFile, library.id, questionId ?? 'new') : draft.imageUrl;

  if (questionId) {
    await updateQuestion(questionId, { ...result.payload, image_url: imageUrl });
    return questionId;
  }

  return insertQuestion({
    ...result.payload,
    image_url: imageUrl,
    library_id: library.id,
    module_id: library.moduleId,
    occupation_id: await resolveLibraryCourse(library),
  });
}
