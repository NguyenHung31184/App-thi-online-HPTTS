import type { BlueprintRule, QuestionBankItem } from '../../../../types';

const DIFFICULTY_BADGE: Record<string, { label: string; cls: string }> = {
  easy:   { label: 'Dễ',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  medium: { label: 'Trung bình', cls: 'bg-amber-100   text-amber-700   border-amber-200' },
  hard:   { label: 'Khó',       cls: 'bg-red-100     text-red-700     border-red-200' },
};

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const cfg = DIFFICULTY_BADGE[difficulty] ?? { label: difficulty, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function DrawFreqBadge({ count }: { count: number }) {
  if (count === 0) return null;
  const cls =
    count >= 10 ? 'bg-orange-100 text-orange-700 border-orange-200' :
    count >= 5  ? 'bg-amber-100  text-amber-700  border-amber-200'  :
                  'bg-slate-100  text-slate-500  border-slate-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cls}`}>
      {count} lần bốc
    </span>
  );
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

export function QuestionPreviewModal({
  question,
  frequency,
  onClose,
}: {
  question: QuestionBankItem | null;
  frequency: Record<string, number>;
  onClose: () => void;
}) {
  if (!question) return null;
  const opts = Array.isArray(question.options) ? (question.options as { id: string; text: string }[]) : [];
  const drawCount = frequency[question.id] ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <DifficultyBadge difficulty={question.difficulty} />
            {question.topic && (
              <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{question.topic}</span>
            )}
            <span className="text-[11px] text-slate-400">{question.points} điểm</span>
            {drawCount > 0 && <DrawFreqBadge count={drawCount} />}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">
          {question.image_url && (
            <img src={question.image_url} alt="" className="mb-3 rounded-lg max-h-40 object-contain w-full border border-slate-100" />
          )}
          <p className="text-sm font-medium text-slate-800 leading-relaxed mb-4">{question.stem}</p>
          <div className="space-y-2">
            {opts.map((opt) => {
              const isCorrect = opt.id === question.answer_key;
              return (
                <div
                  key={opt.id}
                  className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-sm ${
                    isCorrect
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {isCorrect && (
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{opt.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Simulate Draw Modal ───────────────────────────────────────────────────────

export function SimulateDrawModal({
  drawn,
  blueprint,
  onReroll,
  onClose,
}: {
  drawn: QuestionBankItem[];
  blueprint: BlueprintRule[];
  onReroll: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <div>
            <p className="font-semibold text-slate-800">Mô phỏng bốc thăm</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {drawn.length} câu — theo blueprint {blueprint.map((r) => `${r.count} ${r.topic === '*' ? '' : r.topic}`).join(' + ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReroll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Bốc lại
            </button>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-3 space-y-1.5">
          {drawn.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Không bốc được câu nào — ngân hàng thiếu câu theo blueprint.</p>
          ) : (
            drawn.map((q, idx) => (
              <div key={q.id} className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
                <span className="text-xs text-slate-400 w-5 flex-shrink-0 pt-0.5">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-snug">{q.stem.slice(0, 100)}{q.stem.length > 100 ? '…' : ''}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <DifficultyBadge difficulty={q.difficulty} />
                    {q.topic && <span className="text-[10px] text-slate-400">{q.topic}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
