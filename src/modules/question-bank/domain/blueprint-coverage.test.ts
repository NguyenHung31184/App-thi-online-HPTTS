import { describe, expect, it } from 'vitest';
import { checkBlueprintCoverage, type DrawPoolQuestion } from './blueprint-coverage';

function question(stem: string, topic: string, difficulty = 'medium', optionTexts = ['A', 'B']): DrawPoolQuestion {
  return { stem, options: optionTexts.map((text, index) => ({ id: String.fromCharCode(65 + index), text })), topic, difficulty };
}

function distinct(count: number, topic: string): DrawPoolQuestion[] {
  return Array.from({ length: count }, (_, index) => question(`Câu ${topic} ${index}`, topic));
}

const rule = (topic: string, difficulty: string, count: unknown) => ({ topic, difficulty, count });

describe('checkBlueprintCoverage', () => {
  it('passes one rule when the module has enough distinct questions', () => {
    expect(checkBlueprintCoverage([rule('*', 'medium', 50)], distinct(150, 'NLDK'))).toEqual({ ok: true, questionsPerAttempt: 50 });
  });

  it('fails one rule that is one question short and says how many there are', () => {
    const result = checkBlueprintCoverage([rule('*', 'medium', 50)], distinct(49, 'NLDK'));
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('chỉ có 49 câu');
  });

  it('counts copies of the same question once, like the draw', () => {
    const copies = [...distinct(20, 'QT'), ...distinct(20, 'QT'), ...distinct(20, 'QT'), ...distinct(20, 'QT')];
    expect(checkBlueprintCoverage([rule('*', 'medium', 20)], copies).ok).toBe(true);
    expect(checkBlueprintCoverage([rule('*', 'medium', 21)], copies).ok).toBe(false);
  });

  it('ignores case and runs of whitespace when comparing content', () => {
    expect(checkBlueprintCoverage([rule('*', '*', 2)], [question('Câu  A', 'X'), question(' câu a ', 'X')]).ok).toBe(false);
  });

  it('filters by topic and difficulty', () => {
    const pool = [...distinct(30, 'KTHH'), ...distinct(30, 'KHAC')];
    expect(checkBlueprintCoverage([rule('KTHH', 'medium', 30)], pool).ok).toBe(true);
    expect(checkBlueprintCoverage([rule('KTHH', 'medium', 31)], pool).ok).toBe(false);
    expect(checkBlueprintCoverage([rule('*', 'hard', 1)], pool).ok).toBe(false);
  });

  it('fails a later rule that earlier rules could empty', () => {
    const pool = [...distinct(30, 'KTHH'), ...distinct(30, 'KHAC')];
    const result = checkBlueprintCoverage([rule('*', 'medium', 40), rule('KTHH', 'medium', 20)], pool);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('các nhóm trước có thể đã lấy 30 câu');
  });

  it('passes overlapping rules when the worst case still leaves enough', () => {
    const pool = [...distinct(30, 'KTHH'), ...distinct(30, 'KHAC')];
    expect(checkBlueprintCoverage([rule('*', 'medium', 10), rule('KTHH', 'medium', 20)], pool)).toEqual({ ok: true, questionsPerAttempt: 30 });
  });

  it('adds up rules that share no question', () => {
    const pool = [...distinct(30, 'KTHH'), ...distinct(30, 'KHAC')];
    expect(checkBlueprintCoverage([rule('KTHH', 'medium', 30), rule('KHAC', 'medium', 30)], pool)).toEqual({ ok: true, questionsPerAttempt: 60 });
  });

  it('rejects an empty blueprint and one stored as a string', () => {
    expect(checkBlueprintCoverage([], distinct(60, 'A')).ok).toBe(false);
    expect(checkBlueprintCoverage('[{"topic":"*","difficulty":"*","count":1}]', distinct(60, 'A')).ok).toBe(false);
  });

  it('reads counts the way the draw does', () => {
    expect(checkBlueprintCoverage([rule('*', '*', '50')], distinct(60, 'A'))).toEqual({ ok: true, questionsPerAttempt: 50 });
    for (const bad of [0, -1, 2.5, '', null, '05']) {
      expect(checkBlueprintCoverage([rule('*', '*', bad)], distinct(60, 'A')).ok).toBe(false);
    }
  });

  it('matches nothing for a rule without a topic', () => {
    expect(checkBlueprintCoverage([{ difficulty: '*', count: 1 }], distinct(5, 'A')).ok).toBe(false);
  });
});
