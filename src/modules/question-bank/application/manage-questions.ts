import { XLSX_MIME, buildWorkbookBytes, excelFileName } from '../../../shared/lib/excel-workbook';
import { importCellsFor, importColumns } from '../domain/question-import';
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

/**
 * The import columns (picture column replaced by the picture link) plus the status, one row per question. Column names
 * stay on row 1 so the file can be edited and imported again.
 */
export async function buildQuestionExport(questions: LibraryQuestion[], libraryName: string): Promise<{ fileName: string; blob: Blob }> {
  const columns = [...importColumns().slice(0, -1), { header: 'Link ảnh', width: 30 }, { header: 'Trạng thái', width: 14 }];
  const rows = questions.map((question) => [...importCellsFor(question), question.imageUrl ?? '', QUESTION_STATUS_LABELS[question.status]]);
  const bytes = await buildWorkbookBytes([{ name: 'Cau_hoi', columns, rows }]);
  return { fileName: excelFileName(`Cau-hoi ${libraryName}`), blob: new Blob([bytes], { type: XLSX_MIME }) };
}
