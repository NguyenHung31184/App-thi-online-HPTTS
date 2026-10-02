import type { TemplateDraft } from '../../application/import-template';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const aggregateText = { average: 'trung bình các chu kỳ', fastest: 'chu kỳ nhanh nhất', last: 'chu kỳ cuối' } as const;

/** What the file gave: steps, time bands, criteria with their deductions, protective equipment and faults. */
export function DraftPreview({ draft }: { draft: TemplateDraft }) {
  const stepName = (key: string | null) => (key ? draft.config.steps.find((s) => s.key === key)?.name ?? key : 'Mọi bước');
  const total = draft.criteria.reduce((sum, c) => sum + c.maxScore, 0);
  const box = 'bg-white rounded-xl border border-slate-200 shadow-sm p-4';
  return (
    <div className="space-y-4">
      <section className={box}>
        <h2 className="font-semibold text-slate-800 mb-2">Bước thao tác</h2>
        {draft.config.steps.length === 0 ? <p className="text-sm text-slate-600">Không có bước; giáo viên chấm mọi tiêu chí trên một màn.</p> : (
          <ol className="list-decimal pl-5 text-sm text-slate-800 space-y-1">
            {draft.config.steps.map((s) => (
              <li key={s.key}>{s.name}{s.cycle && <span className="text-brand-700"> · chu kỳ bấm giờ</span>}{s.photo && <span className="text-slate-600"> · ảnh: {s.photo}</span>}</li>
            ))}
          </ol>
        )}
        <p className="text-sm text-slate-700 mt-3">
          {draft.config.time
            ? <>Thời gian: dưới {clock(draft.config.time.limits[0])} được {draft.config.time.points[0]}, dưới {clock(draft.config.time.limits[1])} được {draft.config.time.points[1]}, dưới {clock(draft.config.time.limits[2])} được {draft.config.time.points[2]}, từ {clock(draft.config.time.limits[2])} được 0; tính {aggregateText[draft.config.time.aggregate]}.</>
            : 'Không có khung thời gian.'}
        </p>
      </section>

      <section className={box}>
        <h2 className="font-semibold text-slate-800 mb-2">Tiêu chí <span className={`font-normal ${total === 100 ? 'text-slate-600' : 'text-amber-700'}`}>· tổng {total} điểm</span></h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-600 border-b border-slate-200">
              <tr><th className="py-2 pr-3">#</th><th className="py-2 pr-3">Tiêu chí</th><th className="py-2 pr-3 text-right">Tối đa</th><th className="py-2 pr-3">Bước</th><th className="py-2">Lỗi trừ nhanh</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {draft.criteria.map((c, i) => (
                <tr key={`${c.name}-${i}`} className="align-top">
                  <td className="py-2 pr-3 text-slate-500">C{i + 1}</td>
                  <td className="py-2 pr-3 text-slate-900">{c.name}{c.description && <span className="block text-xs text-slate-500">{c.description}</span>}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.maxScore}</td>
                  <td className="py-2 pr-3 text-slate-700">{stepName(c.stepKey)}</td>
                  <td className="py-2 text-slate-700">{c.kind === 'time' ? 'Tự tính theo khung thời gian' : c.deductions.map((d) => `${d.label} −${d.points}`).join('; ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={box}>
          <h2 className="font-semibold text-slate-800 mb-2">Bảo hộ lao động</h2>
          <ul className="list-disc pl-5 text-sm text-slate-800">{draft.config.ppe.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
        <section className={box}>
          <h2 className="font-semibold text-slate-800 mb-2">Lỗi loại trực tiếp</h2>
          <ul className="list-disc pl-5 text-sm text-slate-800">{draft.config.disqualifyReasons.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
      </div>
    </div>
  );
}
