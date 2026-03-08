import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listExams } from '../../services/examService';
import { listCompletedAttemptsByExam } from '../../services/attemptService';
import { listQuestionsByExam } from '../../services/questionService';
import type { Exam, Attempt, Question } from '../../types';

export default function AdminEssayGradingPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [essayCount, setEssayCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listExams().then(setExams).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedExamId) {
      setAttempts([]);
      setEssayCount(0);
      return;
    }
    setLoading(true);
    Promise.all([
      listCompletedAttemptsByExam(selectedExamId),
      listQuestionsByExam(selectedExamId),
    ])
      .then(([att, questions]) => {
        const essayQuestions = (questions as Question[]).filter(
          (q) => q.question_type === 'video_paragraph' || q.question_type === 'main_idea'
        );
        setEssayCount(essayQuestions.length);
        setAttempts(att);
      })
      .catch(() => {
        setAttempts([]);
        setEssayCount(0);
      })
      .finally(() => setLoading(false));
  }, [selectedExamId]);

  const exam = exams.find((e) => e.id === selectedExamId);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-4">Chấm bài tự luận</h1>
      <p className="text-slate-600 text-sm mb-4">
        Chọn đề thi, sau đó chọn bài làm để chấm điểm các câu video_paragraph / main_idea.
      </p>
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Đề thi</label>
        <select
          value={selectedExamId}
          onChange={(e) => setSelectedExamId(e.target.value)}
          className="w-full max-w-md border border-slate-300 rounded-lg px-3 py-2"
        >
          <option value="">-- Chọn đề thi --</option>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>
      {loading && <p className="text-slate-500 text-sm">Đang tải...</p>}
      {selectedExamId && !loading && (
        <>
          {essayCount === 0 ? (
            <p className="text-amber-600 text-sm">Đề này không có câu hỏi tự luận (video_paragraph / main_idea).</p>
          ) : (
            <p className="text-slate-600 text-sm mb-2">
              Đề có {essayCount} câu tự luận. Số bài đã nộp: {attempts.length}.
            </p>
          )}
          <ul className="space-y-2">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-700">
                  Bài làm <code className="text-xs bg-slate-100 px-1 rounded">{a.id.slice(0, 8)}...</code>
                  {' — '}
                  user {a.user_id.slice(0, 8)}...
                  {a.completed_at != null && (
                    <span className="text-slate-500 text-sm ml-1">
                      ({new Date(a.completed_at).toLocaleString('vi-VN')})
                    </span>
                  )}
                </span>
                <Link
                  to={`/admin/essay-grading/${a.id}`}
                  className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                >
                  Chấm bài
                </Link>
              </li>
            ))}
          </ul>
          {attempts.length === 0 && essayCount > 0 && (
            <p className="text-slate-500 text-sm mt-2">Chưa có bài làm nào đã nộp cho đề này.</p>
          )}
        </>
      )}
    </div>
  );
}
