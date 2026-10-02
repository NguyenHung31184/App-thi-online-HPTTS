import type { Exam, ExamWindow } from '../../../../types';
import { windowOptionLabel, type ClassLabelInfo, type TrialFilter } from '../../domain/report-filters';

interface ReportFilterPanelProps {
  trial: TrialFilter;
  onTrialChange: (value: TrialFilter) => void;
  classes: { id: string; label: string }[];
  classId: string;
  onClassChange: (id: string) => void;
  exams: Exam[];
  examId: string;
  onExamChange: (id: string) => void;
  windows: ExamWindow[];
  windowId: string;
  onWindowChange: (id: string) => void;
  classNames: Record<string, ClassLabelInfo>;
}

const TRIAL_CHOICES: [TrialFilter, string][] = [['all', 'Tất cả'], ['real', 'Thi thật'], ['trial', 'Thi thử']];

function trialButtonClass(selected: boolean, value: TrialFilter): string {
  const active = value === 'trial'
    ? 'bg-slate-600 text-white border-slate-600'
    : value === 'real'
      ? 'bg-indigo-600 text-white border-indigo-600'
      : 'bg-slate-800 text-white border-slate-800';
  return `px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
    selected ? active : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
  }`;
}

/** Trial or real, class, exam, then one window; each choice narrows the next list. */
export function ReportFilterPanel(props: ReportFilterPanelProps) {
  const { trial, classes, classId, exams, examId, windows, windowId, classNames } = props;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 min-w-[4.5rem]">Loại kỳ thi</span>
        <div className="flex gap-1.5">
          {TRIAL_CHOICES.map(([value, label]) => (
            <button key={value} type="button" className={trialButtonClass(trial === value, value)} onClick={() => props.onTrialChange(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Lớp</label>
          <select
            value={classId}
            onChange={(e) => props.onClassChange(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[200px] bg-white"
          >
            <option value="">-- Tất cả lớp --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">
            Đề thi / Môn
            {exams.length > 0 && <span className="ml-1 text-slate-400">({exams.length})</span>}
          </label>
          <select
            value={examId}
            onChange={(e) => props.onExamChange(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[220px] bg-white"
          >
            <option value="">-- Tất cả đề thi --</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">
          Kỳ thi cụ thể
          {windows.length > 0 && <span className="ml-1 text-slate-400">({windows.length} kỳ)</span>}
        </label>
        <select
          value={windowId}
          onChange={(e) => props.onWindowChange(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[320px] bg-white"
          disabled={windows.length === 0}
        >
          <option value="">-- Tất cả kỳ phù hợp --</option>
          {windows.map((w) => (
            <option key={w.id} value={w.id}>{windowOptionLabel(w, classNames)}</option>
          ))}
        </select>
        {windows.length === 0 && (classId || examId || trial !== 'all') && (
          <p className="text-xs text-slate-400">Không có kỳ thi phù hợp với bộ lọc.</p>
        )}
      </div>
    </div>
  );
}
