import type { Attempt, Exam } from '../../../types';
import { DEFAULT_PASS_THRESHOLD } from './report-rows';
import { isExamPassed } from '../../../shared/domain/exam-result';

export interface ReviewOption {
  id: string;
  text: string;
}

export interface QuestionReviewItem {
  id: string;
  stem: string;
  options: ReviewOption[];
  answer_key: string;
  points: number;
  topic: string;
  image_url: string | null;
  question_type: string;
  chosen: string | null;
  correct: boolean;
  /** Essay question: a teacher scores it against the key points, so there is no right or wrong here. */
  manual: boolean;
}

/** A question as stored in `question_bank` or the legacy `questions` table. */
export interface ReviewQuestionRecord {
  id: string;
  stem: string;
  options: unknown;
  answer_key: string;
  points: number;
  topic: string;
  image_url?: string | null;
  question_type?: string;
}

export interface StudentFacts {
  name: string | null;
  dob: string | null;
  cccd: string | null;
}

export function parseOptions(raw: unknown): ReviewOption[] {
  if (Array.isArray(raw)) return raw as ReviewOption[];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as ReviewOption[];
    } catch {
      return [];
    }
  }
  return [];
}

export function optionLabel(options: ReviewOption[], key: string | null): string {
  if (!key) return '— (chưa chọn)';
  return options.find((o) => o.id === key)?.text ?? key;
}

const ESSAY_TYPES = new Set(['video_paragraph', 'main_idea']);
const ORDER_TYPES = new Set(['drag_drop', 'ordering']);

