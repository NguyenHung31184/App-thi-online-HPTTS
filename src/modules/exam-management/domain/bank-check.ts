import type { BlueprintRule, QuestionBankItem } from '../../../types';

export interface BlueprintCheckRow {
  rule: BlueprintRule;
  have: number;
  ok: boolean;
}

/**
 * How many bank questions match each blueprint rule ("*" = any topic or difficulty); empty without a blueprint.
 * Counts per rule independently, as the bank check page always showed (the draw itself is checked by question-bank).
 */
export function blueprintCheck(questions: QuestionBankItem[], blueprint: BlueprintRule[]): BlueprintCheckRow[] {
  const byTopicDiff: Record<string, number> = {};
  const byDiff: Record<string, number> = {};
  const byTopic: Record<string, number> = {};
  for (const question of questions) {
    const topic = question.topic || '';
    const difficulty = question.difficulty || '';
    byTopicDiff[`${topic}|${difficulty}`] = (byTopicDiff[`${topic}|${difficulty}`] ?? 0) + 1;
    byDiff[difficulty] = (byDiff[difficulty] ?? 0) + 1;
    byTopic[topic] = (byTopic[topic] ?? 0) + 1;
  }
  return blueprint.map((rule) => {
    const topic = rule.topic ?? '';
    const difficulty = rule.difficulty ?? '';
    const have =
      topic === '*' && difficulty === '*' ? questions.length
        : topic === '*' ? (byDiff[difficulty] ?? 0)
          : difficulty === '*' ? (byTopic[topic] ?? 0)
            : (byTopicDiff[`${topic}|${difficulty}`] ?? 0);
    return { rule, have, ok: have >= rule.count };
  });
}

/** One simulated draw: each rule takes `count` random questions not taken by an earlier rule. */
export function simulateDraw(questions: QuestionBankItem[], blueprint: BlueprintRule[], random: () => number): QuestionBankItem[] {
  const usedIds = new Set<string>();
  const result: QuestionBankItem[] = [];
  for (const rule of blueprint) {
    const pool = questions.filter((question) => {
      if (usedIds.has(question.id)) return false;
      if (rule.topic !== '*' && question.topic !== rule.topic) return false;
      if (rule.difficulty !== '*' && question.difficulty !== rule.difficulty) return false;
      return true;
    });
    const shuffled = [...pool].sort(() => random() - 0.5);
    for (const question of shuffled.slice(0, rule.count)) {
      result.push(question);
      usedIds.add(question.id);
    }
  }
  return result;
}

/** CSV of the listed questions with their draw count and correct answer text (Excel reads it with the BOM). */
export function bankCsv(questions: QuestionBankItem[], frequency: Record<string, number>): string {
  const header = ['#', 'Câu hỏi', 'Chủ đề', 'Độ khó', 'Điểm', 'Số lần bốc', 'Đáp án đúng'];
  const rows = questions.map((question, index) => {
    const options = Array.isArray(question.options) ? (question.options as { id: string; text: string }[]) : [];
    const correct = options.find((option) => option.id === question.answer_key);
    return [String(index + 1), question.stem, question.topic || '', question.difficulty, String(question.points), String(frequency[question.id] ?? 0), correct?.text ?? question.answer_key];
  });
  return '﻿' + [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function bankCsvFileName(examTitle: string): string {
  return `ngan-hang-${examTitle.slice(0, 30).replace(/\s+/g, '-')}.csv`;
}
