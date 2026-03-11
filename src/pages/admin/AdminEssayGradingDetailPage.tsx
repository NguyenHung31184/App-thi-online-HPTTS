import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAttempt } from '../../services/attemptService';
import { getExam } from '../../services/examService';
import { listQuestionsByExam } from '../../services/questionService';
import {
  getAttemptQuestionScores,
  upsertAttemptQuestionScore,
  recomputeAttemptScore,
} from '../../services/essayGradingService';
import type { Attempt, Exam, Question } from '../../types';

export default function AdminEssayGradingDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [scores, setScores] = useState<Record<string, { score: number; max_points: number }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const essayQuestions = questions.filter(
    (q) => q.question_type === 'video_paragraph' || q.question_type === 'main_idea'
  );

  useEffect(() => {
    if (!attemptId) return;
    getAttempt(attemptId).then((a) => {
      if (!a) {
        setError('Không tìm thấy bài làm.');
        return;
      }
      if (a.status !== 'completed') {
        setError('Bài làm chưa nộp, không thể chấm tự luận.');
        return;
      }
      setAttempt(a);
      getExam(a.exam_id).then(setExam);
      listQuestionsByExam(a.exam_id).then((q) => setQuestions(q as Question[]));
      getAttemptQuestionScores(attemptId).then((list) => {
        const map: Record<string, { score: number; max_points: number }> = {};
        list.forEach((s) => {
          map[s.question_id] = { score: s.score, max_points: s.max_points };
        });
        setScores(map);
      });
    }).catch(() => setError('Lỗi tải dữ liệu.'));
  }, [attemptId]);

  const setScore = (questionId: string, score: number, maxPoints: number) => {
    setScores((prev) => ({
      ...prev,
      [questionId]: { score, max_points: maxPoints },
    }));
  };

  const handleSaveAll = async () => {
    if (!attemptId || !attempt) return;
    setError('');
    setSaving(true);
    try {
      for (const q of essayQuestions) {
        const s = scores[q.id];
        const score = s?.score ?? 0;
        const maxPoints = s?.max_points ?? q.points ?? 0;
        await upsertAttemptQuestionScore(attemptId, q.id, score, maxPoints);
      }
      const result = await recomputeAttemptScore(attemptId);
      if (!result.ok) {
        setError(result.error ?? 'Cập nhật điểm thất bại.');
        return;
      }
      setAttempt((prev) =>
        prev
          ? {
              ...prev,
              raw_score: result.raw_score ?? prev.raw_score,
              score: result.score ?? prev.score,
            }
          : null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi lưu điểm.');
    } finally {
      setSaving(false);
    }
  };

  if (error && !attempt) return <p className="text-red-600">{error}</p>;
  if (!attempt || !exam) return <p className="text-slate-500">Đang tải...</p>;
  if (essayQuestions.length === 0) {
    return (
      <div>
        <p className="text-slate-600">Đề này không có câu hỏi tự luận.</p>
        <button
          type="button"
          onClick={() => navigate('/admin/essay-grading')}
          className="mt-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Quay lại
        </button>
      </div>
    );
  }

  const answers = (attempt.answers as Record<string, string>) ?? {};

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Chấm bài tự luận</h1>
        <button
          type="button"
          onClick={() => navigate('/admin/essay-grading')}
          className="text-slate-600 hover:text-slate-900 text-sm"
        >
          ← Danh sách
        </button>
      </div>
      <p className="text-slate-600 text-sm mb-2">
        Đề: {exam.title} — Bài làm: {attemptId?.slice(0, 8)}...
      </p>
      <p className="text-slate-500 text-sm mb-4">
        Điểm hiện tại: raw = {attempt.raw_score ?? '—'}, score = {attempt.score != null ? (Number(attempt.score) * 100).toFixed(1) : '—'}%
      </p>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="space-y-6">
        {essayQuestions.map((q, idx) => {
          const s = scores[q.id];
          const score = s?.score ?? 0;
          const maxPoints = s?.max_points ?? q.points ?? 1;
          const studentAnswer = answers[q.id] ?? '';
          return (
            <div key={q.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="font-medium text-slate-800 mb-1">
                Câu tự luận {idx + 1}. {q.stem}
              </p>
              <p className="text-slate-500 text-xs mb-1">
                Loại: {q.question_type} — Điểm tối đa: {q.points}
              </p>
              {q.media_url && (
                <div className="mb-2">
                  <video src={q.media_url} controls className="max-w-full rounded max-h-48" />
                </div>
              )}
              {q.rubric != null && (
                <div className="mb-2 p-2 bg-amber-50 rounded text-sm text-slate-700">
                  <span className="font-medium">Rubric / gợi ý chấm:</span>{' '}
                  {typeof q.rubric === 'string' ? q.rubric : JSON.stringify(q.rubric as object)}
                </div>
              )}
              <div className="mb-2">
                <span className="text-sm font-medium text-slate-700">Bài làm thí sinh:</span>
                <div className="mt-1 p-2 border border-slate-200 rounded bg-slate-50 text-slate-800 whitespace-pre-wrap min-h-[80px]">
                  {studentAnswer || '(Không có nội dung)'}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <span className="text-sm text-slate-700">Điểm:</span>
                  <input
                    type="number"
                    min={0}
                    max={maxPoints}
                    step={0.25}
                    value={score}
                    onChange={(e) => setScore(q.id, Number(e.target.value), maxPoints)}
                    className="w-20 border border-slate-300 rounded px-2 py-1"
                  />
                </label>
                <span className="text-slate-500 text-sm">/ {maxPoints}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Đang lưu...' : 'Lưu điểm và cập nhật tổng'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin/essay-grading')}
          className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Quay lại
        </button>
      </div>
    </div>
  );
}
