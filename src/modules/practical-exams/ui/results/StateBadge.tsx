import type { ResultState } from '../../application/results';

const states: Record<ResultState, { label: string; className: string }> = {
  waiting: { label: 'Chưa chấm', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  grading: { label: 'Đang chấm', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  graded: { label: 'Đã khóa', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  disqualified: { label: 'Loại thi', className: 'bg-red-50 text-red-800 border-red-200' },
  not_eligible: { label: 'Thiếu bảo hộ', className: 'bg-amber-50 text-amber-900 border-amber-200' },
};

export function StateBadge({ state }: { state: ResultState }) {
  const s = states[state];
  return <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap ${s.className}`}>{s.label}</span>;
}
