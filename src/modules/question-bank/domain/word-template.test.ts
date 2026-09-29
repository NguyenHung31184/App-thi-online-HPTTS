import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { readDocxBlocks } from './docx-reader';
import { buildWordSheet, proposeMarking, readWordQuestions } from './word-questions';

// The Word template offered on the import screen (built by scripts/build-word-template.py) must read back cleanly.
describe('Word template', () => {
  it('reads every example question without an error or a note', async () => {
    const zip = await JSZip.loadAsync(readFileSync('public/templates/Mau_soan_de_Word.docx'));
    const part = (name: string) => zip.file(name)?.async('string') ?? Promise.resolve(null);
    const blocks = readDocxBlocks({
      document: (await part('word/document.xml')) ?? '',
      numbering: await part('word/numbering.xml'),
      relationships: await part('word/_rels/document.xml.rels'),
    });
    const document = readWordQuestions(blocks);
    const sheet = buildWordSheet(document, proposeMarking(document));
    expect(sheet.errors).toEqual([]);
    expect(sheet.rows.map((row) => [row.label, row.questionType, row.answer, row.reviewNotes.length, Boolean(row.imagePath)])).toEqual([
      ['Câu 1', 'Trắc nghiệm', 'A', 0, false],
      ['Câu 2', 'Nhiều đáp án', 'A;B', 0, false],
      ['Câu 3', 'Đúng/Sai', 'Đ;S;Đ;S', 0, false],
      ['Câu 4', 'Nối đôi', '', 0, false],
      ['Câu 5', 'Kéo thả', 'A;B;C;D', 0, false],
      ['Câu 6', 'Tự luận', '', 0, false],
      ['Câu 7', 'Trắc nghiệm', 'B', 0, true],
    ]);
  });
});
