// Keyword marking for essay questions. A marking point ("ý chấm") carries keyword groups; a group lists
// alternatives separated by "/" ("đứt cáp/cáp đứt"). The point is earned when the answer hits at least
// two groups (one if the point has a single group). grade_attempt (migration 20261019090000) applies the
// same rules in SQL; keep the two in step.

/** Answer characters the grader reads; the exam screen stops typing at the same length. */
export const ESSAY_ANSWER_MAX_LENGTH = 200;
export const ESSAY_MIN_KEYWORD_HITS = 2;
export const ESSAY_DEFAULT_POINTS = 2;

const STOP_PHRASES = ['phát hiện', 'trường hợp', 'bắt buộc', 'ngay lập tức'];
const STOP_WORDS = new Set([
  'bị', 'các', 'những', 'có', 'khi', 'nếu', 'thì', 'là', 'của', 'để', 'được', 'phải', 'một', 'với', 'trong',
  'từ', 'cho', 'đã', 'đang', 'sẽ', 'này', 'do', 'rất', 'mọi', 'nào', 'gì', 'ra', 'vào', 'lên', 'xuống',
]);
const SEPARATORS = /[,;.:()!?\n]+|\s+(?:hoặc|và|hay|hoặc là)\s+/iu;
const MAX_WORDS = 3;

function words(text: string): string[] {
  return text.toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter(Boolean);
}

/** Lower case, no accents (đ → d), punctuation as spaces, padded with one space either side. */
export function normalizeForMatch(text: string): string {
  const plain = text.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
  return ` ${plain.replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

/** Suggested keyword groups for one marking point: short phrases of at most three words. */
export function suggestKeywords(pointText: string): string[] {
  let text = pointText.toLocaleLowerCase('vi');
  for (const phrase of STOP_PHRASES) text = text.split(phrase).join(',');
  const result: string[] = [];
  for (const segment of text.split(SEPARATORS)) {
    const kept = words(segment ?? '').filter((word) => !STOP_WORDS.has(word));
    const chunks: string[][] = [];
    for (let start = 0; start < kept.length; start += MAX_WORDS) chunks.push(kept.slice(start, start + MAX_WORDS));
    // A lone trailing word joins the chunk before it rather than standing as a keyword.
    if (chunks.length > 1 && chunks[chunks.length - 1].length === 1) chunks[chunks.length - 2].push(...chunks.pop()!);
    result.push(...chunks.map((chunk) => chunk.join(' ')));
  }
  return [...new Set(result.filter((keyword) => keyword.length > 1))];
}

/** "rò rỉ dầu, đứt cáp/cáp đứt" → ["rò rỉ dầu", "đứt cáp/cáp đứt"]. */
export function parseKeywordList(raw: string): string[] {
  return raw.split(/[,;\n]+/).map((group) => group.split('/').map((alt) => alt.trim()).filter(Boolean).join('/')).filter(Boolean);
}

export function formatKeywordList(groups: string[]): string {
  return groups.join(', ');
}

function alternativeHits(alternative: string, normalizedAnswer: string, answerWords: Set<string>): boolean {
  const phrase = normalizeForMatch(alternative);
  if (phrase.trim() === '') return false;
  if (normalizedAnswer.includes(phrase)) return true;
  // Same words in another order count when they are typed with accents ("dầu rò rỉ").
  const own = words(alternative);
  return own.length > 1 && own.every((word) => answerWords.has(word));
}

/** How many keyword groups the answer hits. */
export function countKeywordHits(groups: string[], answer: string): number {
  const text = answer.slice(0, ESSAY_ANSWER_MAX_LENGTH);
  const normalized = normalizeForMatch(text);
  const answerWords = new Set(words(text));
  return groups.filter((group) => group.split('/').some((alt) => alternativeHits(alt, normalized, answerWords))).length;
}

export function requiredHits(groups: string[]): number {
  return Math.min(ESSAY_MIN_KEYWORD_HITS, groups.length);
}

export function pointEarned(groups: string[], answer: string): boolean {
  return groups.length > 0 && countKeywordHits(groups, answer) >= requiredHits(groups);
}
