import { useEffect, useRef, useState, type FormEvent } from 'react';
import { validateMediaUrl } from '../../../../utils/mediaUrlValidator';
import type { WordImportCandidate } from '../../application/import-questions';
import { QUESTION_TYPES, buildQuestionPayload, type QuestionDraft } from '../../domain/question-draft';
import { rowLabel } from '../../domain/question-import';
import { difficultyLabels, fieldClass, focusRing, questionTypeLabels } from '../labels';
import { ChoiceOptionsField, DragDropField, EssayField, MatchingField, TrueFalseField, type DraftUpdate } from './question-fields';

interface Props {
  candidate: WordImportCandidate;
  initialDraft: QuestionDraft;
  imageSrc: string | null;
  onSave: (draft: QuestionDraft) => void;
  onCancel: () => void;
}

export function WordImportQuestionEditor({ candidate, initialDraft, imageSrc, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const update: DraftUpdate = (patch) => setDraft((current) => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }));
  const type = draft.questionType;

  useEffect(() => { headingRef.current?.focus(); }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const built = buildQuestionPayload(draft, validateMediaUrl, Boolean(imageSrc));
    if (!built.ok) {
      setError(built.error);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    onSave(draft);
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-4 rounded-xl border-2 border-indigo-300 bg-indigo-50/40 p-3 sm:p-4" noValidate>
      <div>
        <h5 ref={headingRef} tabIndex={-1} className="font-semibold text-slate-900 focus:outline-none">
          Sửa {rowLabel(candidate.source).toLowerCase()}
        </h5>
        <p className="mt-1 text-sm text-slate-700">Chọn đúng loại câu hỏi, kiểm tra nội dung và đáp án trước khi xác nhận.</p>
      </div>

      {candidate.reason && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          File Word cần bổ sung: {candidate.reason}
        </p>
      )}
      {error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-950">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-800">Loại câu hỏi
          <select value={type} onChange={(event) => update({ questionType: event.target.value as QuestionDraft['questionType'] })} className={`${fieldClass} mt-1`}>
            {QUESTION_TYPES.map((value) => <option key={value} value={value}>{questionTypeLabels[value]}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-800">Chủ đề
          <input value={draft.topic} onChange={(event) => update({ topic: event.target.value })} className={`${fieldClass} mt-1`} />
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-800">Nội dung câu hỏi
        <textarea value={draft.stem} onChange={(event) => update({ stem: event.target.value })} rows={3} className={`${fieldClass} mt-1`} />
      </label>

      {(type === 'single_choice' || type === 'multiple_choice') && <ChoiceOptionsField draft={draft} update={update} />}
      {type === 'true_false_multi' && <TrueFalseField draft={draft} update={update} />}
      {type === 'matching' && <MatchingField draft={draft} update={update} />}
      {(type === 'video_paragraph' || type === 'main_idea') && <EssayField draft={draft} update={update} />}
      {type === 'drag_drop' && <DragDropField draft={draft} update={update} imageSrc={imageSrc} />}

      {imageSrc && type !== 'drag_drop' && (
        <div>
          <p className="text-sm font-medium text-slate-800">Ảnh trong file Word</p>
          <img src={imageSrc} alt={`Ảnh của ${rowLabel(candidate.source).toLowerCase()}`} className="mt-1 max-h-60 max-w-full rounded-lg border border-slate-300 bg-white object-contain" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-slate-800">Điểm
          <input type="number" min={1} step={1} value={draft.points} onChange={(event) => update({ points: Number(event.target.value) })} className={`${fieldClass} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-800">Độ khó
          <select value={draft.difficulty} onChange={(event) => update({ difficulty: event.target.value })} className={`${fieldClass} mt-1`}>
            {Object.entries(difficultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-indigo-200 pt-4">
        <button type="submit" className={`min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800 ${focusRing}`}>
          Xác nhận câu hỏi
        </button>
        <button type="button" onClick={onCancel} className={`min-h-11 rounded-lg border border-slate-400 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 ${focusRing}`}>
          Hủy sửa
        </button>
      </div>
    </form>
  );
}