export function isEssayQuestion(questionType: string): boolean {
  return ESSAY_TYPES.has(questionType);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A matching key is stored as { right: texts, map: { leftId: position from 1 } }. */
function matchingKeyOf(answerKey: string): { right: string[]; map: Record<string, string> } | null {
  const parsed = parseJson(answerKey);
  if (!isRecord(parsed) || !Array.isArray(parsed.right) || !isRecord(parsed.map)) return null;
  const map: Record<string, string> = {};
  for (const [left, position] of Object.entries(parsed.map)) map[left] = String(position);
  return { right: parsed.right.map((text) => String(text ?? '')), map };
}

/** Right-hand texts of a matching question, in stored order; empty for any other key. */
export function matchingRightOf(answerKey: string): string[] {
  return matchingKeyOf(answerKey)?.right ?? [];
}

/**
 * The answer in words, one line per part: option text, a Đúng/Sai line per statement, the order, the pairs of a
 * matching question, or the key points of an essay. `matchingRight` turns a student's position into its text.
 */
export function answerLines(
  options: ReviewOption[],
  key: string | null,
  questionType: string,
  matchingRight: string[] = [],
): string[] {
  if (!key) return ['— (chưa chọn)'];
  const parsed = key.startsWith('[') || key.startsWith('{') ? parseJson(key) : undefined;

  if (isEssayQuestion(questionType)) {
    // The key is [{ text, points }]; a student's answer is plain text.
    if (!Array.isArray(parsed)) return [key];
    const points = parsed.filter(isRecord).map((item) => `${String(item.text ?? '')} (${Number(item.points ?? 0)} điểm)`);
    return points.length > 0 ? points : [key];
  }

  if (questionType === 'matching' && isRecord(parsed)) {
    const stored = matchingKeyOf(key);
    const right = stored?.right ?? matchingRight;
    const pairs = stored?.map ?? parsed;
    return Object.entries(pairs).map(([left, position]) => {
      const text = right[Number(position) - 1];
      return `${optionLabel(options, left)} ↔ ${text || (position ? String(position) : '(chưa nối)')}`;
    });
  }

  if (Array.isArray(parsed)) {
    const values = parsed.map((value) => String(value));
    if (questionType === 'true_false_multi' || values.every((value) => value === 'T' || value === 'F' || value === '')) {
      const words = values.map((value) => (value === 'T' ? 'Đúng' : value === 'F' ? 'Sai' : '(chưa chọn)'));
      return words.length === options.length
        ? words.map((word, index) => `${options[index].text}: ${word}`)
        : [words.join(' / ')];
    }
    const texts = values.map((id) => optionLabel(options, id));
    return ORDER_TYPES.has(questionType) ? [texts.join(' → ')] : texts;
  }

  if (isRecord(parsed)) {
    return Object.entries(parsed).map(([left, value]) => `${optionLabel(options, left)} ↔ ${String(value)}`);
  }
  return [optionLabel(options, key)];
}

export function answerLabel(options: ReviewOption[], key: string | null, questionType: string, matchingRight: string[] = []): string {
  return answerLines(options, key, questionType, matchingRight).join('\n');
}

export function formatAttemptDuration(startedAt: number, completedAt: number | null | undefined): string {
  if (!completedAt || completedAt <= 0) return '—';
  const ms = completedAt - startedAt;
  if (ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)} phút ${totalSec % 60} giây`;
}

export function normalizePrintable(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pickFirstString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = normalizePrintable(row[key]);
    if (v) return v;
  }
  return null;
}

/** Name, date of birth and CCCD from a TTDT student row, whichever column names it uses. */
export function studentFactsOf(row: Record<string, unknown> | null): StudentFacts {
  if (!row) return { name: null, dob: null, cccd: null };
  return {
    name: pickFirstString(row, ['name', 'full_name', 'student_name']),
    dob: pickFirstString(row, ['student_dob', 'dob', 'date_of_birth']),
    cccd: pickFirstString(row, ['id_card_number', 'cccd', 'id_number']),
  };
}

/** Keeps the attempt's question order; ids missing from the bank are skipped. */
export function orderByIds<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  const byId = Object.fromEntries(rows.map((q) => [q.id, q]));
  return ids.map((id) => byId[id]).filter(Boolean);
}

function isCorrect(chosen: string | null, answerKey: string, questionType: string): boolean {
  if (chosen === null || isEssayQuestion(questionType)) return false;
  if (chosen === answerKey) return true;
  const answer = parseJson(chosen);
  if (questionType === 'matching') {
    // The stored key also carries the right-hand texts; only the pairs are compared.
    const key = matchingKeyOf(answerKey);
    if (!key || !isRecord(answer)) return false;
    return Object.entries(key.map).every(([left, position]) => String(answer[left] ?? '') === position);
  }
  const key = parseJson(answerKey);
  if (answer === undefined || key === undefined) return false;
  if (questionType === 'multiple_choice' && Array.isArray(answer) && Array.isArray(key)) {
    // Ticked options have no order.
    return JSON.stringify([...answer].map(String).sort()) === JSON.stringify([...key].map(String).sort());
  }
  return JSON.stringify(answer) === JSON.stringify(key);
}

export function toReviewItems(questions: ReviewQuestionRecord[], answers: Record<string, string>): QuestionReviewItem[] {
  return questions.map((q) => {
    const chosen = answers[q.id] ?? null;
    const questionType = q.question_type ?? 'multiple_choice';
    return {
      id: q.id,
      stem: q.stem,
      options: parseOptions(q.options),
      answer_key: q.answer_key,
      points: typeof q.points === 'number' ? q.points : Number(q.points) || 0,
      topic: q.topic ?? '',
      image_url: q.image_url ?? null,
      question_type: questionType,
      chosen,
      correct: isCorrect(chosen, q.answer_key, questionType),
      manual: isEssayQuestion(questionType),
    };
  });
}

export interface AttemptScore {
  earned: number;
  denom: number | null;
  passValue: number | null;
  passed: boolean;
}

/** Points and pass decision for the stored result. */
export function attemptScore(attempt: Attempt, exam: Exam): AttemptScore {
  const threshold = exam.pass_threshold ?? DEFAULT_PASS_THRESHOLD;
  const scoreNum = attempt.score ?? 0;
  const denom =
    (typeof attempt.total_max === 'number' ? attempt.total_max : null) ??
    (typeof exam.total_questions === 'number' && exam.total_questions > 0 ? exam.total_questions : null);
  const earned =
    typeof attempt.raw_score === 'number'
      ? attempt.raw_score
      : typeof scoreNum === 'number' && typeof denom === 'number'
        ? scoreNum * denom
        : 0;
  const passValue = typeof denom === 'number' ? threshold * denom : null;
  const passed = isExamPassed(attempt.score, attempt.disqualified, threshold);
  return { earned, denom, passValue, passed };
}
