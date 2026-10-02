import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { attemptScore, formatAttemptDuration } from '../../domain/attempt-review';
import { useAttemptResult } from '../../queries/use-exam-reporting';
import { QuestionReviewList } from './QuestionReviewList';
import { downloadResultPdf } from './result-pdf';

/** One attempt for staff (no ownership check): student, score, result and every answer against the key. */
export default function AttemptResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { data, isLoading, error } = useAttemptResult(attemptId);
  const [pdfLoading, setPdfLoading] = useState(false);

  if (isLoading) return <p className="text-slate-500 text-sm p-4">Đang tải...</p>;
  if (error) return <p className="text-red-600 text-sm p-4">{error instanceof Error ? error.message : 'Lỗi tải dữ liệu.'}</p>;
  if (!data?.exam) return null;

  const { attempt, exam, student, reviewItems, startPhotoUrl } = data;
  const { earned, denom, passValue, passed } = attemptScore(attempt, exam);
  const studentDisplay = student.name || data.profileName || data.profileEmail || '—';
  const completedAtStr = typeof attempt.completed_at === 'number' && attempt.completed_at
    ? new Date(attempt.completed_at).toLocaleString('vi-VN')
    : '—';
  const durationStr = formatAttemptDuration(attempt.started_at, attempt.completed_at);

  const printPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadResultPdf({
        examTitle: exam.title,
        studentDisplay,
        studentDob: student.dob,
        studentCccd: student.cccd,
        completedAtStr,
        durationStr,
        disqualified: Boolean(attempt.disqualified),
        earned,
        denom,
        passValue,
        passed,
        startPhotoUrl,
        reviewItems,
      });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-slate-500 mb-4 print:hidden">
        <Link to="/admin/dashboard" className="text-indigo-600 hover:underline">
          ← Về Dashboard
        </Link>
      </p>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-5 print:border-0 print:shadow-none print:p-0">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Kết quả bài thi</h1>
        <p className="text-slate-500 text-sm mb-5">{exam.title}</p>

        {/* Student and the photo taken at the start (audit photo_taken) */}
        <div className="mb-5 rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 space-y-1 min-w-0">
              <p><span className="font-medium text-slate-600 w-32 inline-block">Học viên:</span> {studentDisplay}</p>
              {student.dob && (
                <p><span className="font-medium text-slate-600 w-32 inline-block">Ngày sinh:</span> {student.dob}</p>
              )}
              {student.cccd && (
                <p><span className="font-medium text-slate-600 w-32 inline-block">CCCD:</span> <span className="tabular-nums">{student.cccd}</span></p>
              )}
              <p><span className="font-medium text-slate-600 w-32 inline-block">Nộp lúc:</span> {completedAtStr}</p>
              <p><span className="font-medium text-slate-600 w-32 inline-block">Thời gian làm:</span> {durationStr}</p>
              {attempt.disqualified && (
                <p className="text-amber-700 font-semibold mt-1">⚠ Bài bị loại (disqualified)</p>
              )}
            </div>
            {startPhotoUrl && (
              <div className="shrink-0 flex flex-col items-center sm:items-end print:break-inside-avoid">
                <p className="text-xs text-slate-500 mb-1 w-full text-center sm:text-right">Ảnh lúc vào thi</p>
                <img
                  src={startPhotoUrl}
                  alt="Ảnh khuôn mặt xác nhận lúc vào phòng thi"
                  className="w-28 h-36 sm:w-32 sm:h-40 object-cover rounded-lg border border-slate-200 bg-white print:w-28 print:h-36"
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Điểm</p>
            <p className="text-2xl font-bold text-slate-800">
              {Math.round(earned)}
              <span className="text-base font-normal text-slate-500"> / {denom != null ? Math.round(denom) : '—'}</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ngưỡng đạt: {passValue != null ? Math.round(passValue) : '—'} / {denom != null ? Math.round(denom) : '—'}
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

        <div className="flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            disabled={pdfLoading}
            onClick={() => void printPdf()}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pdfLoading ? 'Đang tạo PDF...' : 'In kết quả'}
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

      {reviewItems && reviewItems.length > 0 && <QuestionReviewList items={reviewItems} />}

      {reviewItems && reviewItems.length === 0 && (
        <p className="text-slate-500 text-sm mt-2">Không có dữ liệu câu hỏi để hiển thị.</p>
      )}
    </div>
  );
}
