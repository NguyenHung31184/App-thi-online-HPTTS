import type { QuestionType } from '../../../types';
import type { QuestionStatus } from './question-library';

// Encodings below are read by grade_attempt and the student exam screen; they follow what the legacy
// form (pages/admin/AdminQuestionBankFormPage) writes, type by type. Three legacy behaviours are not
// copied because opening and saving a question would change it: drag_drop is not forced to 4 labels,
// essay key points are not re-spread on load, and zone positions are written only for a label-on-image
// question (see isLabelOnImage).

export const OPTION_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
export const QUESTION_TYPES: QuestionType[] = ['single_choice', 'multiple_choice', 'drag_drop', 'true_false_multi', 'matching', 'video_paragraph', 'main_idea'];
const DEFAULT_ZONE_POSITIONS: ZonePosition[] = [
  { x: 10, y: 10 },
  { x: 70, y: 10 },
  { x: 10, y: 70 },
  { x: 70, y: 70 },
];

/** Default zone spots for `count` labels: the legacy four corners, then two columns further down. */
export function defaultZonePositions(count: number): ZonePosition[] {
  return Array.from({ length: count }, (_, index) => DEFAULT_ZONE_POSITIONS[index] ?? { x: index % 2 === 0 ? 10 : 70, y: Math.min(90, 10 + Math.floor(index / 2) * 30) });
}

export interface ZonePosition { x: number; y: number }
export interface EssayKey { text: string; points: number }
export interface QuestionOption { id: string; text: string }

export interface QuestionDraft {
  questionType: QuestionType;
  stem: string;
  /** Always A–J, empty text for unused slots. */
  options: QuestionOption[];
  singleAnswer: string;
  multipleAnswers: string[];
  /** drag_drop: the label id expected in zone 1..n, one zone per label. */
  zoneAnswers: string[];
  zonePositions: ZonePosition[];
  /** true_false_multi: one entry per statement, in option order. */
  trueFalse: ('T' | 'F')[];
  /** matching: right-hand text for the option at the same index. */
  matchingRight: string[];
  essayKeys: EssayKey[];
  rubricText: string;
  mediaUrl: string;
  points: number;
  topic: string;
  difficulty: string;
  status: QuestionStatus;
  imageUrl: string | null;
}

/** A question_bank row as the editor needs it. */
export interface StoredQuestion {
  questionType: string;
  stem: string;
  options: unknown;
  answerKey: string;
  points: number | null;
  topic: string | null;
  difficulty: string | null;
  status: QuestionStatus;
  imageUrl: string | null;
  mediaUrl: string | null;
  rubric: unknown;
}

/** Fields written to question_bank. `undefined` means "leave the column as it is". */
export interface QuestionPayload {
  question_type: QuestionType;
  stem: string;
  options: QuestionOption[];
  answer_key: string;
  points: number;
  topic: string;
  difficulty: string;
  status: QuestionStatus;
  media_url?: string | null;
  rubric?: unknown;
}

export type PayloadResult = { ok: true; payload: QuestionPayload } | { ok: false; error: string };

export function isEssayType(type: QuestionType): boolean {
  return type === 'video_paragraph' || type === 'main_idea';
}

export function emptyOptions(): QuestionOption[] {
  return OPTION_IDS.map((id) => ({ id, text: '' }));
}

export function emptyDraft(): QuestionDraft {
  return {
    questionType: 'single_choice',
    stem: '',
    options: emptyOptions(),
    singleAnswer: 'A',
    multipleAnswers: [],
    zoneAnswers: ['A', 'B', 'C', 'D'],
    zonePositions: defaultZonePositions(4),
    trueFalse: [],
    matchingRight: [],
    essayKeys: [],
    rubricText: '',
    mediaUrl: '',
    points: 2,
    topic: '',
    difficulty: 'medium',
    status: 'published',
    imageUrl: null,
  };
}

/** Splits the question's points evenly over the keys; the last key takes the rounding rest. */
export function distributeEssayPoints(keys: EssayKey[], totalPoints: number): EssayKey[] {
  if (keys.length === 0) return keys;
  const each = Math.round((totalPoints / keys.length) * 100) / 100;
  return keys.map((key, index) => ({
    ...key,
    points: index < keys.length - 1 ? each : Math.round((totalPoints - each * (keys.length - 1)) * 100) / 100,
  }));
}

