import type { Attempt, Exam } from '../../../types';
import { DEFAULT_PASS_THRESHOLD } from './report-rows';

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

const COMPLEX_TYPES = new Set(['true_false_multi', 'matching', 'drag_drop', 'ordering']);

/** The answer in words for each question type: option text, Đúng/Sai list, order, or pairs. */
export function answerLabel(options: ReviewOption[], key: string | null, questionType: string): string {
  if (!key) return '— (chưa chọn)';
  if (!COMPLEX_TYPES.has(questionType)) return optionLabel(options, key);
  try {
    const parsed = JSON.parse(key);
    if (Array.isArray(parsed)) {
      // true_false_multi: ["T","F","T"]; drag_drop and ordering: option ids in order.
      if (typeof parsed[0] === 'string' && (parsed[0] === 'T' || parsed[0] === 'F')) {
        return parsed.map((v: string) => (v === 'T' ? 'Đúng' : 'Sai')).join(' / ');
      }
      return parsed.map((id: string) => optionLabel(options, id)).join(' → ');
    }
    if (typeof parsed === 'object' && parsed !== null) {
      // matching: { leftId: rightId }
      return Object.entries(parsed as Record<string, string>).map(([l, r]) => `${optionLabel(options, l)} ↔ ${r}`).join(', ');
    }
    return String(parsed);
  } catch {
    return key;
  }
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
  if (chosen === null) return false;
  if (questionType === 'multiple_choice' || questionType === 'true_false') return chosen === answerKey;
  // JSON answers compare after normalising.
  try {
    return JSON.stringify(JSON.parse(chosen)) === JSON.stringify(JSON.parse(answerKey));
  } catch {
    return chosen === answerKey;
  }
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
    };
  });
}

export interface AttemptScore {
  earned: number;
  denom: number | null;
  passValue: number | null;
  passed: boolean;
}

/**
 * Points earned out of the attempt's maximum (else the exam's question count). Pass compares the rounded values shown on
 * screen, so "70 / 100" never reads as failed because of fractional points (true_false_multi, matching).
 */
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
  const passed = !attempt.disqualified && (passValue !== null ? Math.round(earned) >= Math.round(passValue) : scoreNum >= threshold);
  return { earned, denom, passValue, passed };
}
