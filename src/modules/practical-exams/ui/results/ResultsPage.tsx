import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ResultRow, ResultSummary } from '../../application/results';
import { usePracticalSessions, useSessionNames, useSessionResults } from '../../queries/use-practical-exams';
import { StateBadge } from './StateBadge';

const day = (ts: number) => new Date(ts).toLocaleDateString('vi-VN');
const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

function Summary({ summary }: { summary: ResultSummary }) {
  const tiles: [string, number | string][] = [
    ['Đã xong', `${summary.done}/${summary.students}`],
    ['Đang chấm', summary.grading],
    ['Chưa chấm', summary.waiting],
    ['Đạt', summary.passed],
    ['Không đạt', summary.notPassed],
    ['Thiếu bảo hộ', summary.notEligible],
    ['Chờ gửi TTDT', summary.toSend],
  ];
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {tiles.map(([label, value]) => (
        <div key={label} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
          <dt className="text-xs text-slate-600">{label}</dt>
          <dd className="text-xl font-semibold text-slate-900 tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Score({ row }: { row: ResultRow }) {
  if (row.total == null) return <span className="text-slate-400">—</span>;
  if (row.state === 'grading') return <span className="text-slate-600">{row.total} <span className="text-xs">tạm tính</span></span>;
  return <span className="font-semibold text-slate-900">{row.total}</span>;
}

/** Results of a field-graded practical session, refreshed while the examiners work. */
export default function ResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionsQuery = usePracticalSessions();
  const sessions = sessionsQuery.data ?? [];
  const names = useSessionNames(sessionsQuery.data).data;
  const [sessionId, setSessionId] = useState(searchParams.get('session') ?? '');
  const results = useSessionResults(sessionId);

  useEffect(() => {
    const first = sessionsQuery.data?.[0];
    if (!sessionId && first) setSessionId(first.id);
  }, [sessionsQuery.data, sessionId]);

  const choose = (id: string) => {
    setSessionId(id);
    setSearchParams(id ? { session: id } : {}, { replace: true });
  };

  if (sessionsQuery.isLoading) return <p className="text-slate-500">Đang tải...</p>;
  const data = results.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Kết quả thi thực hành</h1>
          <p className="text-sm text-slate-600">Giáo viên chấm trên Sổ chuyên cần. Trang này chỉ xem, tự cập nhật mỗi 10 giây.</p>
        </div>
        {results.dataUpdatedAt > 0 && (
          <p className="text-sm text-slate-600" aria-live="polite">
            {results.isFetching ? 'Đang cập nhật…' : `Cập nhật lúc ${new Date(results.dataUpdatedAt).toLocaleTimeString('vi-VN')}`}
          </p>
        )}
      </div>

      <label className="block max-w-2xl">
        <span className="block text-sm font-medium text-slate-700 mb-1">Kỳ thi</span>
        <select value={sessionId} onChange={(e) => choose(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2">
          <option value="">— Chọn kỳ thi —</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {names?.classNames[s.class_id] ?? 'Lớp'} — {names?.titles[s.template_id] ?? 'Mẫu'} — {day(s.start_at)}
            </option>
          ))}
        </select>
      </label>

      {sessions.length === 0 && <p className="text-slate-600">Chưa có kỳ thi thực hành nào. Tạo ở mục Ca thi thực hành.</p>}
      {results.error && <p className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">Không tải được kết quả. Trang sẽ thử lại.</p>}
      {sessionId && results.isLoading && <p className="text-slate-500">Đang tải kết quả...</p>}

      {data && (
        <>
          <p className="text-sm text-slate-700">{data.className} · {data.templateTitle} · đạt từ {data.passScore}/100</p>
          <Summary summary={data.summary} />
          <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600">
                <tr>
                  <th className="px-4 py-2 w-10">#</th>
                  <th className="px-4 py-2">Học viên</th>
                  <th className="px-4 py-2">Trạng thái</th>
                  <th className="px-4 py-2 text-right">Điểm /100</th>
                  <th className="px-4 py-2 text-right">Điểm /10</th>
                  <th className="px-4 py-2">Kết quả</th>
                  <th className="px-4 py-2">TTDT</th>
                  <th className="px-4 py-2">Khóa lúc</th>
                  <th className="px-4 py-2"><span className="sr-only">Chi tiết</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-500">Lớp chưa có học viên.</td></tr>
                )}
                {data.rows.map((r, i) => (
                  <tr key={r.studentId} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2 text-slate-900">{r.name}</td>
                    <td className="px-4 py-2"><StateBadge state={r.state} /></td>
                    <td className="px-4 py-2 text-right tabular-nums"><Score row={r} /></td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.outOf10 == null ? <span className="text-slate-400">—</span> : r.outOf10.toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-2">
                      {r.passed == null ? <span className="text-slate-400">—</span> : r.passed
                        ? <span className="font-medium text-emerald-700">Đạt</span>
                        : <span className="font-medium text-red-700">Không đạt</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {r.state !== 'graded' && r.state !== 'disqualified' ? <span className="text-slate-400">—</span> : r.synced ? 'Đã gửi' : 'Chờ gửi'}
                    </td>
                    <td className="px-4 py-2 text-slate-600 tabular-nums">{r.gradedAt ? time(r.gradedAt) : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-2 text-right">
                      {r.attemptId && r.state !== 'waiting' && (
                        <Link to={`/admin/practical-grading/${r.attemptId}`} className="text-brand-700 font-medium hover:underline">Xem</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
