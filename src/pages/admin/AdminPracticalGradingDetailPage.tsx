import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPracticalAttempt,
  listPracticalPhotos,
  listPracticalScores,
  upsertPracticalScore,
  completePracticalGrading,
} from '../../services/practicalAttemptService';
import { getPracticalSessionWithTemplate } from '../../services/practicalSessionService';
import { listCriteriaByTemplate } from '../../services/practicalTemplateService';
import { syncPracticalAttemptToTtdt, isTtdtSyncConfigured } from '../../services/ttdtSyncService';
import type {
  PracticalAttempt,
  PracticalAttemptPhoto,
  PracticalExamCriteria,
} from '../../types';
import type { PracticalSessionWithTemplate } from '../../services/practicalSessionService';

export default function AdminPracticalGradingDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState<PracticalAttempt | null>(null);
  const [session, setSession] = useState<PracticalSessionWithTemplate | null>(null);
  const [criteria, setCriteria] = useState<PracticalExamCriteria[]>([]);
  const [photos, setPhotos] = useState<PracticalAttemptPhoto[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    if (!attemptId) return;
    getPracticalAttempt(attemptId).then((a) => {
      if (!a) {
        setError('Không tìm thấy bài làm.');
        return;
      }
      setAttempt(a);
      getPracticalSessionWithTemplate(a.session_id).then((s) => {
        setSession(s ?? null);
        if (s?.template_id) listCriteriaByTemplate(s.template_id).then(setCriteria);
      });
      listPracticalPhotos(attemptId).then(setPhotos);
      listPracticalScores(attemptId).then((list) => {
        const map: Record<string, number> = {};
        list.forEach((r) => { map[r.criteria_id] = r.score; });
        setScores(map);
      });
    }).catch(() => setError('Lỗi tải dữ liệu.'));
  }, [attemptId]);

  const setScore = (criteriaId: string, value: number) => {
    setScores((prev) => ({ ...prev, [criteriaId]: value }));
  };

  const handleSaveScores = async () => {
    if (!attemptId || !attempt || !user?.id) return;
    setError('');
    setSaving(true);
    try {
      for (const c of criteria) {
        await upsertPracticalScore(
          attemptId,
          c.id,
          scores[c.id] ?? 0,
          comments[c.id] || null
        );
      }
      await completePracticalGrading(attemptId, criteria, scores, user.id);
      const updated = await getPracticalAttempt(attemptId);
      if (updated) setAttempt(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi lưu điểm.');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncTtdt = async () => {
    if (!attempt || attempt.status !== 'graded' || attempt.total_score == null || !session) return;
    setSyncing(true);
    setSyncMessage('');
    try {
      const result = await syncPracticalAttemptToTtdt(attempt.id, attempt.total_score, {
        classId: session.class_id,
      });
      setSyncMessage(result.success ? 'Đã đồng bộ sang TTDT.' : (result.message ?? 'Lỗi đồng bộ.'));
      if (result.success) {
        const updated = await getPracticalAttempt(attempt.id);
        if (updated) setAttempt(updated);
      }
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : 'Lỗi đồng bộ.');
    } finally {
      setSyncing(false);
    }
  };

  if (error && !attempt) return <p className="text-red-600">{error}</p>;
  if (!attempt || !session) return <p className="text-slate-500">Đang tải...</p>;

  const step = (c: PracticalExamCriteria) => (c.score_step ?? 1);
  const maxScore = (c: PracticalExamCriteria) => c.max_score ?? 10;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Chấm bài thi thực hành</h1>
        <button
          type="button"
          onClick={() => navigate('/admin/practical-grading')}
          className="text-slate-600 hover:text-slate-900 text-sm"
        >
          ← Danh sách
        </button>
      </div>
      <p className="text-slate-600 text-sm mb-2">
        Kỳ: {session.template?.title} — User: {attempt.user_id.slice(0, 8)}... — Trạng thái: {attempt.status}
        {attempt.synced_to_ttdt_at && (
          <span className="text-green-600 ml-2">Đã đồng bộ TTDT</span>
        )}
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
        {criteria.map((c) => (
          <div key={c.id} className="p-4 bg-slate-50 rounded-lg">
            <p className="font-medium text-slate-800">{c.name}</p>
            {c.description && <p className="text-sm text-slate-600 mb-1">{c.description}</p>}
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <label className="flex items-center gap-2">
                <span className="text-sm text-slate-700">Điểm (0 – {maxScore(c)}):</span>
                <input
                  type="range"
                  min={0}
                  max={maxScore(c)}
                  step={step(c)}
                  value={scores[c.id] ?? 0}
                  onChange={(e) => setScore(c.id, Number(e.target.value))}
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
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSaveScores}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Đang lưu...' : 'Lưu điểm và hoàn tất chấm'}
        </button>
        {attempt.status === 'graded' && isTtdtSyncConfigured() && (
          <button
            type="button"
            onClick={handleSyncTtdt}
            disabled={syncing}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ sang TTDT'}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('/admin/practical-grading')}
          className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Quay lại
        </button>
      </div>
    </div>
  );
}
