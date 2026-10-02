import { Link } from 'react-router-dom';
import type { BlueprintCheckRow } from '../../domain/bank-check';

/** Gap analysis of the blueprint against the module's bank; "Lọc ngay" narrows the list to a short rule. */
export function BlueprintStatusPanel({ status, onFilter }: { status: BlueprintCheckRow[]; onFilter: (topic: string, difficulty: string) => void }) {
  const blueprintStatus = status;
  const blueprintAllOk = status.every((s) => s.ok);
  return (
    <>
      {blueprintStatus && blueprintStatus.length > 0 && (
        <div className={`mb-4 rounded-xl border p-3 text-sm ${blueprintAllOk ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            {blueprintAllOk ? (
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <p className={`font-semibold ${blueprintAllOk ? 'text-emerald-800' : 'text-red-800'}`}>
              Kiểm tra blueprint — {blueprintAllOk ? 'Ngân hàng đủ câu' : 'Ngân hàng thiếu câu'}
            </p>
          </div>
          <div className="space-y-1.5">
            {blueprintStatus.map((s, i) => {
              const topicLabel = s.rule.topic === '*' ? 'Tất cả chủ đề' : (s.rule.topic || '—');
              const diffLabel  = s.rule.difficulty === '*' ? 'mọi độ khó' : s.rule.difficulty;
              const gap = s.rule.count - s.have;
              return (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold ${s.ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {s.ok ? '✓' : '!'}
                  </span>
                  <span className="text-slate-700 text-xs flex-1">
                    {topicLabel} / {diffLabel}:{' '}
                    <span className={`font-semibold ${s.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                      Có {s.have} câu, cần {s.rule.count}
                    </span>
                    {!s.ok && (
                      <span className="text-red-600 font-bold"> → thiếu {gap} câu</span>
                    )}
                  </span>
                  {!s.ok && s.rule.topic !== '*' && (
                    <button
                      type="button"
                      onClick={() => onFilter(s.rule.topic === '*' ? '' : s.rule.topic, s.rule.difficulty === '*' ? '' : s.rule.difficulty)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-red-300 text-red-600 hover:bg-red-100 flex-shrink-0"
                    >
                      Lọc ngay
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {!blueprintAllOk && (
            <p className="mt-2 text-xs text-red-600">
              Thêm câu hỏi vào ngân hàng trước khi mở kỳ thi — vào{' '}
              <Link to="/admin/question-libraries" className="underline font-medium">Quản lý ngân hàng</Link>.
            </p>
          )}
        </div>
      )}
    </>
  );
}
