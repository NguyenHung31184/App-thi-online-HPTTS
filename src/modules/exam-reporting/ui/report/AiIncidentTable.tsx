import type { ViolationReportRow } from '../../domain/report-rows';

const SIGNAL_LABELS: Record<string, string> = {
  ai_no_face: 'Không thấy khuôn mặt',
  ai_multiple_face: 'Nhiều khuôn mặt',
  ai_cell_phone: 'Điện thoại',
  ai_prohibited_object: 'Sách hoặc vật cấm',
};

const FRAME_LABELS: Record<string, string> = { before: 'Trước', during: 'Phát hiện', after: 'Sau' };

const REVIEW_LABELS: Record<string, string> = { confirmed: 'Đã xác nhận', rejected: 'Nhận diện nhầm' };

interface AiIncidentTableProps {
  rows: ViolationReportRow[];
  reviewingId: string | null;
  onReview: (id: string, decision: 'confirmed' | 'rejected') => void;
}

/** AI incidents with their evidence frames; staff confirm them or mark a false detection. */
export function AiIncidentTable({ rows, reviewingId, onReview }: AiIncidentTableProps) {
  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-slate-800">Sự việc AI và bằng chứng</h2>
      <p className="mt-1 text-sm text-slate-600">Giám thị có thể xác nhận hoặc loại các trường hợp AI nhận diện nhầm.</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Học viên</th>
              <th className="px-3 py-2">Tín hiệu</th>
              <th className="px-3 py-2 text-center">Điểm</th>
              <th className="px-3 py-2">Bằng chứng</th>
              <th className="px-3 py-2">Kết quả kiểm tra</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.created_at}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{row.user_name || row.user_email || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{SIGNAL_LABELS[row.event] ?? ''}</td>
                <td className="px-3 py-2 text-center font-semibold text-amber-800">{row.risk_points}</td>
                <td className="px-3 py-2">
                  {row.evidence.length > 0 ? (
                    <span className="flex flex-wrap gap-2">
                      {row.evidence.map((frame) => (
                        <a
                          key={`${row.id}-${frame.phase}`}
                          href={frame.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-indigo-700 hover:underline"
                        >
                          {FRAME_LABELS[frame.phase] ?? 'Ảnh'}
                        </a>
                      ))}
                    </span>
                  ) : row.evidence_url ? (
                    <a href={row.evidence_url} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">
                      Mở ảnh
                    </a>
                  ) : <span className="text-slate-400">Không có ảnh</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-600">{REVIEW_LABELS[row.review_status] ?? 'Chưa kiểm tra'}</span>
                    <button
                      type="button"
                      disabled={reviewingId === row.id}
                      onClick={() => onReview(row.id, 'confirmed')}
                      className="min-h-9 rounded-md border border-emerald-300 px-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      Xác nhận
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === row.id}
                      onClick={() => onReview(row.id, 'rejected')}
                      className="min-h-9 rounded-md border border-slate-300 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Nhận diện nhầm
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
