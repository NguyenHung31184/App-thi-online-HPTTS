import { describe, expect, it } from 'vitest';
import type { QuestionBankItem } from '../../../types';
import { bankCsv, bankCsvFileName, blueprintCheck, simulateDraw } from './bank-check';

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

describe('bankCsv', () => {
  it('writes the BOM, quotes cells and puts the correct answer text last', () => {
    const csv = bankCsv([bank[0]], { '1': 4 });
    expect(csv.startsWith('﻿"#","Câu hỏi"')).toBe(true);
    expect(csv.split('\n')[1]).toBe('"1","Câu 1","An toàn","medium","2","4","Đúng ""thật"""');
    expect(bankCsvFileName('Cấu tạo và nguyên lý vận hành cần trục giàn QC')).toBe('ngan-hang-Cấu-tạo-và-nguyên-lý-vận-hành-.csv');
  });
});
