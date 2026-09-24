import type { Dispatch, SetStateAction } from 'react';
import { ZonePositionPicker } from '../../../../components/ZonePositionPicker';
import { OPTION_IDS, defaultZonePositions, distributeEssayPoints, dragDropZoneCount, isLabelOnImage, visibleOptionCount, type QuestionDraft, type ZonePosition } from '../../domain/question-draft';
import { fieldClass, focusRing } from '../labels';

const smallButton = `inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium ${focusRing}`;

export type DraftUpdate = (patch: Partial<QuestionDraft> | ((current: QuestionDraft) => Partial<QuestionDraft>)) => void;

export interface FieldProps {
  draft: QuestionDraft;
  update: DraftUpdate;
}

function setOptionText(draft: QuestionDraft, id: string, text: string) {
  return draft.options.map((option) => (option.id === id ? { ...option, text } : option));
}

function optionText(draft: QuestionDraft, id: string) {
  return draft.options.find((option) => option.id === id)?.text ?? '';
}

function setAt<T>(values: T[], index: number, value: T, filler: T): T[] {
  const next = [...values];
  while (next.length <= index) next.push(filler);
  next[index] = value;
  return next;
}

/** single_choice and multiple_choice: option text plus the correct marker on each row. */
export function ChoiceOptionsField({ draft, update }: FieldProps) {
  const multiple = draft.questionType === 'multiple_choice';
  const ids = OPTION_IDS.slice(0, visibleOptionCount(draft.options));
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-slate-800">Đáp án</legend>
      <p className="text-xs text-slate-600">{multiple ? 'Đánh dấu mọi đáp án đúng.' : 'Chọn một đáp án đúng.'} Ô trống mới tự hiện khi bạn điền ô cuối, tối đa 10 đáp án.</p>
      {ids.map((id) => (
        <div key={id} className="flex items-center gap-2">
          <span className="w-6 shrink-0 font-semibold text-slate-700" aria-hidden="true">{id}.</span>
          <input
            value={optionText(draft, id)}
            onChange={(event) => update({ options: setOptionText(draft, id, event.target.value) })}
            aria-label={`Đáp án ${id}`}
            className={fieldClass}
          />
          <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm text-slate-700">
            {multiple ? (
              <input
                type="checkbox"
                checked={draft.multipleAnswers.includes(id)}
                onChange={() => update({ multipleAnswers: draft.multipleAnswers.includes(id) ? draft.multipleAnswers.filter((value) => value !== id) : [...draft.multipleAnswers, id].sort() })}
                className={`h-5 w-5 ${focusRing}`}
                aria-label={`Đáp án ${id} đúng`}
              />
            ) : (
              <input
                type="radio"
                name="single-answer"
                checked={draft.singleAnswer === id}
                onChange={() => update({ singleAnswer: id })}
                className={`h-5 w-5 ${focusRing}`}
                aria-label={`Đáp án ${id} đúng`}
              />
            )}
            <span aria-hidden="true">Đúng</span>
          </label>
        </div>
      ))}
    </fieldset>
  );
}

export function TrueFalseField({ draft, update }: FieldProps) {
  const ids = OPTION_IDS.slice(0, visibleOptionCount(draft.options));
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-slate-800">Phát biểu và Đúng/Sai</legend>
      <p className="text-xs text-slate-600">Điểm chia đều theo số phát biểu thí sinh chọn đúng.</p>
      {ids.map((id, index) => (
        <div key={id} className="flex items-center gap-2">
          <span className="w-6 shrink-0 font-semibold text-slate-700" aria-hidden="true">{id}.</span>
          <input value={optionText(draft, id)} onChange={(event) => update({ options: setOptionText(draft, id, event.target.value) })} aria-label={`Phát biểu ${id}`} className={fieldClass} />
          <select
            value={draft.trueFalse[index] === 'F' ? 'F' : 'T'}
            onChange={(event) => update({ trueFalse: setAt(draft.trueFalse, index, event.target.value === 'F' ? 'F' : 'T', 'T') })}
            aria-label={`Phát biểu ${id} là`}
            className={`${fieldClass} w-28 shrink-0`}
          >
            <option value="T">Đúng</option>
            <option value="F">Sai</option>
          </select>
        </div>
      ))}
    </fieldset>
  );
}

