import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sessionOptionLabel } from '../domain/sessions';
import { usePracticalSessions, useSessionAttempts, useSessionWithTemplate } from '../queries/use-practical-exams';

export default function GradingListPage() {
  const [searchParams] = useSearchParams();
  const sessionsQuery = usePracticalSessions();
  const sessions = sessionsQuery.data ?? [];
  const [selectedSessionId, setSelectedSessionId] = useState(searchParams.get('session') ?? '');
  // Titles are learned one session at a time, as each is chosen.
  const [sessionTitles, setSessionTitles] = useState<Record<string, string>>({});
  const selected = useSessionWithTemplate(selectedSessionId || undefined).data;
  const attempts = useSessionAttempts(selectedSessionId).data ?? [];

  useEffect(() => {
    if (!selectedSessionId && sessionsQuery.data && sessionsQuery.data.length > 0) setSelectedSessionId(sessionsQuery.data[0].id);
  }, [sessionsQuery.data, selectedSessionId]);

  useEffect(() => {
    const title = selected?.template?.title;
    if (selected && title) setSessionTitles((prev) => ({ ...prev, [selected.id]: title }));
  }, [selected]);

  if (sessionsQuery.isLoading) return <p className="text-slate-500">Đang tải...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Chấm thi thực hành</h1>
        <Link to="/admin/practical-sessions" className="text-slate-600 hover:text-slate-900 text-sm">
          ← Kỳ thi
        </Link>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Kỳ thi</label>
        <select
          value={selectedSessionId}
          onChange={(e) => setSelectedSessionId(e.target.value)}
          className="w-full max-w-md border border-slate-300 rounded-lg px-3 py-2"
        >
          <option value="">— Chọn kỳ thi —</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{sessionOptionLabel(s, sessionTitles[s.id])}</option>
          ))}
        </select>
      </div>
      {selectedSessionId && (
        <>
          <p className="text-slate-600 text-sm mb-2">Số bài: {attempts.length}</p>
          <ul className="space-y-2">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-700">
                  User {(a.user_id ?? a.student_id ?? '').slice(0, 8)}... — {a.status}
                  {a.total_score != null && ` — ${a.total_score} điểm`}
                </span>
                <Link to={`/admin/practical-grading/${a.id}`} className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
                  Chấm
                </Link>
              </li>
            ))}
          </ul>
          {attempts.length === 0 && <p className="text-slate-500 text-sm">Chưa có bài làm nào trong kỳ này.</p>}
        </>
      )}
    </div>
  );
}
