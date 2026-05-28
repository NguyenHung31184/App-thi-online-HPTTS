import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAttempt, fetchStartExamPhotoSignedUrl } from '../services/attemptService';
import { getExam } from '../services/examService';
import { getExamWindow } from '../services/examWindowService';
import { syncAttemptToTtdt, isTtdtSyncConfigured } from '../services/ttdtSyncService';
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
  const [autoSyncStatus, setAutoSyncStatus] = useState<'idle' | 'retrying' | 'success' | 'failed'>('idle');

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

  // Tự động retry sync nếu lần đầu thất bại (vd: mạng ngắt lúc nộp bài)
  useEffect(() => {
    const search = new URLSearchParams(location.search ?? '');
    const locState = location.state as { syncSkipped?: boolean; isTrial?: boolean } | null;
    if (!(locState?.syncSkipped ?? search.has('syncSkipped'))) return;
    if (locState?.isTrial ?? search.has('isTrial')) return;
    if (!attempt || !exam) return;
    if (attempt.synced_to_ttdt_at) return;
    if (!isTtdtSyncConfigured()) return;

    let cancelled = false;
    (async () => {
      setAutoSyncStatus('retrying');
      try {
        const win = await getExamWindow(attempt.window_id);
        if (cancelled) return;
        if (!win || win.is_trial) { setAutoSyncStatus('idle'); return; }
        const hasModule = Boolean(exam.module_id && String(exam.module_id).trim());
        const studentId = (user as { student_id?: string } | null)?.student_id
          ?? studentSession?.student_id
          ?? null;
        const hasStudentId = Boolean(studentId && String(studentId).trim());
        const hasClassId = Boolean(win.class_id && String(win.class_id).trim());
        if (!hasModule || !hasStudentId || !hasClassId) { setAutoSyncStatus('idle'); return; }
        const result = await syncAttemptToTtdt(attempt, exam, {
          studentId,
          classId: win.class_id ?? null,
          userEmail: user?.email ?? undefined,
          userName: (studentSession?.student_name
            ?? (user as { student_name?: string } | null)?.student_name
            ?? user?.name) ?? undefined,
        });
        if (!cancelled) setAutoSyncStatus(result.success ? 'success' : 'failed');
      } catch {
        if (!cancelled) setAutoSyncStatus('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [attempt?.id, exam?.id]);

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
    isTrial?: boolean;
  } | null;
  const search = new URLSearchParams(location.search ?? '');
  const isTrial = state?.isTrial ?? search.has('isTrial');
  const syncSkipped = state?.syncSkipped ?? search.has('syncSkipped');
  const syncMissingModule = state?.syncMissingModule ?? search.has('syncMissingModule');
  const syncMissingStudentId = state?.syncMissingStudentId ?? search.has('syncMissingStudentId');
  const syncMissingClassId = state?.syncMissingClassId ?? search.has('syncMissingClassId');

  // Khi bị disqualify, total_max = NULL trong DB → fallback về 100 (không dùng exam.total_questions vì đó là đếm câu, không phải tổng điểm)
  const denom = attempt?.disqualified
    ? (typeof attempt.total_max === 'number' ? attempt.total_max : 100)
    : (attempt && typeof attempt.total_max === 'number' ? attempt.total_max : null) ?? totalMax ?? (typeof exam.total_questions === 'number' && exam.total_questions > 0 ? exam.total_questions : null);
  const earned = typeof attempt.raw_score === 'number'
    ? attempt.raw_score
    : (typeof attempt.score === 'number' && typeof denom === 'number' ? attempt.score * denom : 0);
  const passValue = typeof denom === 'number' ? (exam.pass_threshold ?? 0.7) * denom : null;
  // So sánh điểm sau khi làm tròn (nhất quán với hiển thị) để tránh tình huống
  // hiển thị "70/100" nhưng kết quả vẫn "Chưa đạt" do điểm lẻ (true_false_multi/matching).
  const passed = attempt.disqualified
    ? false
    : passValue !== null
      ? Math.round(earned) >= Math.round(passValue)
      : (exam.pass_threshold ?? 0.7) <= (attempt.score ?? 0);

  const displayFullName =
    [studentSession?.student_name, user?.student_name, user?.name].find(
      (s) => typeof s === 'string' && s.trim() !== '',
    )?.trim() ?? '—';
  const rawDob = studentSession?.student_dob?.trim() || '';
  const displayDob = (() => {
    if (!rawDob) return '—';
    const m = rawDob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : rawDob;
  })();
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
              {Math.round(earned)}/{denom ?? '—'}
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
          Điểm chi tiết: {typeof attempt.raw_score === 'number' ? Math.round(attempt.raw_score) : '—'} / {denom ?? 'tổng điểm'}.
          Ngưỡng đạt: {typeof passValue === 'number' ? Math.round(passValue) : '—'} / {denom ?? 'tổng điểm'}.
        </p>

        {/* Trạng thái đồng bộ điểm */}
        {isTrial && (
          <div className="flex items-start gap-2.5 mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
            <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-700">
              Đây là <strong>kỳ thi thử</strong> — điểm không được lưu vào hệ thống quản lý TTDT.
            </p>
          </div>
        )}
        {!isTrial && (attempt.synced_to_ttdt_at || autoSyncStatus === 'success') && (
          <div className="flex items-start gap-2.5 mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
            <svg className="w-4 h-4 text-green-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-700">Điểm đã được ghi vào hệ thống quản lý TTDT.</p>
              {attempt.synced_to_ttdt_at && (
                <p className="text-xs text-green-600 mt-0.5">
                  {new Date(attempt.synced_to_ttdt_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        )}
        {!isTrial && autoSyncStatus === 'retrying' && (
          <div className="flex items-center gap-2.5 mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
            <svg className="w-4 h-4 text-blue-500 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-blue-700">Đang đồng bộ điểm sang hệ thống TTDT...</p>
          </div>
        )}
        {!isTrial && syncSkipped && !attempt.synced_to_ttdt_at
          && autoSyncStatus !== 'success' && autoSyncStatus !== 'retrying' && (
            <div className="flex items-start gap-2.5 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">Điểm chưa đồng bộ sang TTDT.</p>
                {autoSyncStatus === 'failed' ? (
                  <p className="text-sm text-amber-700 mt-0.5">
                    Tự động đồng bộ thất bại. Admin vào trang <strong>Đồng bộ điểm</strong> để retry thủ công.
                  </p>
                ) : (
                  <ul className="list-disc pl-4 mt-1 text-sm text-amber-700 space-y-0.5">
                    {syncMissingModule && <li>Đề thi chưa gắn mô-đun (module_id).</li>}
                    {syncMissingClassId && <li>Kỳ thi chưa gắn lớp (class_id).</li>}
                    {syncMissingStudentId && <li>Tài khoản thi chưa có student_id (chưa xác thực CCCD).</li>}
                    {!syncMissingModule && !syncMissingClassId && !syncMissingStudentId && (
                      <li>Chưa đủ điều kiện đồng bộ — kiểm tra mô-đun, lớp, CCCD/student_id.</li>
                    )}
                  </ul>
                )}
              </div>
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
