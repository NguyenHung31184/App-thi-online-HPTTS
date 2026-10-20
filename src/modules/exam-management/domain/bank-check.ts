import type { BlueprintRule, QuestionBankItem } from '../../../types';

export interface BlueprintCheckRow {
  rule: BlueprintRule;
  have: number;
  ok: boolean;
}

/** Questions start_exam_attempt can draw: published, or saved before statuses existed (null). */
export function drawableQuestions(questions: QuestionBankItem[]): QuestionBankItem[] {
  return questions.filter((q) => (q.status ?? 'published') === 'published');
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

const DIFFICULTY_LABELS: Record<string, string> = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };

/** Columns of the bank sheet; the shape the shared Excel builder takes. */
export const BANK_SHEET_COLUMNS = [
  { header: 'STT', width: 6, kind: 'integer' as const },
  { header: 'Câu hỏi', width: 70 },
  { header: 'Chủ đề', width: 24 },
  { header: 'Độ khó', width: 12 },
  { header: 'Điểm', width: 8, kind: 'number' as const },
  { header: 'Số lần bốc', width: 11, kind: 'integer' as const },
  { header: 'Đáp án đúng', width: 40 },
];

/** One row per listed question, in the order of BANK_SHEET_COLUMNS; the answer column shows the correct option text. */
export function bankSheetRows(questions: QuestionBankItem[], frequency: Record<string, number>): (string | number)[][] {
  return questions.map((question, index) => {
    const options = Array.isArray(question.options) ? (question.options as { id: string; text: string }[]) : [];
    const correct = options.find((option) => option.id === question.answer_key);
    return [
      index + 1, question.stem, question.topic || '', DIFFICULTY_LABELS[question.difficulty] ?? question.difficulty,
      question.points, frequency[question.id] ?? 0, correct?.text ?? question.answer_key,
    ];
  });
}
