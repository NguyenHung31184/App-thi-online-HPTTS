import { useState } from 'react';
import type { RegulationStatus } from '../../domain/regulation';

interface RegulationGateProps {
  regulation: RegulationStatus;
  onConfirm: () => void;
  onBack: () => void;
  busy?: boolean;
  error?: string;
}

/**
 * Shown once, before the first exam: the student opens the centre's training regulation and confirms having read it
 * (Circular 79, Article 47(2)). The tick unlocks only after the file was opened.
 */
export function RegulationGate({ regulation, onConfirm, onBack, busy, error }: RegulationGateProps) {
  const [opened, setOpened] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <p className="text-sm font-medium text-slate-600">Trước lần thi đầu tiên</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Đọc Quy chế đào tạo</h1>
        <p className="mt-3 text-sm text-slate-700">
          Quy chế ghi quyền và nghĩa vụ của học viên, cách kiểm tra, thi và công nhận kết quả. Mở file, đọc hết rồi xác
          nhận bên dưới. Chỉ cần làm một lần; khi trung tâm thay Quy chế mới, bạn sẽ được hỏi lại.
        </p>
        <a
          href={regulation.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpened(true)}
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800 hover:bg-indigo-100"
        >
          <span>{regulation.title}</span>
          <span className="shrink-0">Mở file</span>
        </a>

        <div className="mt-6 pt-4 border-t border-slate-200">
          <label className={`flex items-start gap-3 text-sm ${opened ? 'text-slate-800 cursor-pointer' : 'text-slate-500'}`}>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={!opened}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>Tôi đã đọc và hiểu Quy chế đào tạo của trung tâm.</span>
          </label>
          {!opened && <p className="mt-2 text-xs text-slate-600">Mở file Quy chế trước rồi mới xác nhận được.</p>}
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onBack}
              className="h-11 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Quay lại
            </button>
            <button
              type="button"
              disabled={!confirmed || busy}
              onClick={onConfirm}
              className="h-11 px-4 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Đang ghi' : 'Xác nhận và tiếp tục'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
