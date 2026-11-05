import { useState, type ReactNode } from 'react';
import { needsRegulationAck, type RegulationStatus } from '../domain/regulation';
import { useAcknowledgeRegulation, useMyRegulationStatus } from '../queries/use-regulation';

const formatDay = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');

/** File link plus the tick that unlocks only after the file was opened. */
function RegulationPanel({ regulation, eyebrow }: { regulation: RegulationStatus; eyebrow: string }) {
  const acknowledge = useAcknowledgeRegulation();
  const [opened, setOpened] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const error = acknowledge.error instanceof Error ? acknowledge.error.message : '';
  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <p className="text-sm font-medium text-slate-600">{eyebrow}</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Đọc Quy chế đào tạo</h1>
        <p className="mt-3 text-sm text-slate-700">
          Quy chế ghi quyền và nghĩa vụ của học viên, cách kiểm tra, thi và công nhận kết quả. Mở file, đọc hết rồi xác
          nhận bên dưới. Chỉ cần làm một lần; khi trung tâm thay Quy chế mới, bạn sẽ được hỏi lại.
        </p>
        <RegulationLink regulation={regulation} onOpen={() => setOpened(true)} />

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
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={!confirmed || acknowledge.isPending}
              onClick={() => acknowledge.mutate(regulation.version)}
              className="h-11 px-4 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {acknowledge.isPending ? 'Đang ghi' : 'Xác nhận'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegulationLink({ regulation, onOpen }: { regulation: RegulationStatus; onOpen?: () => void }) {
  return (
    <a
      href={regulation.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800 hover:bg-indigo-100"
    >
      <span>{regulation.title}</span>
      <span className="shrink-0">Mở file</span>
    </a>
  );
}

/**
 * First sign-in check (Circular 79, Article 47(2)): until the student confirms the published regulation, the student
 * pages show it instead of their content. Loading, a failed load or no published file never block.
 */
export function RegulationFirstLoginGate({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const status = useMyRegulationStatus(enabled);
  if (enabled && status.data && needsRegulationAck(status.data)) {
    // A new file version (regulation_changed) must be opened again before the tick unlocks.
    return <RegulationPanel key={status.data.version} regulation={status.data} eyebrow="Trước khi bắt đầu khóa học" />;
  }
  return <>{children}</>;
}

/** Menu page "Quy chế đào tạo": read the file again any time; confirm here if not yet done. */
export default function RegulationPage() {
  const status = useMyRegulationStatus(true);
  if (status.isLoading) return <p className="p-4 text-slate-500">Đang tải...</p>;
  if (status.isError) return <p className="p-4 text-red-600">Không tải được Quy chế. Kiểm tra kết nối rồi tải lại trang.</p>;
  const regulation = status.data;
  if (!regulation) return <p className="p-4 text-slate-600">Trung tâm chưa đăng Quy chế đào tạo.</p>;
  if (needsRegulationAck(regulation)) {
    return <RegulationPanel key={regulation.version} regulation={regulation} eyebrow="Quy chế đào tạo" />;
  }
  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <h1 className="text-xl font-bold text-slate-900">Quy chế đào tạo</h1>
        <p className="mt-2 text-sm text-slate-700">
          Bạn đã xác nhận đọc bản này ngày {formatDay(regulation.acknowledgedAt as string)}.
        </p>
        <RegulationLink regulation={regulation} />
      </div>
    </div>
  );
}
