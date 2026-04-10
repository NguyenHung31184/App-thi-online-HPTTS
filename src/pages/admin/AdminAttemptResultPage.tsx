/**
 * Xem kết quả bài làm trong layout admin — không check ownership (admin xem được tất cả).
 * Hiển thị: thông tin học viên, điểm, kết quả + từng câu hỏi (đáp án đúng/sai).
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import type { Attempt, Exam } from '../../types';

interface QuestionReviewItem {
  id: string;
  stem: string;
  options: { id: string; text: string }[];
  answer_key: string;
  points: number;
  topic: string;
  image_url: string | null;
  chosen: string | null;
  correct: boolean;
}

function parseOptions(raw: unknown): { id: string; text: string }[] {
  if (Array.isArray(raw)) return raw as { id: string; text: string }[];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as { id: string; text: string }[];
    } catch {
      return [];
    }
  }
  return [];
}

function optionLabel(options: { id: string; text: string }[], key: string | null): string {
  if (!key) return '— (chưa chọn)';
  const found = options.find((o) => o.id === key);
  return found ? found.text : key;
}

function formatDuration(startedAt: number, completedAt: number | null | undefined): string {
  if (!completedAt || completedAt <= 0) return '—';
  const ms = completedAt - startedAt;
  if (ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m} phút ${s} giây`;
}

export default function AdminAttemptResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [reviewItems, setReviewItems] = useState<QuestionReviewItem[] | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    setError('');
    try {
      // 1. Lấy attempt (admin không cần check user_id)
      const { data: attemptData, error: aErr } = await supabase
        .from('attempts')
        .select('*')
        .eq('id', attemptId)
        .single();
      if (aErr || !attemptData) {
        setError('Không tìm thấy bài làm.');
        return;
      }
      const a = attemptData as Attempt;
      setAttempt(a);

      // 2. Lấy exam
      const { data: examData, error: eErr } = await supabase
        .from('exams')
        .select('*')
        .eq('id', a.exam_id)
        .single();
      if (!eErr && examData) setExam(examData as Exam);

      // 3. Lấy tên học viên từ profiles (nếu có user_id)
      if (a.user_id) {
        const { data: pData } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', a.user_id)
          .single();
        if (pData) {
          setProfileName((pData as { name?: string | null; email?: string | null }).name || (pData as { name?: string | null; email?: string | null }).email || null);
        }
      }

      // 4. Lấy câu hỏi với answer_key (admin có thể đọc thẳng bảng questions)
      const { data: qData } = await supabase
        .from('questions')
        .select('id, stem, options, answer_key, points, topic, image_url')
        .eq('exam_id', a.exam_id)
        .order('created_at', { ascending: true });

      if (qData && a.answers) {
        const items: QuestionReviewItem[] = (qData as {
          id: string;
          stem: string;
          options: unknown;
          answer_key: string;
          points: number;
          topic: string;
          image_url?: string | null;
        }[]).map((q) => {
          const opts = parseOptions(q.options);
          const chosen = (a.answers as Record<string, string>)[q.id] ?? null;
          const correct = chosen !== null && chosen === q.answer_key;
          return {
            id: q.id,
            stem: q.stem,
            options: opts,
            answer_key: q.answer_key,
            points: typeof q.points === 'number' ? q.points : Number(q.points) || 0,
            topic: q.topic ?? '',
            image_url: q.image_url ?? null,
            chosen,
            correct,
          };
        });
        setReviewItems(items);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-slate-500 text-sm p-4">Đang tải...</p>;
  if (error) return <p className="text-red-600 text-sm p-4">{error}</p>;
  if (!attempt || !exam) return null;

  const threshold = exam.pass_threshold ?? 0.7;
  const scoreNum = attempt.score ?? 0;
  const passed = !attempt.disqualified && scoreNum >= threshold;
  const denom =
    (typeof attempt.total_max === 'number' ? attempt.total_max : null) ??
    (typeof exam.total_questions === 'number' && exam.total_questions > 0
      ? exam.total_questions
      : null);
  const earned =
    typeof attempt.raw_score === 'number'
      ? attempt.raw_score
      : typeof scoreNum === 'number' && typeof denom === 'number'
        ? scoreNum * denom
        : 0;
  const passValue = typeof denom === 'number' ? threshold * denom : null;

  const studentDisplay =
    (attempt as Attempt & { student_name?: string | null }).student_name?.trim() ||
    profileName ||
    '—';
  const studentDob =
    (attempt as Attempt & { student_dob?: string | null }).student_dob ?? null;
  const completedAtMs =
    typeof attempt.completed_at === 'number' ? attempt.completed_at : null;
  const completedAtStr = completedAtMs
    ? new Date(completedAtMs).toLocaleString('vi-VN')
    : '—';
  const durationStr = formatDuration(attempt.started_at, attempt.completed_at);

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <p className="text-sm text-slate-500 mb-4 print:hidden">
        <Link to="/admin/dashboard" className="text-indigo-600 hover:underline">
          ← Về Dashboard
        </Link>
      </p>

      {/* Thẻ kết quả chính */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-5 print:border-0 print:shadow-none print:p-0">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Kết quả bài thi</h1>
        <p className="text-slate-500 text-sm mb-5">{exam.title}</p>

        {/* Thông tin học viên */}
        <div className="mb-5 rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm space-y-1">
          <p><span className="font-medium text-slate-600 w-32 inline-block">Học viên:</span> {studentDisplay}</p>
          {studentDob && (
            <p><span className="font-medium text-slate-600 w-32 inline-block">Ngày sinh:</span> {studentDob}</p>
          )}
          <p><span className="font-medium text-slate-600 w-32 inline-block">Nộp lúc:</span> {completedAtStr}</p>
          <p><span className="font-medium text-slate-600 w-32 inline-block">Thời gian làm:</span> {durationStr}</p>
          {attempt.disqualified && (
            <p className="text-amber-700 font-semibold mt-1">⚠ Bài bị loại (disqualified)</p>
          )}
        </div>

        {/* Điểm số */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Điểm</p>
            <p className="text-2xl font-bold text-slate-800">
              {Math.round(earned * 10) / 10}
              <span className="text-base font-normal text-slate-500"> / {denom ?? '—'}</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ngưỡng đạt: {passValue != null ? Math.round(passValue * 10) / 10 : '—'} / {denom ?? '—'}
            </p>
          </div>
          <div className={`rounded-lg p-4 border ${passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-slate-500 mb-1">Kết quả</p>
            <p className={`text-2xl font-bold ${passed ? 'text-emerald-700' : 'text-red-700'}`}>
              {attempt.disqualified ? 'Bị loại' : passed ? 'Đạt' : 'Chưa đạt'}
            </p>
            {attempt.synced_to_ttdt_at && (
              <p className="text-xs text-emerald-600 mt-1">✓ Đã đồng bộ TTDT</p>
            )}
          </div>
        </div>

        {/* Nút hành động */}
        <div className="flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm font-medium"
          >
            In kết quả
          </button>
          <Link
            to="/admin/dashboard"
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 inline-flex items-center"
          >
            Về Dashboard
          </Link>
          <Link
            to="/admin/report"
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 inline-flex items-center"
          >
            Về Báo cáo
          </Link>
        </div>
      </div>

      {/* Bảng câu hỏi & đáp án */}
      {reviewItems && reviewItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm print:border-0 print:shadow-none print:p-0">
          <h2 className="text-base font-semibold text-slate-800 mb-1">Chi tiết từng câu</h2>
          <p className="text-xs text-slate-500 mb-4">
            Đáp án học viên đã chọn so với đáp án đúng.
          </p>
          <ol className="space-y-4 list-decimal list-inside marker:font-semibold marker:text-slate-400">
            {reviewItems.map((it, idx) => (
              <li
                key={it.id}
                className={`rounded-xl border p-4 pl-5 shadow-sm print:break-inside-avoid ${
                  it.correct
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : it.chosen === null
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-red-200 bg-red-50/30'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-500">Câu {idx + 1}</span>
                  <span className="text-xs text-slate-500">{it.points} điểm</span>
                </div>
                <p className="text-slate-800 text-sm mb-3 whitespace-pre-wrap">{it.stem}</p>
                {it.image_url && (
                  <img
                    src={it.image_url}
                    alt={`Hình câu ${idx + 1}`}
                    className="max-h-48 rounded-md border border-slate-200 mb-3 object-contain"
                  />
                )}
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-slate-500 mb-0.5">Học viên đã chọn</p>
                    <p className={it.correct ? 'text-emerald-700 font-medium' : it.chosen ? 'text-red-700 font-medium' : 'text-slate-400 italic'}>
                      {optionLabel(it.options, it.chosen)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500 mb-0.5">Đáp án đúng</p>
                    <p className="text-emerald-700 font-medium">
                      {optionLabel(it.options, it.answer_key)}
                    </p>
                  </div>
                </div>
                <p className={`mt-2 text-xs font-semibold ${it.correct ? 'text-emerald-600' : 'text-red-600'}`}>
                  {it.correct ? '✓ Đúng' : it.chosen ? '✗ Sai' : '— Chưa trả lời'}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {reviewItems && reviewItems.length === 0 && (
        <p className="text-slate-500 text-sm mt-2">Không có dữ liệu câu hỏi để hiển thị.</p>
      )}
    </div>
  );
}
