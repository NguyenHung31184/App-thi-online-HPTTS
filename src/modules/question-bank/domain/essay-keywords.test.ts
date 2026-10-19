import { describe, expect, it } from 'vitest';
import { countKeywordHits, normalizeForMatch, parseKeywordList, pointEarned, suggestKeywords } from './essay-keywords';

const point3 = ['rò rỉ dầu', 'đứt cáp/cáp đứt/đứt tao', 'tuột rãnh', 'người xâm nhập/phương tiện xâm nhập'];

describe('essay keyword marking', () => {
  it('awards the RTG point for "rò rỉ dầu, đứt cáp"', () => {
    expect(pointEarned(point3, 'rò rỉ dầu, đứt cáp')).toBe(true);
  });

  it('needs two keyword groups, one is not enough', () => {
    expect(countKeywordHits(point3, 'rò rỉ dầu')).toBe(1);
    expect(pointEarned(point3, 'rò rỉ dầu')).toBe(false);
  });

  it('counts a group once however many of its alternatives appear', () => {
    expect(pointEarned(point3, 'đứt cáp, cáp đứt, đứt tao')).toBe(false);
  });

  it('ignores accents and case', () => {
    expect(pointEarned(point3, 'RO RI DAU va dut cap')).toBe(true);
  });

  it('accepts the same words in another order when typed with accents', () => {
    expect(pointEarned(point3, 'dầu rò rỉ, cáp bị đứt tao')).toBe(true);
  });

  it('matches whole words only', () => {
    expect(normalizeForMatch('Đứt cáp!')).toBe(' dut cap ');
    expect(countKeywordHits(['tuột rãnh'], 'tuột rãnhxyz')).toBe(0);
  });

  it('reads only the first 200 characters of the answer', () => {
    expect(pointEarned(point3, `${'x'.repeat(200)} rò rỉ dầu đứt cáp`)).toBe(false);
  });

  it('needs one hit when the point has a single group', () => {
    expect(pointEarned(['tuột rãnh'], 'cáp tuột rãnh')).toBe(true);
  });

  it('suggests short phrases without filler words', () => {
    const suggested = suggestKeywords('phát hiện rò rỉ dầu thủy lực nghiêm trọng, cáp tải bị đứt tao hoặc có người xâm nhập vùng nguy hiểm');
    expect(suggested).toContain('rò rỉ dầu');
    expect(suggested).toContain('cáp tải đứt tao');
    expect(suggested.every((keyword) => keyword.split(' ').length <= 4)).toBe(true);
    expect(suggested.join(' ')).not.toMatch(/phát hiện|\bbị\b/u);
  });

  it('parses a typed keyword list with alternatives', () => {
    expect(parseKeywordList(' rò rỉ dầu , đứt cáp / cáp đứt ,, ')).toEqual(['rò rỉ dầu', 'đứt cáp/cáp đứt']);
  });
});

describe('stored essay keys', () => {
  it('gives an essay saved before keywords existed suggestions that still wait for approval', async () => {
    const { parseStoredEssayKeys, essayKeywordsPending } = await import('./question-draft');
    const keys = parseStoredEssayKeys('[{"text":"sai quy trình","points":2}]');
    expect(keys).toEqual([{ text: 'sai quy trình', points: 2, keywords: ['sai quy trình'], approved: false }]);
    expect(essayKeywordsPending(keys)).toBe(true);
    expect(essayKeywordsPending([{ ...keys[0], approved: true }])).toBe(false);
  });

  it('refuses to publish an essay whose keywords are not approved', async () => {
    const { buildQuestionPayload, emptyDraft, newEssayKey } = await import('./question-draft');
    const draft = { ...emptyDraft(), questionType: 'main_idea' as const, stem: 'Nêu', essayKeys: [newEssayKey('rò rỉ dầu', 2)] };
    const ok = { valid: true };
    expect(buildQuestionPayload(draft, () => ok, false)).toMatchObject({ ok: false, error: expect.stringContaining('Duyệt từ khóa') });
    expect(buildQuestionPayload({ ...draft, status: 'draft' }, () => ok, false).ok).toBe(true);
    expect(buildQuestionPayload({ ...draft, essayKeys: [{ ...draft.essayKeys[0], approved: true }] }, () => ok, false).ok).toBe(true);
  });
});