/** Option slots to show: at least 4, one empty slot after the last filled one, at most 10. */
export function visibleOptionCount(options: QuestionOption[]): number {
  const filled = options.filter((option) => option.text.trim() !== '').length;
  return Math.min(OPTION_IDS.length, Math.max(4, filled + 1));
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string' || value.trim() === '') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function toOptions(raw: unknown): QuestionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { id: unknown; text: unknown } => typeof item === 'object' && item !== null && 'id' in item)
    .map((item) => ({ id: String(item.id), text: typeof item.text === 'string' ? item.text : '' }));
}

export function draftFromQuestion(question: StoredQuestion): QuestionDraft {
  const draft = emptyDraft();
  const type = (QUESTION_TYPES as string[]).includes(question.questionType) ? question.questionType as QuestionType : 'single_choice';
  const loaded = toOptions(question.options);
  const present = new Set(loaded.map((option) => option.id));
  const answerKey = (question.answerKey ?? '').trim();
  const parsedKey = answerKey.startsWith('[') || answerKey.startsWith('{') ? parseJson(answerKey) : undefined;

  draft.questionType = type;
  draft.stem = question.stem ?? '';
  draft.options = [...loaded, ...OPTION_IDS.filter((id) => !present.has(id)).map((id) => ({ id, text: '' }))];
  draft.points = question.points ?? 2;
  draft.topic = question.topic ?? '';
  draft.difficulty = question.difficulty ?? 'medium';
  draft.status = question.status;
  draft.imageUrl = question.imageUrl;
  draft.mediaUrl = question.mediaUrl ?? '';

  if (Array.isArray(parsedKey)) {
    const ids = parsedKey.map(String);
    draft.singleAnswer = ids[0] || 'A';
    draft.multipleAnswers = ids;
    if (type === 'drag_drop' && ids.length > 0) draft.zoneAnswers = ids;
  } else {
    draft.singleAnswer = answerKey.slice(0, 1) || 'A';
    draft.multipleAnswers = [draft.singleAnswer];
  }
  if (type === 'true_false_multi' && Array.isArray(parsedKey)) {
    draft.trueFalse = parsedKey.map((value) => (value === 'F' ? 'F' : 'T'));
  }
  if (type === 'matching' && parsedKey && typeof parsedKey === 'object' && !Array.isArray(parsedKey)) {
    const { right, map } = parsedKey as { right?: unknown; map?: Record<string, unknown> };
    if (Array.isArray(right)) {
      const rightTexts = right.map((value) => String(value ?? ''));
      // Older imports stored a non-sequential map; line each right-hand text up with its left option.
      draft.matchingRight = loaded.map((option, index) => {
        const position = Number(map?.[option.id]);
        return position >= 1 && position <= rightTexts.length ? rightTexts[position - 1] : rightTexts[index] ?? '';
      });
    }
  }
  if (isEssayType(type) && Array.isArray(parsedKey)) {
    const keys = parsedKey.filter((item): item is { text: unknown; points: unknown } => typeof item === 'object' && item !== null && 'text' in item)
      .map((item) => ({ text: String(item.text ?? ''), points: Number(item.points ?? 0) }));
    draft.essayKeys = keys;
  }

  const rubric = parseJson(question.rubric);
  draft.rubricText = typeof question.rubric === 'string' ? question.rubric : question.rubric ? JSON.stringify(question.rubric, null, 2) : '';
  const zones = rubric && typeof rubric === 'object' ? (rubric as { zones?: unknown }).zones : undefined;
  if (Array.isArray(zones) && zones.length > 0) {
    draft.zonePositions = zones.map((zone: { x?: unknown; y?: unknown }) => ({ x: Number(zone?.x) || 10, y: Number(zone?.y) || 10 }));
  } else if (type === 'drag_drop') {
    draft.zonePositions = defaultZonePositions(Math.max(draft.zoneAnswers.length, loaded.length));
  }
  return draft;
}

/** Zone slots for a drag_drop question: one per filled label. */
export function dragDropZoneCount(draft: QuestionDraft): number {
  return draft.options.filter((option) => option.text.trim() !== '').length;
}

/**
 * The exam screen (ExamTakePage) shows a drag_drop question as labels dropped on the image only when it has
 * an image and exactly 4 labels; every other drag_drop question is an ordering task and ignores zone positions.
 */
