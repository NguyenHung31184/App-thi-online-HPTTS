import { useMemo } from 'react';
import { searchViolationSummaries, summarizeViolations, type ViolationReportRow } from '../../domain/report-rows';
import { AiIncidentTable } from './AiIncidentTable';
import { exportViolationsToExcel } from './download-report';

interface SignalsTabProps {
  rows: ViolationReportRow[];
  /** Kept by the page so it survives a reload. */
  search: string;
  onSearchChange: (value: string) => void;
  reviewingId: string | null;
  reviewError: string;
  onReview: (id: string, decision: 'confirmed' | 'rejected') => void;
}

const COUNT_COLUMNS = [
  ['focusLostCount', 'Mất focus'],
  ['visibilityHiddenCount', 'Ẩn tab / thu nhỏ'],
  ['fullscreenExitedCount', 'Thoát fullscreen'],
  ['copyPasteBlockedCount', 'Copy/Paste bị chặn'],
  ['photoTakenCount', 'Ảnh webcam'],
  ['aiNoFaceCount', 'Không mặt'],
  ['aiMultipleFaceCount', 'Nhiều mặt'],
  ['aiCellPhoneCount', 'Điện thoại'],
  ['aiProhibitedObjectCount', 'Sách/vật cấm'],
] as const;

/** Signals counted per attempt (exported to Excel), then the AI incidents to review. */
export function SignalsTab({ rows, search, onSearchChange, reviewingId, reviewError, onReview }: SignalsTabProps) {
  const summaries = useMemo(() => summarizeViolations(rows), [rows]);
  const shown = useMemo(() => searchViolationSummaries(summaries, search), [summaries, search]);
  const aiRows = useMemo(() => rows.filter((row) => row.event.startsWith('ai_')), [rows]);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4 print:hidden">
        <button type="button" onClick={() => exportViolationsToExcel(shown)} disabled={rows.length === 0}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
          Xuất Excel
        </button>
      </div>
      <div className="flex flex-col gap-2 mb-3">
        <p className="text-slate-600 text-sm">
          Số tín hiệu đã ghi: <strong>{rows.length}</strong>
        </p>
        <div className="max-w-md">
          <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Lọc theo tên hoặc email học viên" />
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 w-10 text-center">STT</th>
              <th className="px-3 py-2">Lượt thi</th>
              <th className="px-3 py-2">Học viên</th>
              <th className="px-3 py-2">Email</th>
              {COUNT_COLUMNS.map(([key, label]) => (
                <th key={key} className="px-3 py-2 text-center">{label}</th>
              ))}
              <th className="px-3 py-2 text-center">Điểm AI</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, idx) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-center text-xs text-slate-500">{idx + 1}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500" title={r.attempt_id}>{r.attempt_id.slice(0, 8)}</td>
                <td className="px-3 py-2">
                  <div className="text-sm font-medium text-slate-800">{r.user_name || r.user_email || '—'}</div>
                </td>
                <td className="px-3 py-2 text-slate-600">{r.user_email || '—'}</td>
                {COUNT_COLUMNS.map(([key]) => (
                  <td key={key} className="px-3 py-2 text-center font-mono text-xs">{r[key]}</td>
                ))}
                <td className="px-3 py-2 text-center font-semibold text-amber-800">{r.aiRiskScore}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={14} className="px-3 py-4 text-center text-sm text-slate-500">
                  Chưa có tín hiệu giám sát nào phù hợp với bộ lọc đã chọn.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reviewError && <p className="mt-4 text-sm text-red-700" role="alert">{reviewError}</p>}

      {aiRows.length > 0 && <AiIncidentTable rows={aiRows} reviewingId={reviewingId} onReview={onReview} />}
    </>
  );
}
