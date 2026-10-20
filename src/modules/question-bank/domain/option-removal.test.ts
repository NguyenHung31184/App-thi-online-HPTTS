import { describe, expect, it } from 'vitest';
import { emptyDraft, removeOption, type QuestionDraft } from './question-draft';

function draftWith(texts: string[], extra: Partial<QuestionDraft> = {}): QuestionDraft {
  const draft = emptyDraft();
  texts.forEach((text, i) => { draft.options[i].text = text; });
  return { ...draft, ...extra };
}
const filled = (patch: Partial<QuestionDraft>) => patch.options!.filter((o) => o.text !== '').map((o) => `${o.id}:${o.text}`);

describe('removeOption', () => {
  it('drops the matching header row "Cột 1 | Cột 2" and moves the pairs up with their right-hand text', () => {
    const patch = removeOption(draftWith(['Cột 1', 'Tài xế', 'Người lái'], { questionType: 'matching', matchingRight: ['Cột 2', 'Phân vùng', 'Dừng thử tải'] }), 'A');
    expect(filled(patch)).toEqual(['A:Tài xế', 'B:Người lái']);
    expect(patch.matchingRight).toEqual(['Phân vùng', 'Dừng thử tải']);
    expect(patch.options).toHaveLength(10);
  });

  it('keeps the correct answers on their rows', () => {
    const patch = removeOption(draftWith(['a', 'b', 'c', 'd'], { multipleAnswers: ['A', 'C', 'D'] }), 'B');
    expect(filled(patch)).toEqual(['A:a', 'B:c', 'C:d']);
    expect(patch.multipleAnswers).toEqual(['A', 'B', 'C']);
  });

  it('clears a single answer that was removed and re-letters one below it', () => {
    expect(removeOption(draftWith(['a', 'b', 'c'], { singleAnswer: 'B' }), 'B').singleAnswer).toBe('');
    expect(removeOption(draftWith(['a', 'b', 'c'], { singleAnswer: 'C' }), 'A').singleAnswer).toBe('B');
  });

  it('removes the label from the ordering and the statement from true/false', () => {
    const patch = removeOption(draftWith(['1', '2', '3'], { zoneAnswers: ['C', 'A', 'B'], trueFalse: ['T', 'F', 'T'] }), 'A');
    expect(patch.zoneAnswers).toEqual(['B', 'A']);
    expect(patch.trueFalse).toEqual(['F', 'T']);
  });
});