export function MatchingField({ draft, update }: FieldProps) {
  const ids = OPTION_IDS.slice(0, visibleOptionCount(draft.options));
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-slate-800">Cặp nối đôi</legend>
      <p className="text-xs text-slate-600">Mỗi hàng là một cặp đúng. Khi thi, cột phải được xáo trộn; điểm chia đều theo số cặp nối đúng.</p>
      {ids.map((id, index) => (
        <div key={id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)]">
          <span className="font-semibold text-slate-700" aria-hidden="true">{id}.</span>
          <input value={optionText(draft, id)} onChange={(event) => update({ options: setOptionText(draft, id, event.target.value) })} aria-label={`Cột trái ${id}`} className={fieldClass} />
          <input
            value={draft.matchingRight[index] ?? ''}
            onChange={(event) => update({ matchingRight: setAt(draft.matchingRight, index, event.target.value, '') })}
            aria-label={`Cột phải nối với ${id}`}
            className={`${fieldClass} col-start-2 sm:col-start-auto`}
          />
        </div>
      ))}
    </fieldset>
  );
}

export function DragDropField({ draft, update, imageSrc }: FieldProps & { imageSrc: string | null }) {
  const ids = OPTION_IDS.slice(0, visibleOptionCount(draft.options));
  const count = dragDropZoneCount(draft);
  const onImage = isLabelOnImage(draft, Boolean(imageSrc));
  const filled = draft.options.filter((option) => option.text.trim() !== '');
  const zoneIndexes = Array.from({ length: count }, (_, index) => index);
  const padPositions = (positions: ZonePosition[]) =>
    positions.length >= count ? positions : [...positions, ...defaultZonePositions(count).slice(positions.length)];
  const positions = padPositions(draft.zonePositions);
  // The picker sends functional updates while a dot is dragged; apply them to the latest draft.
  const setZonePositions: Dispatch<SetStateAction<ZonePosition[]>> = (next) =>
    update((current) => ({ zonePositions: typeof next === 'function' ? next(padPositions(current.zonePositions)) : next }));
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-800">Nhãn</legend>
        <p className="text-xs text-slate-600">
          {onImage
            ? 'Có ảnh và 4 nhãn: thí sinh kéo từng nhãn vào 4 ô trên ảnh.'
            : 'Thí sinh kéo các nhãn để xếp đúng thứ tự. Muốn thí sinh gắn nhãn lên ảnh thì cần có ảnh và đúng 4 nhãn.'}
        </p>
        {ids.map((id, index) => (
          <div key={id} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-sm text-slate-700" aria-hidden="true">Nhãn {index + 1}</span>
            <input value={optionText(draft, id)} onChange={(event) => update({ options: setOptionText(draft, id, event.target.value) })} aria-label={`Nhãn ${index + 1}`} className={fieldClass} />
          </div>
        ))}
      </fieldset>
      {count >= 2 && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-800">{onImage ? 'Nhãn đúng của từng ô trên ảnh' : 'Thứ tự đúng'}</legend>
          <p className="mb-2 text-xs text-slate-600">{onImage ? 'Ô theo số của các chấm trên ảnh.' : 'Vị trí 1 là nhãn đứng đầu.'} Mỗi vị trí một nhãn khác nhau.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {zoneIndexes.map((index) => (
              <label key={index} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="w-16 shrink-0">{onImage ? `Ô ${index + 1}` : `Vị trí ${index + 1}`}</span>
                <select
                  value={draft.zoneAnswers[index] ?? filled[index]?.id ?? ''}
                  onChange={(event) => update({ zoneAnswers: setAt(draft.zoneAnswers, index, event.target.value, 'A') })}
                  className={fieldClass}
                >
                  {filled.map((option) => <option key={option.id} value={option.id}>{option.text}</option>)}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {onImage && imageSrc && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-800">Vị trí các ô trên ảnh (% từ trái, % từ trên)</legend>
          <div className="mb-3"><ZonePositionPicker imageUrl={imageSrc} zonePositions={positions} setZonePositions={setZonePositions} count={count} /></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {zoneIndexes.map((index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="w-10 shrink-0">Ô {index + 1}</span>
                {(['x', 'y'] as const).map((axis) => (
                  <input
                    key={axis}
                    type="number"
                    min={0}
                    max={100}
                    value={positions[index][axis]}
                    onChange={(event) => {
                      const value = Math.max(0, Math.min(100, Number(event.target.value) || 0));
                      update((current) => {
                        const next = padPositions(current.zonePositions).map((zone) => ({ ...zone }));
                        next[index] = { ...next[index], [axis]: value };
                        return { zonePositions: next };
                      });
                    }}
                    aria-label={`Ô ${index + 1}, ${axis === 'x' ? 'phần trăm từ trái' : 'phần trăm từ trên'}`}
                    className={`${fieldClass} w-20`}
                  />
                ))}
              </div>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

export function EssayField({ draft, update }: FieldProps) {
  const total = Math.round(draft.essayKeys.reduce((sum, key) => sum + key.points, 0) * 100) / 100;
  const balanced = Math.abs(total - draft.points) < 0.01;
  return (
    <div className="space-y-4">
      {draft.questionType === 'video_paragraph' && (
        <label className="block text-sm font-medium text-slate-800">URL video
          <input type="url" value={draft.mediaUrl} onChange={(event) => update({ mediaUrl: event.target.value })} className={`${fieldClass} mt-1`} placeholder="https://www.youtube.com/watch?v=…" />
          <span className="mt-1 block text-xs font-normal text-slate-600">Nhận YouTube, Vimeo hoặc file trên Supabase Storage của dự án.</span>
        </label>
      )}
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-800">Ý chấm tự động</legend>
        <p className="text-xs text-slate-600">Mỗi ý xuất hiện trong bài làm được cộng điểm (so khớp không phân biệt hoa thường). Để trống nếu giáo viên chấm tay.</p>
        {draft.essayKeys.map((key, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={key.text}
              onChange={(event) => update({ essayKeys: draft.essayKeys.map((item, i) => (i === index ? { ...item, text: event.target.value } : item)) })}
              aria-label={`Ý chấm ${index + 1}`}
              className={fieldClass}
            />
            <span className="w-14 shrink-0 text-right text-sm tabular-nums text-slate-700">{key.points} đ</span>
            <button type="button" onClick={() => update({ essayKeys: distributeEssayPoints(draft.essayKeys.filter((_, i) => i !== index), draft.points) })} className={`${smallButton} text-rose-800 hover:bg-rose-50`} aria-label={`Xóa ý chấm ${index + 1}`}>
              Xóa
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => update({ essayKeys: distributeEssayPoints([...draft.essayKeys, { text: '', points: 0 }], draft.points) })} className={`${smallButton} text-indigo-700 hover:bg-indigo-50`}>
            Thêm ý chấm
          </button>
          {draft.essayKeys.length > 0 && (
            <>
              <button type="button" onClick={() => update({ essayKeys: distributeEssayPoints(draft.essayKeys, draft.points) })} className={`${smallButton} text-slate-700 hover:bg-slate-100`}>
                Chia đều lại
              </button>
              <span className={`text-sm ${balanced ? 'text-emerald-800' : 'text-amber-900'}`}>Tổng {total} / {draft.points} điểm</span>
            </>
          )}
        </div>
      </fieldset>
      <label className="block text-sm font-medium text-slate-800">Gợi ý chấm cho giáo viên
        <textarea value={draft.rubricText} onChange={(event) => update({ rubricText: event.target.value })} rows={2} className={`${fieldClass} mt-1`} />
      </label>
    </div>
  );
}
