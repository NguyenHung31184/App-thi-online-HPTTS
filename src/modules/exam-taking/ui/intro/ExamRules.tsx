import { examRuleFacts, examRuleSections, type ExamRulesInput } from '../../domain/exam-rules';

interface ExamRulesProps {
  examTitle: string;
  rules: ExamRulesInput;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onStart: () => void;
  onBack?: () => void;
  busy?: boolean;
  error?: string;
}

/** The exam rules with the consent tick; the start button stays disabled until the student ticks. */
export function ExamRules({ examTitle, rules, confirmed, onConfirmedChange, onStart, onBack, busy, error }: ExamRulesProps) {
  const facts = examRuleFacts(rules);
  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <p className="text-sm font-medium text-slate-600">Thể lệ thi</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{examTitle}</h1>

        {facts.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-3">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <dt className="text-xs text-slate-600">{fact.label}</dt>
                <dd className="text-base font-semibold text-slate-900">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {examRuleSections(rules).map((section) => (
          <section key={section.title} className="mt-5">
            <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
            <ol className="mt-2 list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </section>
        ))}

        <div className="mt-6 pt-4 border-t border-slate-200">
          <label className="flex items-start gap-3 text-sm text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => onConfirmedChange(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>
              Tôi đã đọc, hiểu và cam kết thực hiện thể lệ thi. Tôi đồng ý để hệ thống chụp ảnh và ghi nhật ký giám sát
              trong lúc làm bài.
            </span>
          </label>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                disabled={busy}
                className="min-h-11 px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Quay lại
              </button>
            )}
            <button
              type="button"
              disabled={!confirmed || busy}
              onClick={onStart}
              className="min-h-11 px-5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Đang vào thi...' : 'Đồng ý và vào thi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
