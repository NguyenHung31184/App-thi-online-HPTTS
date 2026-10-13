import { Link } from 'react-router-dom';
import { isExamPassed } from '../../../../shared/domain/exam-result';
import { useStudentResult } from '../../queries/use-student-result';
import { SIGNATURE_STATEMENT } from '../../domain/signature';
import { SignaturePad } from './SignaturePad';
import { ResultPrintSheet } from './ResultPrintSheet';
import { formatAttemptDuration } from '../../domain/attempt-review';

export default function ExamResultPage() {
  const {
    loading, error, attempt, exam, location, totalMax, studentSession, user, startPhotoUrl,
    autoSyncStatus, handlePrint, signatureUrl, saveSignature,
  } = useStudentResult();
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
  const passed = isExamPassed(attempt.score, attempt.disqualified, exam.pass_threshold ?? 0.7);

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

  const completedAtStr = typeof attempt.completed_at === 'number' && attempt.completed_at
    ? new Date(attempt.completed_at).toLocaleString('vi-VN')
    : '—';

  return (
    <div className="max-w-2xl mx-auto p-4 print:max-w-none print:p-0">
      <ResultPrintSheet
        examTitle={exam.title}
        isTrial={isTrial}
        fullName={displayFullName}
        dob={displayDob}
        cccd={displayCccd}
        completedAt={completedAtStr}
        duration={formatAttemptDuration(attempt.started_at, attempt.completed_at)}
        score={`${Number(earned.toFixed(2))} / ${denom ?? '—'}`}
        passMark={`${typeof passValue === 'number' ? Number(passValue.toFixed(2)) : '—'} / ${denom ?? '—'}`}
        passed={passed}
        disqualified={Boolean(attempt.disqualified)}
        startPhotoUrl={startPhotoUrl}
        signatureUrl={signatureUrl ?? null}
      />
      <div className="bg-white border border-slate-200 rounded-lg p-6 print:hidden">
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
              {Number(earned.toFixed(2))}/{denom ?? '—'}
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
          Ngưỡng đạt: {typeof passValue === 'number' ? Number(passValue.toFixed(2)) : '—'} / {denom ?? 'tổng điểm'}.
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

        {signatureUrl === undefined && <p className="mt-6 text-sm text-slate-500">Đang kiểm tra chữ ký…</p>}
        {signatureUrl === null && (
          <div className="print:hidden">
            <SignaturePad onSave={saveSignature} />
          </div>
        )}
        {signatureUrl && (
          <>
            <div className="mt-6 print:break-inside-avoid">
              <p className="text-xs text-slate-500 mb-1">Chữ ký học viên</p>
              <img
                src={signatureUrl}
                alt="Chữ ký xác nhận kết quả của học viên"
                className="w-56 rounded-lg border border-slate-200 bg-white"
              />
              <p className="mt-1 text-xs text-slate-500">{SIGNATURE_STATEMENT}</p>
            </div>
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
          </>
        )}
      </div>
    </div>
  );
}
