import { CheckCircle } from 'lucide-react';
import ConfirmationModal from '../../../../shared/ui/ConfirmationModal';
import { PortraitCameraGuide } from '../../../../shared/ui/PortraitCameraGuide';
import { formatRemaining, hasStudentAnswer } from '../../domain/session-paper';
import { useExamSession } from '../../queries/use-exam-session';
import { AiObjectProctorBurst } from '../proctoring/AiObjectProctorBurst';
import { ProctoringEvidenceCapture } from '../proctoring/ProctoringEvidenceCapture';
import { CameraRecoveryNotice } from '../proctoring/CameraRecoveryNotice';
import { ViolationAlertModal } from '../proctoring/ViolationAlertModal';
import { TheoryQuestionList } from './TheoryQuestionList';

export default function ExamTakePage() {
  const {
    error, attempt, exam, questions, answers, evidenceRef, proctoringCameraEnabled, attemptId,
    user, studentSession, aiEnabled, handleAiProctorViolation, violationAlert, violationCount,
    MAX_VIOLATIONS, aiProctoringState, setViolationAlert, violationsCapActive, photoVerified,
    autoSubmitReason, submitting, showWorkspaceStep, cameraError, cameraStream, videoRef,
    setStartPhotoVideoReady, handleCaptureWorkspace, capturingWorkspace, startPhotoVideoReady,
    showCameraStep, startPhotoCanCapture, startPhotoWarmupLeftSec, handleCaptureAndStart,
    capturing, fullscreenSupported, isFullscreen, fullscreenError, enterFullscreen,
    retryStartCamera, proctoringCameraStatus, setProctoringCameraStatus,
    autosaveStatus, remainingMs, setError, setShowSubmitConfirm, navigate, shuffledQuestions,
    setAnswers, showSubmitConfirm, handleSubmit,
  } = useExamSession();
  if (error && !attempt) return <p className="p-4 text-red-600">{error}</p>;
  if (!attempt || !exam) return <p className="p-4 text-slate-500">Đang tải...</p>;

  const answeredCount = questions.filter((question) => hasStudentAnswer(question.question_type, answers[question.id])).length;
  const totalQuestions = questions.length;

  return (
    <div className="exam-session max-w-3xl mx-auto p-2 sm:p-4">
      {/* Camera evidence: chạy nền để chụp ảnh khi vi phạm (blur/tab hidden/fullscreen exit/AI events). */}
      <ProctoringEvidenceCapture
        ref={evidenceRef}
        enabled={proctoringCameraEnabled}
        attemptId={attemptId ?? ''}
        examId={attempt?.exam_id ?? ''}
        studentKey={(user?.student_id ?? studentSession?.student_id ?? user?.id ?? attempt?.user_id ?? 'unknown') as string}
        onCameraStatus={setProctoringCameraStatus}
      />
      {/* MediaPipe nhận diện mặt; BlazeFace dự phòng. COCO nhận diện điện thoại/sách khi VITE_AI_PROCTORING_ENABLED=1. */}
      <AiObjectProctorBurst
        enabled={proctoringCameraEnabled}
        evidenceRef={evidenceRef}
        detectObjects={aiEnabled}
        detectIntervalMs={2_500}
        minScore={0.6}
        notify={false}
        onViolation={handleAiProctorViolation}
      />
      {/* Modal cảnh báo vi phạm */}
      <ViolationAlertModal
        kind={violationAlert}
        violationCount={violationCount}
        maxViolations={MAX_VIOLATIONS}
        aiRiskScore={aiProctoringState.risk_score}
        aiRiskThreshold={aiProctoringState.risk_threshold}
        proctoringMode={aiProctoringState.mode}
        onClose={() => setViolationAlert(null)}
      />

      {violationsCapActive && photoVerified && (
        <div
          className="viewport-modal fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/85 p-6 text-center"
          aria-live="assertive"
          role="alertdialog"
          aria-labelledby="violation-cap-title"
        >
          <div className="max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <p id="violation-cap-title" className="text-lg font-semibold text-slate-900 mb-2">
              {autoSubmitReason === 'ai'
                ? `Đã đạt ${aiProctoringState.risk_score}/${aiProctoringState.risk_threshold} điểm rủi ro AI`
                : `Đã đủ ${MAX_VIOLATIONS} lần rời trang thi`}
            </p>
            <p className="text-slate-600 text-sm mb-4">
              Bài thi đang được <strong>tự động nộp</strong>. Vui lòng chờ vài giây; nếu mạng chậm, hệ thống sẽ thử lại. Bạn không thể tiếp tục sửa bài trong lúc này.
            </p>
            {submitting && <p className="text-indigo-600 text-sm font-medium">Đang xử lý nộp bài...</p>}
            {error ? (
              <p className="text-red-700 text-sm mt-3 border-t border-slate-200 pt-3">{error}</p>
            ) : null}
          </div>
        </div>
      )}

      {/* Bước 0: Chụp ảnh bàn làm việc — xác nhận môi trường thi */}
      {showWorkspaceStep && (
        <div className="viewport-modal fixed inset-0 z-[60] bg-slate-900/90 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-5">
            <div className="font-semibold text-slate-900 text-lg mb-1">Chụp ảnh bàn làm việc</div>
            <p className="text-slate-600 text-sm mb-4">
              Xoay camera để <strong>cho thấy toàn bộ bàn làm việc</strong> xung quanh bạn — không có tài liệu, điện thoại hoặc thiết bị hỗ trợ khác. Ảnh này được lưu để xác nhận môi trường thi.
            </p>
            {cameraError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                {cameraError}
                <button type="button" onClick={retryStartCamera} disabled={capturingWorkspace} className="mt-2 block min-h-11 rounded-lg border border-red-700 px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50">
                  Thử lại camera
                </button>
              </div>
            )}
            {cameraStream ? (
              <>
                <div className="relative rounded-lg overflow-hidden bg-slate-800 mb-4 aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    onLoadedData={() => { const v = videoRef.current; if (v && v.videoWidth > 0) setStartPhotoVideoReady(true); }}
                    onPlaying={() => { const v = videoRef.current; if (v && v.videoWidth > 0) setStartPhotoVideoReady(true); }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCaptureWorkspace}
                  disabled={capturingWorkspace || !startPhotoVideoReady}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {capturingWorkspace ? 'Đang lưu...' : !startPhotoVideoReady ? 'Đang khởi động camera...' : 'Chụp ảnh bàn làm việc'}
                </button>
              </>
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm">
                {cameraError ? null : 'Đang kết nối camera...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bước 1: Chụp ảnh khuôn mặt — bắt buộc trước khi làm bài */}
      {showCameraStep && (
        <div className="viewport-modal fixed inset-0 z-[60] bg-slate-900/90 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-5">
            <div className="font-semibold text-slate-900 text-lg mb-1">Chụp ảnh khuôn mặt trước khi làm bài</div>
            <p className="text-slate-600 text-sm mb-4">
              Đưa <strong>một mình bạn</strong> vào <strong>khung oval</strong> trên hình (ảnh sẽ được <strong>cắt 3:4</strong> theo khuôn mặt để lưu và dùng cho phiếu kết quả). Hệ thống từ chối nếu không thấy mặt hoặc có nhiều người.{' '}
              <span className="text-slate-700">
                Đợi <strong>hình camera hiện rõ</strong>, sau đó giữ mặt trong oval thêm vài giây — nút chụp chỉ bật khi đã thấy hình và đủ thời gian căn khung.
              </span>
            </p>
            {cameraError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                {cameraError}
                <button type="button" onClick={retryStartCamera} disabled={capturing} className="mt-2 block min-h-11 rounded-lg border border-red-700 px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50">
                  Thử lại camera
                </button>
              </div>
            )}
            {cameraStream && (
              <>
                <div className="relative isolate rounded-lg overflow-hidden bg-slate-800 mb-4 aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="relative z-0 w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                    onLoadedData={() => {
                      const v = videoRef.current;
                      if (v && v.videoWidth > 0) setStartPhotoVideoReady(true);
                    }}
                    onPlaying={() => {
                      const v = videoRef.current;
                      if (v && v.videoWidth > 0) setStartPhotoVideoReady(true);
                    }}
                  />
                  <PortraitCameraGuide />
                </div>
                {!startPhotoVideoReady && (
                  <p className="mb-3 text-center text-sm text-slate-600">
                    Đang hiển thị hình camera… Giữ mặt trong khung oval khi hình đã lên.
                  </p>
                )}
                {startPhotoVideoReady && !startPhotoCanCapture && startPhotoWarmupLeftSec > 0 && (
                  <p className="mb-3 text-center text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3">
                    Giữ mặt trong khung oval — còn <span className="tabular-nums font-bold">{startPhotoWarmupLeftSec}</span> giây nữa mới có thể chụp.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleCaptureAndStart}
                  disabled={capturing || !startPhotoCanCapture}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {capturing
                    ? 'Đang chụp và tải lên...'
                    : !startPhotoVideoReady
                      ? 'Đang chờ hình camera...'
                      : !startPhotoCanCapture
                        ? 'Đang chờ ổn định camera...'
                        : 'Chụp ảnh và bắt đầu làm bài'}
                </button>
              </>
            )}
            {!cameraStream && !cameraError && (
              <p className="text-slate-500 text-sm">Đang bật camera...</p>
            )}
          </div>
        </div>
      )}

      {photoVerified && fullscreenSupported && !isFullscreen && (
        <div className="viewport-modal fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-5">
            <div className="font-semibold text-slate-900 text-lg mb-1">Bắt buộc chế độ toàn màn hình</div>
            <div className="text-slate-600 text-sm mb-4">
              Ứng dụng thi chỉ hoạt động khi bạn bật toàn màn hình. Nếu bạn bấm <strong>ESC</strong> hoặc thoát fullscreen, hệ thống sẽ ghi nhận vi phạm.
            </div>
            {fullscreenError && <div className="text-red-600 text-sm mb-3">{fullscreenError}</div>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={enterFullscreen}
                className="min-h-11 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              >
                Vào toàn màn hình
              </button>
            </div>
          </div>
        </div>
      )}

      {photoVerified && !fullscreenSupported && (
        <p className="mb-3 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700" role="status">
          Trình duyệt này không hỗ trợ toàn màn hình cho bài thi. Bạn vẫn có thể làm bài; việc rời trang thi vẫn được ghi nhận.
        </p>
      )}
      {photoVerified && proctoringCameraEnabled && (
        <CameraRecoveryNotice status={proctoringCameraStatus} restart={() => { void evidenceRef.current?.restartCamera(); }} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
        <span className="font-medium text-slate-800">{exam.title}</span>
        <div className="flex items-center gap-3">
          {autosaveStatus === 'saving' && (
            <span className="text-xs text-slate-500">Đang lưu...</span>
          )}
          {autosaveStatus === 'error' && (
            <span className="text-xs text-red-600 font-medium">⚠ Lưu thất bại — kiểm tra mạng</span>
          )}
          <span className={`font-mono text-lg ${remainingMs !== null && remainingMs < 60000 ? 'text-red-600' : 'text-slate-700'}`}>
            {remainingMs !== null ? formatRemaining(remainingMs) : '—'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-red-800 font-medium">Lỗi nộp bài</p>
          <p className="text-red-700 text-sm mt-1">{error}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => { setError(''); setShowSubmitConfirm(true); }}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Thử nộp lại
            </button>
            <button
              type="button"
              onClick={() => navigate(`/exam/${attemptId}/result`, { replace: true })}
              className="px-3 py-1.5 border border-slate-400 text-slate-700 rounded-lg text-sm hover:bg-slate-100"
            >
              Xem trang kết quả
            </button>
          </div>
        </div>
      )}

      <p className="text-slate-500 text-sm mb-4">
        Trình duyệt sẽ ghi nhận khi bạn chuyển tab, mất focus hoặc thoát toàn màn hình. Nếu vi phạm (ẩn tab / mất focus / thoát fullscreen) đủ{' '}<strong>{MAX_VIOLATIONS} lần</strong>, bài sẽ được <strong>tự động nộp</strong>; khi quay lại tab, trang sẽ chuyển sang kết quả nếu đã nộp.
      </p>

      <TheoryQuestionList questions={shuffledQuestions} attemptId={attemptId} answers={answers} setAnswers={setAnswers} />

      <div className="mt-8 flex justify-between items-center">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Quay lại (bài làm đã được lưu tạm)
        </button>
        <button
          type="button"
          onClick={() => setShowSubmitConfirm(true)}
          disabled={submitting}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Đang nộp...' : 'Nộp bài'}
        </button>
      </div>

      <ConfirmationModal
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={() => handleSubmit()}
        title="Xác nhận nộp bài"
        confirmText="Có, nộp bài"
        confirmColor="primary"
        isLoading={submitting}
        icon={CheckCircle}
      >
        Bạn đã làm được <strong>{answeredCount}</strong> / <strong>{totalQuestions}</strong> câu.
        Bạn có chắc chắn muốn nộp bài? Sau khi nộp bạn không thể sửa lại.
      </ConfirmationModal>
    </div>
  );
}