export function isLabelOnImage(draft: QuestionDraft, hasImage: boolean): boolean {
  return hasImage && dragDropZoneCount(draft) === 4;
}

export function buildQuestionPayload(
  draft: QuestionDraft,
  validateMediaUrl: (url: string) => { valid: boolean; error?: string },
  hasImage: boolean,
): PayloadResult {
  const type = draft.questionType;
  const essay = isEssayType(type);
  const filled = draft.options.filter((option) => option.text.trim() !== '');
  const filledIds = filled.map((option) => option.id);
  const fail = (error: string): PayloadResult => ({ ok: false, error });

  if (draft.stem.trim() === '') return fail('Nhập nội dung câu hỏi.');
  if (!Number.isInteger(draft.points) || draft.points < 1) return fail('Điểm phải là số nguyên từ 1 trở lên.');

  let answerKey: string;
  let options = filled;
  let rubric: unknown;
  let mediaUrl: string | null | undefined;

  switch (type) {
    case 'single_choice':
      if (filled.length < 2) return fail('Cần ít nhất 2 đáp án.');
      if (!filledIds.includes(draft.singleAnswer)) return fail('Đáp án đúng phải nằm trong danh sách đáp án đã nhập.');
      answerKey = draft.singleAnswer;
      break;
    case 'multiple_choice': {
      if (filled.length < 2) return fail('Cần ít nhất 2 đáp án.');
      const correct = filledIds.filter((id) => draft.multipleAnswers.includes(id)).sort();
      if (correct.length === 0) return fail('Chọn ít nhất một đáp án đúng.');
      answerKey = JSON.stringify(correct);
      break;
    }
    case 'drag_drop': {
      if (filled.length < 2) return fail('Cần ít nhất 2 nhãn.');
      const count = filled.length;
      const zones = Array.from({ length: count }, (_, index) => draft.zoneAnswers[index] ?? filledIds[index]);
      if (new Set(zones).size !== count || zones.some((id) => !filledIds.includes(id))) {
        return fail(`Mỗi ô phải chọn một nhãn khác nhau (${count} ô = ${count} nhãn).`);
      }
      answerKey = JSON.stringify(zones);
      if (isLabelOnImage(draft, hasImage)) {
        const positions = draft.zonePositions.length >= 4 ? draft.zonePositions : [...draft.zonePositions, ...defaultZonePositions(4).slice(draft.zonePositions.length)];
        rubric = { zones: positions.slice(0, 4) };
      }
      break;
    }
    case 'true_false_multi':
      if (filled.length < 2) return fail('Cần ít nhất 2 phát biểu.');
      answerKey = JSON.stringify(filled.map((_, index) => (draft.trueFalse[index] === 'F' ? 'F' : 'T')));
      break;
    case 'matching': {
      if (filled.length < 2) return fail('Cần ít nhất 2 cặp nối đôi.');
      const right = filled.map((_, index) => (draft.matchingRight[index] ?? '').trim());
      if (right.some((text) => text === '')) return fail('Nhập đủ nội dung cột phải cho mỗi cặp.');
      const map: Record<string, string> = {};
      filled.forEach((option, index) => { map[option.id] = String(index + 1); });
      answerKey = JSON.stringify({ right, map });
      break;
    }
    default: {
      const keys = draft.essayKeys.filter((key) => key.text.trim() !== '' && key.points >= 0);
      answerKey = keys.length > 0 ? JSON.stringify(keys) : '';
      // Imported essay questions store [] (the legacy form stored one empty option); neither is read.
      options = [];
      rubric = draft.rubricText.trim() || null;
      const media = draft.mediaUrl.trim();
      const check = validateMediaUrl(media);
      if (!check.valid) return fail(check.error ?? 'URL video không hợp lệ.');
      mediaUrl = media || null;
    }
  }

  const payload: QuestionPayload = {
    question_type: type,
    stem: draft.stem,
    options,
    answer_key: answerKey,
    points: draft.points,
    topic: draft.topic,
    difficulty: draft.difficulty,
    status: draft.status,
  };
  if (essay) payload.media_url = mediaUrl;
  if (rubric !== undefined) payload.rubric = rubric;
  return { ok: true, payload };
}
