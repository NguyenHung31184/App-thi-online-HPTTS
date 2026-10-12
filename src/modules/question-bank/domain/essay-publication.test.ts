import { describe, expect, it } from 'vitest';
import { buildQuestionPayload, emptyDraft } from './question-draft';
import { validateQuestion } from './question-validation';
import { checkBlueprintCoverage } from './blueprint-coverage';

describe('essay publication', () => {
  it('keeps an unmarked essay as draft, rejecting publication', () => {
    const draft = { ...emptyDraft(), questionType:'main_idea' as const, stem:'Explain',essayKeys:[] };
    expect(buildQuestionPayload(draft, () => ({valid:true}),false).ok).toBe(false);
    expect(buildQuestionPayload({...draft,status:'draft'}, () => ({valid:true}),false).ok).toBe(true);
  });
  it('requires a nonempty positive marking key while student papers do not contain it', () => {
    const q = {question_type:'main_idea',stem:'Explain',options:[],points:2,answer_key:''};
    for (const answer_key of ['', '[]','[{"text":"x","points":0}]','bad']) expect(validateQuestion({...q,answer_key}).ok).toBe(false);
    expect(validateQuestion({...q,answer_key:'[{"text":"x","points":2}]'}).ok).toBe(true);
    expect(validateQuestion(q,{skipAnswerKey:true}).ok).toBe(true);
  });
  it('blocks a blueprint selecting an older published unmarked essay', () => {
    expect(checkBlueprintCoverage([{topic:'*',difficulty:'*',count:1}],
      [{stem:'Explain',options:[],topic:'T',difficulty:'easy',question_type:'main_idea',answer_key:''}]).ok).toBe(false);
  });
});
