import { describe, expect, it } from 'vitest';
import type { QuestionType } from '../../../types';
import { emptyDraft, type QuestionDraft } from './question-draft';
import { draftFromImportRow, planDraftImport, type ImportRow } from './question-import';

const context = {
  validateMediaUrl: () => ({ valid: true }),
  imageSizes: new Map<string, number>(),
  existingKeys: new Set<string>(),
};

function source(line: number, stem: string): ImportRow {
  return {
    line,
    label: `Câu ${line}`,
    stem,
    optionTexts: ['Phương án A', 'Phương án B', 'Phương án C'],
    answer: '',
    questionType: 'Trắc nghiệm',
    keys: '',
    topic: '',
    difficulty: 'Trung bình',
    points: '2',
    imageFile: '',
    reviewNotes: ['Cần kiểm tra lại dữ liệu Word.'],
  };
}

function draft(type: QuestionType, stem: string): QuestionDraft {
  const result = emptyDraft();
  result.questionType = type;
  result.stem = stem;
  result.options[0].text = 'Nội dung A';
  result.options[1].text = 'Nội dung B';
  result.options[2].text = 'Nội dung C';
  result.singleAnswer = 'B';
  result.multipleAnswers = ['A', 'C'];
  result.zoneAnswers = ['C', 'A', 'B'];
  result.trueFalse = ['T', 'F', 'T'];
  result.matchingRight = ['Ghép A', 'Ghép B', 'Ghép C'];
  result.essayKeys = [{ text: 'Ý chấm', points: 2 }];
  result.mediaUrl = type === 'video_paragraph' ? 'https://example.com/video' : '';
  return result;
}

describe('editable Word import drafts', () => {
  it('moves an unanswered choice question into ready after an answer is selected', () => {
    const row = source(1, 'Chọn phương án đúng.');
    const parsed = draftFromImportRow(row, true);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const before = planDraftImport([{ source: row, draft: parsed.draft }], context);
    expect(before.ready).toEqual([]);
    expect(before.errors[0].reason).toBe('Chọn đáp án đúng.');

    const edited = { ...parsed.draft, singleAnswer: 'B' };
    const after = planDraftImport([{ source: row, draft: edited, confirmed: true }], context);
    expect(after.errors).toEqual([]);
    expect(after.ready[0]).toMatchObject({ label: 'Câu 1', needsReview: false, payload: { answer_key: 'B' } });
  });

  it('builds the saved payload from edits for every question type', () => {
    const types: QuestionType[] = [
      'single_choice',
      'multiple_choice',
      'drag_drop',
      'true_false_multi',
      'matching',
      'video_paragraph',
      'main_idea',
    ];
    const rows = types.map((type, index) => {
      const stem = `Câu đã sửa ${type}`;
      return { source: source(index + 1, stem), draft: draft(type, stem), confirmed: true };
    });

    const plan = planDraftImport(rows, context);

    expect(plan.errors).toEqual([]);
    expect(plan.duplicates).toEqual([]);
    expect(plan.ready.map((row) => row.payload.question_type)).toEqual(types);
    expect(plan.ready.every((row) => !row.needsReview)).toBe(true);
    expect(plan.ready[1].payload.answer_key).toBe('["A","C"]');
    expect(plan.ready[2].payload.answer_key).toBe('["C","A","B"]');
    expect(plan.ready[3].payload.answer_key).toBe('["T","F","T"]');
    expect(JSON.parse(plan.ready[4].payload.answer_key)).toEqual({ right: ['Ghép A', 'Ghép B', 'Ghép C'], map: { A: '1', B: '2', C: '3' } });
    expect(plan.ready[5].payload.media_url).toBe('https://example.com/video');
    expect(JSON.parse(plan.ready[6].payload.answer_key)).toEqual([{ text: 'Ý chấm', points: 2 }]);
  });
});
