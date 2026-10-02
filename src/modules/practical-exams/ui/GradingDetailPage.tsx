import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../identity-access/public';
import { canSyncToTtdt, scoreRange, scoresByCriteria } from '../domain/grading';
import {
  useCriteria, useGradeAttempt, usePhotos, usePracticalAttempt, useScores, useSessionWithTemplate, useSyncGrade, useTtdtSyncEnabled,
} from '../queries/use-practical-exams';

/** A teacher scores each criterion against the student's photos, then sends the grade to TTDT. */
export default function GradingDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const attemptQuery = usePracticalAttempt(attemptId);
  const attempt = attemptQuery.data ?? null;
  const session = useSessionWithTemplate(attempt?.session_id).data ?? null;
  const criteria = useCriteria(session?.template_id).data ?? [];
  const photos = usePhotos(attempt ? attemptId : undefined).data ?? [];
  const savedScores = useScores(attempt ? attemptId : undefined).data;
  const grade = useGradeAttempt();
  const sync = useSyncGrade();
  const syncEnabled = useTtdtSyncEnabled();

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    if (savedScores) setScores(scoresByCriteria(savedScores));
  }, [savedScores]);

  const loadError = attemptQuery.error ? 'Lỗi tải dữ liệu.' : attemptQuery.isSuccess && !attempt ? 'Không tìm thấy bài làm.' : '';

  const handleSave = () => {
    if (!attemptId || !attempt || !user?.id) return;
    setError('');
    grade.mutate({ attemptId, criteria, scores, comments, gradedBy: user.id }, {
      onError: (e) => setError(e instanceof Error ? e.message : 'Lỗi lưu điểm.'),
    });
  };

  const handleSync = () => {
    if (!attempt || !canSyncToTtdt(attempt) || !session) return;
    setSyncMessage('');
    sync.mutate({ attempt, session }, {
      onSuccess: (result) => setSyncMessage(result.success ? 'Đã đồng bộ sang TTDT.' : (result.message ?? 'Lỗi đồng bộ.')),
      onError: (e) => setSyncMessage(e instanceof Error ? e.message : 'Lỗi đồng bộ.'),
    });
  };

  if (loadError && !attempt) return <p className="text-red-600">{loadError}</p>;
  if (!attempt || !session) return <p className="text-slate-500">Đang tải...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Chấm bài thi thực hành</h1>
        <button type="button" onClick={() => navigate('/admin/practical-grading')} className="text-slate-600 hover:text-slate-900 text-sm">
          ← Danh sách
        </button>
      </div>
      <p className="text-slate-600 text-sm mb-2">
        Kỳ: {session.template?.title} — User: {(attempt.user_id ?? attempt.student_id ?? '').slice(0, 8)}... — Trạng thái: {attempt.status}
        {attempt.synced_to_ttdt_at && <span className="text-green-600 ml-2">Đã đồng bộ TTDT</span>}
      </p>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      {syncMessage && <p className="text-slate-600 text-sm mb-2">{syncMessage}</p>}

      <div className="mb-6">
        <h2 className="font-medium text-slate-800 mb-2">Ảnh thí sinh nộp</h2>
        <div className="flex flex-wrap gap-2">
          {photos.length === 0 ? (
            <p className="text-slate-500 text-sm">Chưa có ảnh.</p>
          ) : (
            photos.map((p) => (
              <div key={p.id} className="border rounded overflow-hidden">
                <img src={p.file_url} alt={p.label || 'Ảnh'} className="w-32 h-32 object-cover" />
                {p.label && <p className="text-xs p-1 bg-slate-50">{p.label}</p>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <h2 className="font-medium text-slate-800">Điểm từng tiêu chí</h2>
        {criteria.map((c) => {
          const { max, step } = scoreRange(c);
          return (
            <div key={c.id} className="p-4 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-800">{c.name}</p>
              {c.description && <p className="text-sm text-slate-600 mb-1">{c.description}</p>}
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <span className="text-sm text-slate-700">Điểm (0 – {max}):</span>
                  <input
                    type="range"
                    min={0}
                    max={max}
                    step={step}
                    value={scores[c.id] ?? 0}
                    onChange={(e) => setScores((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
                    className="w-40"
                  />
                  <span className="font-mono w-8">{scores[c.id] ?? 0}</span>
                </label>
                <input
                  type="text"
                  value={comments[c.id] ?? ''}
                  onChange={(e) => setComments((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder="Ghi chú (tùy chọn)"
                  className="flex-1 min-w-[120px] border border-slate-300 rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={grade.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {grade.isPending ? 'Đang lưu...' : 'Lưu điểm và hoàn tất chấm'}
        </button>
        {attempt.status === 'graded' && syncEnabled && (
          <button type="button" onClick={handleSync} disabled={sync.isPending} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {sync.isPending ? 'Đang đồng bộ...' : 'Đồng bộ sang TTDT'}
          </button>
        )}
        <button type="button" onClick={() => navigate('/admin/practical-grading')} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
          Quay lại
        </button>
      </div>
    </div>
  );
}
