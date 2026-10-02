import type { WindowProctoringMode } from '../../domain/exam-inputs';

interface TrialToggleProps {
  isTrial: boolean;
  onChange: (value: boolean) => void;
  /** Attempts already taken while the window was a trial; a real exam must start in a new window. */
  lockedAttempts: number | null;
}

export function TrialToggle({ isTrial, onChange, lockedAttempts }: TrialToggleProps) {
  const locked = lockedAttempts !== null;
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 transition-colors ${
        locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'
      }`}
    >
      <input
        type="checkbox"
        checked={isTrial}
        disabled={locked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded text-indigo-600 accent-indigo-600"
      />
      <div>
        <span className="text-sm font-medium text-slate-800">Kỳ thi thử / kiểm tra nội dung</span>
        <p className="text-xs text-slate-500 mt-0.5">
          Học viên thi bình thường nhưng điểm <strong>không</strong> được ghi vào hệ thống quản lý. Không bắt buộc chọn Lớp và Mô-đun.
        </p>
        {locked && (
          <p className="text-xs text-amber-700 mt-1 font-medium">
            Đã có {lockedAttempts} lượt thi trong cửa sổ này khi còn là thi thử — không thể chuyển sang thi thật trên cùng cửa sổ
            (các lượt thi thử cũ sẽ bị tính vào giới hạn số lần thi, có thể khoá học viên ngay lần đầu). Hãy tạo cửa sổ thi mới cho kỳ thi thật.
          </p>
        )}
      </div>
    </label>
  );
}

const PROCTORING_MODES = [
  ['standard', 'Tiêu chuẩn', 'Cảnh báo và lưu bằng chứng để kiểm tra, không tự nộp do AI.'],
  ['strict', 'Nghiêm ngặt', 'Cộng điểm rủi ro; đủ ngưỡng và ít nhất hai sự việc thì tự nộp.'],
  ['supervised', 'Có giám thị', 'Gửi sự việc để giám thị xác nhận hoặc đánh dấu nhận diện nhầm.'],
] as const satisfies readonly (readonly [WindowProctoringMode, string, string])[];

interface AiProctoringFieldsetProps {
  mode: WindowProctoringMode;
  onModeChange: (mode: WindowProctoringMode) => void;
  riskThreshold: number;
  onRiskThresholdChange: (value: number) => void;
}

export function AiProctoringFieldset({ mode, onModeChange, riskThreshold, onRiskThresholdChange }: AiProctoringFieldsetProps) {
  return (
    <fieldset className="rounded-xl border border-slate-300 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-800">Giám sát AI</legend>
      <p className="mb-3 text-xs text-slate-600">
        AI chỉ ghi nhận khi tín hiệu tồn tại qua nhiều lần quét. Mỗi sự việc lưu ảnh trước, trong và sau thời điểm phát hiện.
      </p>
      <div className="space-y-2">
        {PROCTORING_MODES.map(([value, label, description]) => (
          <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
            <input
              type="radio"
              name="proctoring_mode"
              value={value}
              checked={mode === value}
              onChange={() => onModeChange(value)}
              className="mt-1 accent-indigo-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">{label}</span>
              <span className="block text-xs text-slate-600">{description}</span>
            </span>
          </label>
        ))}
      </div>
      {mode === 'strict' && (
        <div className="mt-4 max-w-xs">
          <label htmlFor="ai-risk-threshold" className="block text-sm font-medium text-slate-700">
            Ngưỡng tự nộp do AI
          </label>
          <select
            id="ai-risk-threshold"
            value={riskThreshold}
            onChange={(event) => onRiskThresholdChange(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((score) => (
              <option key={score} value={score}>{score} điểm</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Mặc định 6 điểm; luôn cần ít nhất hai sự việc AI độc lập.</p>
        </div>
      )}
    </fieldset>
  );
}

// 0 means unlimited; the attempt limit check skips max_attempts <= 0.
const ATTEMPT_CHOICES: [number, string][] = [[2, '2 lần'], [3, '3 lần'], [4, '4 lần'], [0, 'Không giới hạn']];

const ATTEMPT_HINTS: Record<number, string> = {
  2: '1 lần thi + 1 lần thi lại (mặc định theo quy định)',
  3: '1 lần thi + 2 lần thi lại',
  4: '1 lần thi + 3 lần thi lại (tối đa)',
  0: 'Học viên được thi lại không giới hạn số lần trong cửa sổ này',
};

export function MaxAttemptsPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">Số lần thi tối đa mỗi học viên</label>
      <div className="flex gap-2">
        {ATTEMPT_CHOICES.map(([n, label]) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              value === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-1.5">{ATTEMPT_HINTS[value] ?? ''}</p>
    </div>
  );
}
