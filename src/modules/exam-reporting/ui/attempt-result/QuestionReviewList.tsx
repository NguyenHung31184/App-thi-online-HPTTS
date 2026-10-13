import { answerLines, matchingRightOf, type QuestionReviewItem } from '../../domain/attempt-review';

function AnswerLines({ lines, className }: { lines: string[]; className: string }) {
  if (lines.length === 1) return <p className={`${className} whitespace-pre-wrap`}>{lines[0]}</p>;
  return (
    <ul className={`${className} space-y-1`}>
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}

export function QuestionReviewList({ items }: { items: QuestionReviewItem[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm print:border-0 print:shadow-none print:p-0">
      <h2 className="text-base font-semibold text-slate-800 mb-1">Chi tiết từng câu</h2>
      <p className="text-xs text-slate-500 mb-4">
        Câu trả lời của học viên so với đáp án. Câu tự luận do giáo viên chấm theo các ý trong đáp án.
      </p>
      <ol className="space-y-4 list-decimal list-inside marker:font-semibold marker:text-slate-400">
        {items.map((it, idx) => (
          <li
            key={it.id}
            className={`rounded-xl border p-4 pl-5 shadow-sm print:break-inside-avoid ${
              it.correct
                ? 'border-emerald-200 bg-emerald-50/40'
                : it.chosen === null || it.manual
                  ? 'border-slate-200 bg-slate-50'
                  : 'border-red-200 bg-red-50/30'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-slate-500">Câu {idx + 1}</span>
              <span className="text-xs text-slate-500">{it.points} điểm</span>
            </div>
            <p className="text-slate-800 text-sm mb-3 whitespace-pre-wrap">{it.stem}</p>
            {it.image_url && (
              <img
                src={it.image_url}
                alt={`Hình câu ${idx + 1}`}
                className="max-h-48 rounded-md border border-slate-200 mb-3 object-contain"
              />
            )}
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">{it.manual ? 'Học viên trả lời' : 'Học viên đã chọn'}</p>
                <AnswerLines
                  lines={answerLines(it.options, it.chosen, it.question_type, matchingRightOf(it.answer_key))}
                  className={
                    it.correct
                      ? 'text-emerald-700 font-medium'
                      : !it.chosen
                        ? 'text-slate-400 italic'
                        : it.manual
                          ? 'text-slate-800'
                          : 'text-red-700 font-medium'
                  }
                />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">{it.manual ? 'Các ý cần có' : 'Đáp án đúng'}</p>
                <AnswerLines lines={answerLines(it.options, it.answer_key, it.question_type)} className="text-emerald-700 font-medium" />
              </div>
            </div>
            <p
              className={`mt-2 text-xs font-semibold ${
                it.correct ? 'text-emerald-600' : it.manual && it.chosen ? 'text-slate-600' : 'text-red-600'
              }`}
            >
              {it.correct ? '✓ Đúng' : !it.chosen ? '— Chưa trả lời' : it.manual ? 'Tự luận: giáo viên chấm' : '✗ Sai'}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
