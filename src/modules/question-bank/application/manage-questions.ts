import * as XLSX from 'xlsx';
import { IMPORT_HEADER, importCellsFor } from '../domain/question-import';
import { QUESTION_STATUS_LABELS, type LibraryQuestion, type QuestionStatus } from '../domain/question-library';
import { findQuestionsUsedInAttempts, setQuestionsStatus, softDeleteQuestions } from '../data/question-repository';

export interface ChangeStatusInput {
  libraryId: string;
  ids: string[];
  status: QuestionStatus;
}

export function changeQuestionStatus({ libraryId, ids, status }: ChangeStatusInput): Promise<number> {
  return setQuestionsStatus(libraryId, ids, status);
}

export interface RemoveResult {
  deleted: number;
  retired: number;
}

/**
 * grade_attempt skips deleted rows, so deleting a question a student has already been given would change
 * that score on a regrade and drop it from the review screen. Such questions are retired instead.
 */
export async function removeQuestions({ libraryId, ids }: { libraryId: string; ids: string[] }): Promise<RemoveResult> {
  const used = await findQuestionsUsedInAttempts(ids);
  const unused = ids.filter((id) => !used.has(id));
  const retired = used.size > 0 ? await setQuestionsStatus(libraryId, [...used], 'retired') : 0;
  const deleted = unused.length > 0 ? await softDeleteQuestions(libraryId, unused) : 0;
  return { deleted, retired };
}

/** The import columns (picture column replaced by the picture link) plus the status, one row per question. */
export function buildQuestionExport(questions: LibraryQuestion[], libraryName: string): { fileName: string; blob: Blob } {
  const header = [...IMPORT_HEADER.slice(0, -1), 'Link ảnh', 'Trạng thái'];
  const rows = questions.map((question) => [...importCellsFor(question), question.imageUrl ?? '', QUESTION_STATUS_LABELS[question.status]]);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet['!cols'] = header.map((_, index) => ({ wch: index === 0 ? 60 : 20 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Cau_hoi');
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const safeName = libraryName.replace(/[/\\?%*:|"<>·]/g, '-').replace(/\s+/g, ' ').trim();
  return {
    fileName: `Cau-hoi ${safeName}.xlsx`,
    blob: new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  };
}
