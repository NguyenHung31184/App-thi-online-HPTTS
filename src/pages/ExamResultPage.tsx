import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAttempt } from '../services/attemptService';
import { getExam } from '../services/examService';
import { supabase } from '../lib/supabaseClient';
import type { Attempt, Exam } from '../types';

export default function ExamResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [totalMax, setTotalMax] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!attemptId) return;
        const ctxId = user?.id ?? '';
        if (ctxId) {
          // ok
        } else {
          const { data } = await supabase.auth.getUser();
          const uid = data.user?.id ?? '';
          if (!uid) {
            if (!cancelled) setError('Bạn chưa đăng nhập. Vui lòng đăng nhập lại để xem kết quả.');
            return;
          }
        }

        const a = await getAttempt(attemptId);
        if (!a) {
          if (!cancelled) setError('Không tìm thấy bài làm.');
          return;
        }
        const uid = ctxId || (await supabase.auth.getUser()).data.user?.id || '';
        if (uid && a.user_id !== uid) {
          if (!cancelled) setError('Bạn không có quyền xem kết quả này.');
          return;
        }
        if (!cancelled) {
          setAttempt(a);
          const e = await getExam(a.exam_id);
          setExam(e ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải kết quả.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [attemptId, user?.id]);

  useEffect(() => {
    if (!exam?.id) return;
    const run = async () => {
      try {
        const { data, error } = await supabase.from('questions').select('points').eq('exam_id', exam.id);
        if (error) throw error;
        const sum = (data ?? []).reduce((s, r) => s + (typeof r.points === 'number' ? r.points : Number(r.points) || 0), 0);
        setTotalMax(sum > 0 ? sum : null);
      } catch {
        setTotalMax(null);
      }
    };
    run();
  }, [exam?.id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <p className="p-4 text-slate-500">Đang tải...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;
  if (!attempt || !exam) return null;

  const earned = typeof attempt.raw_score === 'number'
    ? attempt.raw_score
    : (typeof attempt.score === 'number' && typeof totalMax === 'number' ? attempt.score * totalMax : 0);
  const denom = typeof totalMax === 'number' ? totalMax : (typeof exam.total_questions === 'number' && exam.total_questions > 0 ? exam.total_questions : null);
  const passValue = typeof denom === 'number' ? (exam.pass_threshold ?? 0.7) * denom : null;
  const passed = (exam.pass_threshold ?? 0.7) <= (attempt.score ?? 0);

  return (
    <div className="max-w-2xl mx-auto p-4 print:max-w-none">
      <div className="bg-white border border-slate-200 rounded-lg p-6 print:border-0 print:shadow-none">
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Kết quả bài thi</h1>
        <p className="text-slate-600 mb-4">{exam.title}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm text-slate-500">Điểm</p>
            <p className="text-2xl font-bold text-slate-800">
              {Math.round(earned * 10) / 10}/{denom ?? '—'}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm text-slate-500">Kết quả</p>
            <p className={`text-xl font-semibold ${passed ? 'text-green-600' : 'text-red-600'}`}>
              {passed ? 'Đạt' : 'Chưa đạt'}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Điểm chi tiết: {typeof attempt.raw_score === 'number' ? Math.round(attempt.raw_score * 10) / 10 : '—'} / {denom ?? 'tổng điểm'}.
          Ngưỡng đạt: {typeof passValue === 'number' ? Math.round(passValue * 10) / 10 : '—'} / {denom ?? 'tổng điểm'}.
        </p>

        {attempt.synced_to_ttdt_at && (
          <p className="text-sm text-green-600 mt-2">Đã đồng bộ điểm sang hệ thống TTDT.</p>
        )}
        {(location.state as {
          syncSkipped?: boolean;
          syncMissingModule?: boolean;
          syncMissingStudentId?: boolean;
          syncMissingClassId?: boolean;
        } | null)?.syncSkipped &&
          !attempt.synced_to_ttdt_at && (
            <div className="text-sm text-amber-800 mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <p className="font-medium">Điểm chưa đồng bộ sang TTDT.</p>
              <p className="mt-1 text-amber-700">Thiếu cấu hình hoặc thông tin sau:</p>
              <ul className="list-disc pl-5 mt-1 text-amber-700">
                {(location.state as any)?.syncMissingModule && <li>Đề thi chưa gắn mô-đun (module_id).</li>}
                {(location.state as any)?.syncMissingClassId && <li>Kỳ thi chưa gắn lớp (class_id).</li>}
                {(location.state as any)?.syncMissingStudentId && <li>Tài khoản thi chưa có student_id (chưa xác thực CCCD).</li>}
                {!((location.state as any)?.syncMissingModule || (location.state as any)?.syncMissingClassId || (location.state as any)?.syncMissingStudentId) && (
                  <li>Chưa đủ điều kiện đồng bộ (kiểm tra mô-đun, lớp, CCCD/student_id).</li>
                )}
              </ul>
            </div>
          )}

        <div className="mt-8 flex gap-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800"
          >
            In kết quả
          </button>
          <Link
            to="/dashboard"
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
