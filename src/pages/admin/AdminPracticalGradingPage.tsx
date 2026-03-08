import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  listPracticalSessions,
  getPracticalSessionWithTemplate,
} from '../../services/practicalSessionService';
import { listPracticalAttemptsBySession } from '../../services/practicalAttemptService';
import type { PracticalAttempt, PracticalExamSession } from '../../types';

export default function AdminPracticalGradingPage() {
  const [searchParams] = useSearchParams();
  const sessionIdParam = searchParams.get('session');
  const [sessions, setSessions] = useState<PracticalExamSession[]>([]);
  const [sessionTitles, setSessionTitles] = useState<Record<string, string>>({});
  const [selectedSessionId, setSelectedSessionId] = useState(sessionIdParam ?? '');
  const [attempts, setAttempts] = useState<PracticalAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPracticalSessions().then((list) => {
      setSessions(list);
      if (list.length > 0 && !selectedSessionId) setSelectedSessionId(list[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setAttempts([]);
      return;
    }
    getPracticalSessionWithTemplate(selectedSessionId).then((s) => {
      if (s?.template) setSessionTitles((prev) => ({ ...prev, [selectedSessionId]: s.template!.title }));
    }).catch(() => {});
    listPracticalAttemptsBySession(selectedSessionId).then(setAttempts).catch(() => setAttempts([]));
  }, [selectedSessionId]);

  if (loading) return <p className="text-slate-500">Đang tải...</p>;

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
            <option key={s.id} value={s.id}>
              {sessionTitles[s.id] ?? s.id.slice(0, 8)} — {new Date(s.start_at).toLocaleDateString('vi-VN')}
            </option>
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
                  User {a.user_id.slice(0, 8)}... — {a.status}
                  {a.total_score != null && ` — ${a.total_score} điểm`}
                </span>
                <Link
                  to={`/admin/practical-grading/${a.id}`}
                  className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                >
                  Chấm
                </Link>
              </li>
            ))}
          </ul>
          {attempts.length === 0 && (
            <p className="text-slate-500 text-sm">Chưa có bài làm nào trong kỳ này.</p>
          )}
        </>
      )}
    </div>
  );
}
