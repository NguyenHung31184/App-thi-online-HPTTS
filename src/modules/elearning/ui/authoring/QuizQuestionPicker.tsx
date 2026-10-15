import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import IconAction from '../../../../shared/ui/IconAction';
import { authoringErrorMessage, type LessonBlockRow } from '../../domain/lesson-authoring';
import { QUESTION_TYPE_LABELS, isGradable, type QuizItemRow } from '../../domain/quiz';
import { useAddQuizQuestion, useBankQuestionSearch, useRemoveQuizQuestion } from '../../queries/use-lesson-authoring';

const typeLabel = (type: string) => (isGradable(type) ? QUESTION_TYPE_LABELS[type] : 'Dạng không chấm tự động');

/**
 * Câu hỏi của một khối quiz: danh sách đã chọn và ô tìm câu trong ngân hàng của mô-đun. Chỉ hiện câu đã duyệt thuộc ba
 * dạng chấm tự động. Đáp án không hiện ở đây; máy chủ chụp đáp án khi xuất bản.
 */
export function QuizQuestionPicker({ block, moduleId, items }: { block: LessonBlockRow; moduleId: string; items: QuizItemRow[] }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const search = useBankQuestionSearch(moduleId, text);
  const add = useAddQuizQuestion();
  const remove = useRemoveQuizQuestion();
  const own = items.filter((item) => item.block_id === block.id).sort((a, b) => a.order_index - b.order_index);
  const chosen = new Set(own.map((item) => item.question_id));
  const results = (search.data ?? []).filter((question) => !chosen.has(question.id));

  const fail = (reason: unknown) => setError(authoringErrorMessage(reason));

  return (
    <div className="space-y-3 rounded-xl border border-indigo-200 bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">Câu hỏi của bài kiểm tra ({own.length})</p>
        <p className="text-xs text-slate-600">Học viên làm lần lượt các câu dưới đây. Sửa nội dung câu ở Ngân hàng câu hỏi; bài đã xuất bản giữ nguyên câu cũ cho tới lần xuất bản sau.</p>
      </div>

      {own.length === 0 ? (
        <p className="text-sm text-amber-800">Chưa có câu nào. Bài chưa xuất bản được cho tới khi có ít nhất một câu.</p>
      ) : (
        <ol className="space-y-1.5">
          {own.map((item, index) => (
            <li key={item.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${item.unusable ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
              <span className="w-6 shrink-0 text-sm text-slate-500">{index + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">{item.stem || 'Câu không còn trong ngân hàng'}</p>
                <p className={`text-xs ${item.unusable ? 'text-red-700' : 'text-slate-600'}`}>
                  {item.unusable ? 'Câu đã bị xóa hoặc không chấm tự động được. Bỏ câu này trước khi xuất bản.' : typeLabel(item.question_type)}
                </p>
              </div>
              <IconAction title="Bỏ câu này" tone="red" onClick={() => { setError(''); remove.mutate(item.id, { onError: fail }); }}>
                <Trash2 className="h-4 w-4" />
              </IconAction>
            </li>
          ))}
        </ol>
      )}

      <div>
        <label htmlFor={`quiz-search-${block.id}`} className="mb-1 block text-sm font-medium text-slate-700">Thêm câu từ ngân hàng của mô-đun</label>
        <input
          id={`quiz-search-${block.id}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Gõ vài chữ trong đề để lọc"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {search.isPending ? (
        <p role="status" className="text-sm text-slate-500">Đang tìm câu hỏi...</p>
      ) : search.isError ? (
        <p role="alert" className="text-sm text-red-700">Không tải được ngân hàng câu hỏi: {authoringErrorMessage(search.error)}</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-slate-600">{text.trim() ? 'Không có câu đã duyệt nào khớp chữ đã gõ.' : 'Mô-đun chưa có câu đã duyệt thuộc dạng chấm tự động, hoặc đã chọn hết.'}</p>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {results.map((question) => (
            <li key={question.id} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">{question.stem}</p>
                <p className="text-xs text-slate-600">{[QUESTION_TYPE_LABELS[question.question_type], question.topic, question.difficulty].filter(Boolean).join(' · ')}</p>
              </div>
              <button
                type="button"
                disabled={add.isPending}
                onClick={() => { setError(''); add.mutate({ blockId: block.id, questionId: question.id, items }, { onError: fail }); }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-indigo-300 px-2.5 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden /> Thêm
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
