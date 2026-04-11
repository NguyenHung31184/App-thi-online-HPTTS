import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAttempt, fetchStartExamPhotoSignedUrl } from '../services/attemptService';
import { getExam } from '../services/examService';
import { supabase } from '../lib/supabaseClient';
import type { Attempt, Exam } from '../types';

export default function ExamResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const location = useLocation();
  const { user, studentSession } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [totalMax, setTotalMax] = useState<number | null>(null);
  const [startPhotoUrl, setStartPhotoUrl] = useState<string | null>(null);
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

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    (async () => {
      const u = await fetchStartExamPhotoSignedUrl(attemptId);
      if (!cancelled) setStartPhotoUrl(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <p className="p-4 text-slate-500">Đang tải...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;
  if (!attempt || !exam) return null;

  const state = location.state as {
    syncSkipped?: boolean;
    syncMissingModule?: boolean;
    syncMissingStudentId?: boolean;
    syncMissingClassId?: boolean;
  } | null;
  const search = new URLSearchParams(location.search ?? '');
  const syncSkipped = state?.syncSkipped ?? search.has('syncSkipped');
  const syncMissingModule = state?.syncMissingModule ?? search.has('syncMissingModule');
  const syncMissingStudentId = state?.syncMissingStudentId ?? search.has('syncMissingStudentId');
  const syncMissingClassId = state?.syncMissingClassId ?? search.has('syncMissingClassId');

  const denom = (attempt && typeof attempt.total_max === 'number' ? attempt.total_max : null) ?? totalMax ?? (typeof exam.total_questions === 'number' && exam.total_questions > 0 ? exam.total_questions : null);
  const earned = typeof attempt.raw_score === 'number'
    ? attempt.raw_score
    : (typeof attempt.score === 'number' && typeof denom === 'number' ? attempt.score * denom : 0);
  const passValue = typeof denom === 'number' ? (exam.pass_threshold ?? 0.7) * denom : null;
  const passed = (exam.pass_threshold ?? 0.7) <= (attempt.score ?? 0);

  const displayFullName =
    [studentSession?.student_name, user?.student_name, user?.name].find(
      (s) => typeof s === 'string' && s.trim() !== '',
    )?.trim() ?? '—';
  const displayDob = studentSession?.student_dob?.trim() || '—';
  const displayCccd = studentSession?.id_card_number?.trim() || '—';

  return (
    <div className="max-w-2xl mx-auto p-4 print:max-w-none">
      <div className="bg-white border border-slate-200 rounded-lg p-6 print:border-0 print:shadow-none">
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Kết quả bài thi</h1>
        <p className="text-slate-600 mb-4">{exam.title}</p>

        {(startPhotoUrl ||
          displayFullName !== '—' ||
          displayDob !== '—' ||
          displayCccd !== '—') && (
          <div className="mb-5 flex flex-col items-center sm:items-start print:break-inside-avoid">
            {startPhotoUrl ? (
              <>
                <p className="text-xs text-slate-500 mb-1">Ảnh lúc vào thi</p>
                <img
                  src={startPhotoUrl}
                  alt="Ảnh khuôn mặt xác nhận lúc vào phòng thi"
                  className="w-28 aspect-[3/4] sm:w-32 object-contain rounded-lg border border-slate-200 bg-slate-50 print:w-28"
                />
              </>
            ) : null}
            <dl
              className={`w-full max-w-sm text-sm text-slate-700 space-y-1 ${startPhotoUrl ? 'mt-3' : ''}`}
            >
              <div className="flex gap-2">
                <dt className="shrink-0 text-slate-500 min-w-[8.5rem]">Họ và tên</dt>
                <dd className="font-medium">{displayFullName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 text-slate-500 min-w-[8.5rem]">Ngày tháng năm sinh</dt>
                <dd className="font-medium">{displayDob}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 text-slate-500 min-w-[8.5rem]">Số CCCD</dt>
                <dd className="font-medium tabular-nums">{displayCccd}</dd>
              </div>
            </dl>
          </div>
        )}

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
        {syncSkipped &&
          !attempt.synced_to_ttdt_at && (
            <div className="text-sm text-amber-800 mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <p className="font-medium">Điểm chưa đồng bộ sang TTDT.</p>
              <p className="mt-1 text-amber-700">Thiếu cấu hình hoặc thông tin sau:</p>
              <ul className="list-disc pl-5 mt-1 text-amber-700">
                {syncMissingModule && <li>Đề thi chưa gắn mô-đun (module_id).</li>}
                {syncMissingClassId && <li>Kỳ thi chưa gắn lớp (class_id).</li>}
                {syncMissingStudentId && <li>Tài khoản thi chưa có student_id (chưa xác thực CCCD).</li>}
                {!syncMissingModule && !syncMissingClassId && !syncMissingStudentId && (
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
