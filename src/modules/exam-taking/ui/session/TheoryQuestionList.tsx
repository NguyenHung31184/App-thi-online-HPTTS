import { memo, type Dispatch, type SetStateAction } from 'react';
import type { QuestionForStudent } from '../../domain/exam-attempt';
import { hashStringToSeed, shuffleWithSeed } from '../../domain/session-paper';
import { optionLetter, referencesOtherOptions } from '../../domain/option-order';
import { ESSAY_ANSWER_MAX_LENGTH, validateQuestion } from '../../../question-bank/public';
import { SortableOptionList } from '../../../../shared/ui/SortableOptionList';
import { LabelOnImageDrop } from './LabelOnImageDrop';

interface Props {
  questions: QuestionForStudent[];
  attemptId?: string;
  answers: Record<string, string>;
  setAnswers: Dispatch<SetStateAction<Record<string, string>>>;
}

export const TheoryQuestionList = memo(function TheoryQuestionList({ questions, attemptId, answers, setAnswers }: Props) {
  return (
      <div className="space-y-6">
        {questions.map((q: QuestionForStudent, idx: number) => {
          const rawOpts = (Array.isArray(q.options) ? q.options as { id: string; text: string }[] : []);
          // Tráo đáp án cho trắc nghiệm (giữ id, chỉ tráo thứ tự hiển thị), trừ câu có phương án kiểu "Đáp án a, b đúng"
          const optSeed = hashStringToSeed(`${attemptId ?? 'seed'}|${q.id}|opts`);
          const isChoice = q.question_type === 'single_choice' || q.question_type === 'multiple_choice';
          const opts = isChoice && !referencesOtherOptions(rawOpts.map((o) => o.text ?? ''))
            ? shuffleWithSeed(rawOpts, optSeed)
            : rawOpts;
          const isMultiple = q.question_type === 'multiple_choice';
          const isDragDrop = q.question_type === 'drag_drop';
          const isLabelOnImage = isDragDrop && q.image_url && opts.length === 4;
          const isEssay = q.question_type === 'video_paragraph' || q.question_type === 'main_idea';
          const isTrueFalseMulti = q.question_type === 'true_false_multi';
          const isMatchingQ = q.question_type === 'matching';
          const currentSingle = answers[q.id] ?? '';
          let currentMultiple: string[] = [];
          let currentOrder: string[] = [];
          // true_false_multi: answers[q.id] = JSON array ["T","F","T","F"]
          let currentTfAnswers: string[] = opts.map(() => '');
          // matching: answers[q.id] = JSON object {"A":"1","B":"2",...}
          let currentMatchMap: Record<string, string> = {};
          // matching: cột phải đã xáo trộn (lấy từ answer_key của câu hỏi)
          let matchingRightItems: { idx: string; text: string }[] = [];
          try {
            if (answers[q.id]?.startsWith('[')) {
              const parsed = JSON.parse(answers[q.id]) as string[];
              if (isDragDrop) currentOrder = parsed;
              else if (isTrueFalseMulti) currentTfAnswers = parsed;
              else currentMultiple = parsed;
            } else if (answers[q.id]?.startsWith('{')) {
              const parsed = JSON.parse(answers[q.id]) as Record<string, string>;
              if (isMatchingQ) currentMatchMap = parsed;
            } else if (answers[q.id]) {
              currentMultiple = [answers[q.id]];
              currentOrder = opts.length ? opts.map((o) => o.id) : [];
            }
          } catch { /* JSON.parse lỗi → giữ giá trị default ở trên */ }
          if (isTrueFalseMulti && currentTfAnswers.length !== opts.length) {
            currentTfAnswers = opts.map((_, i) => currentTfAnswers[i] ?? '');
          }
          if (isMatchingQ) {
            // Lấy right items từ q.matching_right (RPC trả sẵn, không có map đáp án)
            try {
              const rightArr: string[] | null =
                Array.isArray(q.matching_right)
                  ? q.matching_right
                  : typeof q.matching_right === 'string'
                    ? (JSON.parse(q.matching_right) as string[])
                    : null;
              if (Array.isArray(rightArr) && rightArr.length > 0) {
                const seed = hashStringToSeed(`${attemptId ?? 'seed'}|${q.id}|right`);
                matchingRightItems = shuffleWithSeed(
                  rightArr.map((text, i) => ({ idx: String(i + 1), text })),
                  seed
                );
              }
            } catch { /* ignore */ }
          }
          if (isDragDrop && currentOrder.length === 0 && opts.length) currentOrder = opts.map((o) => o.id);
          const labelOnImageValue = isLabelOnImage
            ? (currentOrder.length >= 4 ? currentOrder : [...currentOrder, '', '', '', ''].slice(0, 4))
            : [];

          // Validate câu hỏi — nếu lỗi dữ liệu thì hiển thị thông báo thay vì crash
          // skipAnswerKey=true vì RPC không trả answer_key cho thí sinh (bảo mật)
          const qValidation = validateQuestion({
            question_type: q.question_type,
            stem: q.stem,
            options: q.options,
            answer_key: (q as unknown as { answer_key?: string }).answer_key ?? '',
            points: q.points ?? 0,
          }, { skipAnswerKey: true });
          if (!qValidation.ok) {
            return (
              <div key={q.id} className="bg-slate-50 border border-slate-300 rounded-lg p-4 opacity-70">
                <p className="text-slate-500 text-sm font-medium">Câu {idx + 1}. {q.stem}</p>
                <p className="mt-2 text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Câu hỏi này có lỗi kỹ thuật và không thể hiển thị. Vui lòng báo giám thị để được hỗ trợ.
                </p>
              </div>
            );
          }

          return (
            <div key={q.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="font-medium text-slate-800 mb-2">
                Câu {idx + 1}. {q.stem}
                {isMultiple && <span className="text-slate-500 text-sm ml-1">(chọn nhiều đáp án đúng)</span>}
                {isDragDrop && !isLabelOnImage && <span className="text-slate-500 text-sm ml-1">(kéo thả sắp xếp đúng thứ tự)</span>}
                {isLabelOnImage && <span className="text-slate-500 text-sm ml-1">(kéo nhãn vào đúng ô trên hình)</span>}
                {isEssay && <span className="text-slate-500 text-sm ml-1">(tự luận)</span>}
                {isTrueFalseMulti && <span className="text-slate-500 text-sm ml-1">(chọn Đúng hoặc Sai cho từng phát biểu)</span>}
                {isMatchingQ && <span className="text-slate-500 text-sm ml-1">(nối đôi)</span>}
              </p>
              {q.image_url && !isLabelOnImage && (
                <img src={q.image_url} alt="" className="max-w-full rounded mb-2 max-h-48 object-contain" />
              )}
              {isEssay && q.media_url && (
                <div className="mb-2">
                  <video src={q.media_url} controls className="max-w-full rounded max-h-64" />
                </div>
              )}
              {isEssay ? (
                <div>
                  <p id={`essay-hint-${q.id}`} className="mb-1 text-sm text-slate-600">
                    Ghi ngắn gọn các ý chính, mỗi ý vài từ khóa, cách nhau bằng dấu phẩy. Ví dụ: rò rỉ dầu, đứt cáp
                  </p>
                  <textarea
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value.slice(0, ESSAY_ANSWER_MAX_LENGTH) }))}
                    maxLength={ESSAY_ANSWER_MAX_LENGTH}
                    rows={3}
                    aria-describedby={`essay-hint-${q.id}`}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    placeholder="Nhập các từ khóa..."
                  />
                  <p className="text-right text-xs tabular-nums text-slate-600">{(answers[q.id] ?? '').length}/{ESSAY_ANSWER_MAX_LENGTH} ký tự</p>
                </div>
              ) : isLabelOnImage ? (
                (() => {
                  let r = q.rubric;
                  if (typeof r === 'string' && r.trim()) {
                    try {
                      r = JSON.parse(r) as unknown;
                    } catch {
                      r = undefined;
                    }
                  }
                  const zones =
                    r &&
                      typeof r === 'object' &&
                      r !== null &&
                      'zones' in r &&
                      Array.isArray((r as { zones?: unknown }).zones) &&
                      (r as { zones: { x: number; y: number }[] }).zones.length === 4
                      ? (r as { zones: { x: number; y: number }[] }).zones
                      : undefined;
                  return (
                    <LabelOnImageDrop
                      imageUrl={q.image_url!}
                      options={shuffleWithSeed(opts, hashStringToSeed(`${attemptId ?? 'seed'}|${q.id}|labels`))}
                      value={labelOnImageValue}
                      onChange={(zoneLabelIds) => setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(zoneLabelIds) }))}
                      zones={zones}
                    />
                  );
                })()
              ) : isDragDrop && opts.length > 0 ? (
                <SortableOptionList
                  options={shuffleWithSeed(opts, hashStringToSeed(`${attemptId ?? 'seed'}|${q.id}|drag`))}
                  value={currentOrder}
                  onChange={(orderedIds) => setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(orderedIds) }))}
                />
              ) : isTrueFalseMulti ? (
                <div className="space-y-2">
                  {opts.map((opt, optIdx) => (
                    <div key={opt.id} className="flex items-center gap-3 border border-slate-200 rounded-lg px-3 py-2">
                      <span className="flex-1 text-slate-800 text-sm">{opt.id}. {opt.text}</span>
                      <div className="flex gap-2 flex-shrink-0">
                        <label className={`flex items-center gap-1 px-3 py-1 rounded-lg border cursor-pointer text-sm font-medium transition-colors
                          ${currentTfAnswers[optIdx] === 'T' ? 'bg-green-100 border-green-400 text-green-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                          <input type="radio" name={`tf_${q.id}_${opt.id}`} className="sr-only"
                            checked={currentTfAnswers[optIdx] === 'T'}
                            onChange={() => {
                              const next = [...currentTfAnswers];
                              next[optIdx] = 'T';
                              setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(next) }));
                            }} />
                          Đúng
                        </label>
                        <label className={`flex items-center gap-1 px-3 py-1 rounded-lg border cursor-pointer text-sm font-medium transition-colors
                          ${currentTfAnswers[optIdx] === 'F' ? 'bg-red-100 border-red-400 text-red-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                          <input type="radio" name={`tf_${q.id}_${opt.id}`} className="sr-only"
                            checked={currentTfAnswers[optIdx] === 'F'}
                            onChange={() => {
                              const next = [...currentTfAnswers];
                              next[optIdx] = 'F';
                              setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(next) }));
                            }} />
                          Sai
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : isMatchingQ ? (
                <div className="space-y-2">
                  {opts.map((opt) => (
                    <div key={opt.id} className="border border-slate-200 rounded-lg bg-slate-50 p-2">
                      <div className="text-slate-800 text-sm font-medium mb-1.5 px-1">
                        {opt.id}. {opt.text}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 flex-shrink-0 text-sm">{'↔'}</span>
                        <select
                          title={`Chọn cột phải cho ${opt.id}`}
                          value={currentMatchMap[opt.id] ?? ''}
                          onChange={(e) => {
                            const next = { ...currentMatchMap, [opt.id]: e.target.value };
                            setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(next) }));
                          }}
                          className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          <option value="">-- Chọn --</option>
                          {matchingRightItems.map((item) => (
                            <option key={item.idx} value={item.idx}>{item.text}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {opts.map((opt, optIdx) =>
                    isMultiple ? (
                      <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentMultiple.includes(opt.id)}
                          onChange={() => {
                            const next = currentMultiple.includes(opt.id)
                              ? currentMultiple.filter((x) => x !== opt.id)
                              : [...currentMultiple, opt.id].sort();
                            setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(next) }));
                          }}
                          className="w-4 h-4"
                        />
                        <span>{optionLetter(optIdx)}) {opt.text}</span>
                      </label>
                    ) : (
                      <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={q.id}
                          checked={currentSingle === opt.id}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                          className="w-4 h-4"
                        />
                        <span>{optionLetter(optIdx)}) {opt.text}</span>
                      </label>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
  );
});
