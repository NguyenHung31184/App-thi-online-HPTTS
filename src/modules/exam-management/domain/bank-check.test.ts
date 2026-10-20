import { describe, expect, it } from 'vitest';
import type { QuestionBankItem } from '../../../types';
import { bankSheetRows, blueprintCheck, drawableQuestions, simulateDraw } from './bank-check';

const question = (id: string, topic: string, difficulty: string, extra: Partial<QuestionBankItem> = {}) =>
  ({ id, topic, difficulty, stem: `Câu ${id}`, points: 2, options: [{ id: 'A', text: 'Đúng "thật"' }, { id: 'B', text: 'Sai' }], answer_key: 'A', ...extra }) as unknown as QuestionBankItem;

const bank = [question('1', 'An toàn', 'medium'), question('2', 'An toàn', 'hard'), question('3', 'Cấu tạo', 'medium')];

describe('blueprintCheck', () => {
  it('counts each rule with "*" wildcards', () => {
    expect(blueprintCheck(bank, [
      { topic: '*', difficulty: '*', count: 3 },
      { topic: '*', difficulty: 'medium', count: 3 },
      { topic: 'An toàn', difficulty: '*', count: 2 },
      { topic: 'Cấu tạo', difficulty: 'hard', count: 1 },
    ]).map((row) => [row.have, row.ok])).toEqual([[3, true], [2, false], [2, true], [0, false]]);
  });

  it('is empty without a blueprint', () => {
    expect(blueprintCheck(bank, [])).toEqual([]);
  });
});

describe('simulateDraw', () => {
  it('never draws a question twice across rules', () => {
    const drawn = simulateDraw(bank, [{ topic: 'An toàn', difficulty: '*', count: 2 }, { topic: '*', difficulty: '*', count: 5 }], () => 0.3);
    expect(drawn.map((q) => q.id).sort()).toEqual(['1', '2', '3']);
  });
});

describe('bankSheetRows', () => {
  it('keeps numbers as numbers, labels the difficulty and puts the correct answer text last', () => {
    expect(bankSheetRows([bank[0]], { '1': 4 })).toEqual([[1, 'Câu 1', 'An toàn', 'Trung bình', 2, 4, 'Đúng "thật"']]);
    expect(bankSheetRows([bank[0]], {})[0][5]).toBe(0);
  });
});

describe('drawableQuestions', () => {
  it('keeps published and status-less questions, drops retired and drafts', () => {
    const pool = drawableQuestions([
      question('1', 'A', 'medium', { status: 'published' }),
      question('2', 'A', 'medium', { status: 'retired' }),
      question('3', 'A', 'medium', { status: 'draft' }),
      question('4', 'A', 'medium', { status: null }),
    ]);
    expect(pool.map((q) => q.id)).toEqual(['1', '4']);
  });
});
