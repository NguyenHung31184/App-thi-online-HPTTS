import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { draftFromImportRow, readImportSheet } from '../domain/question-import';
import type { LibraryQuestion } from '../domain/question-library';
import { buildImportTemplate } from './import-questions';
import { buildQuestionExport } from './manage-questions';

// The files are built with exceljs and read back with SheetJS, as the import page does.
async function sheets(blob: Blob) {
  const book = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
  const cells = (name: string) => XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, defval: '', blankrows: true });
  return { names: book.SheetNames, cells };
}

describe('question Excel files read back by the importer', { timeout: 20_000 }, () => {
  it('template: empty Cau_hoi first, every Vi_du example imports', async () => {
    const { names, cells } = await sheets((await buildImportTemplate('spreadsheet')).blob);
    expect(names).toEqual(['Cau_hoi', 'Vi_du']);
    const empty = readImportSheet(cells('Cau_hoi'));
    expect(empty.headerRecognized).toBe(true);
    expect(empty.rows).toEqual([]);
    const examples = readImportSheet(cells('Vi_du').slice(0, 7)).rows;
    expect(examples).toHaveLength(6);
    for (const row of examples) expect(draftFromImportRow(row).ok).toBe(true);
  });

  it('export: a question comes back with the same stem, answer and points', async () => {
    const question: LibraryQuestion = {
      id: 'q1', libraryId: 'l', taxonomyNodeId: null, questionType: 'single_choice', stem: 'Máy nâng dùng để làm gì?',
      options: [{ id: 'A', text: 'Nâng hàng' }, { id: 'B', text: 'Lái xe' }], answerKey: 'A', points: 2, topic: 'Cơ bản',
      difficulty: 'easy', cognitiveLevel: null, status: 'published', imageUrl: null, mediaUrl: null, createdAt: null,
    };
    const exported = await buildQuestionExport([question], 'QC: bậc 1/2');
    expect(exported.fileName).toBe('Cau-hoi QC- bậc 1-2.xlsx');
    const { cells } = await sheets(exported.blob);
    const sheet = readImportSheet(cells('Cau_hoi'));
    expect(sheet.headerRecognized).toBe(true);
    const drafted = draftFromImportRow(sheet.rows[0]);
    expect(drafted.ok && [drafted.draft.stem, drafted.draft.singleAnswer, drafted.draft.points]).toEqual(['Máy nâng dùng để làm gì?', 'A', 2]);
  });
});
