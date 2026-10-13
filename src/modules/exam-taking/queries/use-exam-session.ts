import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cameraHasUsableTrack, openCamera, stopCamera } from '../../../platform/media/camera';
import { activeFullscreenElement, listenForFullscreenChange, requestPageFullscreen, supportsFullscreen } from '../../../platform/browser/fullscreen';
import type { Attempt, Exam, QuestionForStudent } from '../../../types';
import { useAuth } from '../../identity-access/public';
import { isTtdtSyncConfigured, syncAttemptToTtdt } from '../../integrations/public';
import type { AiDetectionDetails, EvidenceKind, ProctoringEvidenceCaptureRef, ProctoringCameraStatus } from '../domain/proctoring-evidence';
import { hashStringToSeed, shuffleWithSeed } from '../domain/session-paper';
import { loadTheorySession } from '../application/load-session';
import {
  getAiProctoringState,
  getAttempt,
  getAttemptWindowContext,
  loadBlazeFaceModel,
  logAuditEvent,
  beginExamClock,
  objectDetectionEnabled,
  recordAiProctoringIncident,
  submitAttempt,
  updateAttemptAnswers,
  uploadExamFileViaEdge,
  validateAndBuildStartExamPortrait,
} from './session-actions';
import {
  DEFAULT_AI_RISK_THRESHOLD,
  MAX_MAIN_VIOLATIONS,
  attachBrowserViolationEvidence,
  canRecordLeaveViolation,
  getBrowserProctoringState,
  recordBrowserViolation,
  useAttemptHeartbeat,
  type AiProctoringState,
  type AiViolationKind,
  type BrowserProctoringState,
  type BrowserViolationKind
} from './session-api';


/** Sau khi preview video đã có pixel (videoWidth > 0), chờ thêm trước khi bật nút chụp — tránh đếm 5s trong lúc màn hình vẫn đen. */
const START_PHOTO_WARMUP_MS = 5_000;


/** Android Chrome thường fire visibility hidden / blur khi hộp thoại xác nhận fullscreen — bỏ qua vi phạm rời tab trong khoảng này. */
function getPostFullscreenLeaveIgnoreMs(): number {
  if (typeof navigator === 'undefined') return 2_800;
  return /Android/i.test(navigator.userAgent || '') ? 5_000 : 2_800;
}
export function useExamSession() {

  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const {
    user, studentSession,
  } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<QuestionForStudent[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  // Thời điểm kết thúc thực tế = min(started_at + duration, window.end_at) — tránh thi quá giờ cửa sổ
  const [effectiveEndTime, setEffectiveEndTime] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(activeFullscreenElement(document)));
  const [fullscreenSupported, setFullscreenSupported] = useState(() => supportsFullscreen(document));
  const [fullscreenError, setFullscreenError] = useState<string>('');
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveInFlightRef = useRef(false);
  const lastSavedRef = useRef<Record<string, string>>({});
  const timeUpSubmittedRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const nextSubmitRetryAtRef = useRef(0);
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;
  const proctoringDoneRef = useRef(false);
  const handleSubmitRef = useRef<null | ((opts?: { dueToViolations?: boolean }) => Promise<void>)>(null);
  const [violationCount, setViolationCount] = useState(0);
  const submittedDueToViolationRef = useRef(false);
  const violationSubmitPendingRef = useRef(false);
  /** Gộp blur, ẩn tab và thoát fullscreen phát sinh từ cùng một thao tác. */
  const leaveViolationBundleAtRef = useRef(0);
  const fullscreenRequestedRef = useRef(false);
  /** Bỏ qua visibility_hidden / focus_lost đến mốc thời gian này (ms epoch) — hệ thống fullscreen Android. */
  const leaveViolationIgnoreUntilRef = useRef(0);
  const attemptRef = useRef<Attempt | null>(null);
  attemptRef.current = attempt;
  const examRef = useRef<Exam | null>(null);
  examRef.current = exam;
  const MAX_VIOLATIONS = MAX_MAIN_VIOLATIONS;
  /** Ép re-render khi tăng đếm vi phạm (modal đếm lùi đọc đúng ref). */

  /** Đủ MAX_VIOLATIONS: khóa làm bài + ép hiển thị trạng thái tự nộp (đồng bộ UI với ref). */
  const [violationsCapActive, setViolationsCapActive] = useState(false);
  const [autoSubmitReason, setAutoSubmitReason] = useState<'browser' | 'ai' | null>(null);
  const [aiProctoringState, setAiProctoringState] = useState<AiProctoringState>({
    mode: 'standard',
    risk_threshold: DEFAULT_AI_RISK_THRESHOLD,
    risk_score: 0,
    incident_count: 0,
    should_auto_submit: false,
  });

  /** Bước 0: Chụp ảnh bàn làm việc — xác nhận môi trường thi trước khi chụp mặt. */
  const [workspacePhotoTaken, setWorkspacePhotoTaken] = useState(false);
  const [capturingWorkspace, setCapturingWorkspace] = useState(false);
  /** Bước 1: Chụp ảnh khuôn mặt bắt buộc trước khi làm bài. Chỉ sau khi chụp xong mới cho vào fullscreen + đề. */
  const [photoVerified, setPhotoVerified] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [cameraRetry, setCameraRetry] = useState(0);
  const [proctoringCameraStatus, setProctoringCameraStatus] = useState<ProctoringCameraStatus>('stopped');
  const retryStartCamera = useCallback(() => setCameraRetry((retry) => retry + 1), []);
  const [capturing, setCapturing] = useState(false);
  /** Video đã có khung hình thật (tránh đếm nóng khi stream có nhưng preview vẫn đen 10–15s trên một số máy Android). */
  const [startPhotoVideoReady, setStartPhotoVideoReady] = useState(false);
  /** Chỉ true sau START_PHOTO_WARMUP_MS kể từ khi preview đã sẵn sàng. */
  const [startPhotoCanCapture, setStartPhotoCanCapture] = useState(false);
  /** Số giây còn lại trong giai đoạn chờ (hiển thị đếm ngược). */
  const [startPhotoWarmupLeftSec, setStartPhotoWarmupLeftSec] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const evidenceRef = useRef<ProctoringEvidenceCaptureRef | null>(null);

  // ── Violation alert modal ─────────────────────────────────────────────────
  const [violationAlert, setViolationAlert] = useState<EvidenceKind | null>(null);
  // Khi tab bị ẩn (visibility_hidden / focus_lost), học viên không thấy modal ngay.
  // Lưu vào ref và hiển thị khi họ quay lại tab.
  const pendingViolationRef = useRef<EvidenceKind | null>(null);

  const showViolationAlert = useCallback((kind: EvidenceKind) => {
    if (document.visibilityState === 'hidden') {
      // Học viên đang rời tab → lưu lại, sẽ hiện khi họ quay lại
      pendingViolationRef.current = kind;
    } else {
      setViolationAlert(kind);
    }
  }, []);


  const aiEnabled = objectDetectionEnabled;

  /** Sau khi chụp mặt xong, trì hoãn bật camera giám sát để tránh chồng với lúc vừa stop luồng chụp mặt (Android). */
  const proctoringBaseEnabled = photoVerified && !submitting && !violationsCapActive && attempt?.status === 'in_progress' && Boolean(attemptId && exam);
  const [proctoringArmDelay, setProctoringArmDelay] = useState(false);
  useEffect(() => {
    if (!proctoringBaseEnabled) {
      setProctoringArmDelay(false);
      return;
    }
    const t = window.setTimeout(() => setProctoringArmDelay(true), 450);
    return () => window.clearTimeout(t);
  }, [proctoringBaseEnabled]);
  const proctoringCameraEnabled = proctoringBaseEnabled && proctoringArmDelay;

  const enterFullscreen = useCallback(async () => {
    setFullscreenError('');
    if (!fullscreenSupported || !supportsFullscreen(document)) {
      setFullscreenSupported(false);
      setIsFullscreen(false);
      return;
    }
    const ignoreMs = getPostFullscreenLeaveIgnoreMs();
    leaveViolationIgnoreUntilRef.current = Math.max(
      leaveViolationIgnoreUntilRef.current,
      Date.now() + ignoreMs,
    );
    try {
      await requestPageFullscreen(document);
      const active = Boolean(activeFullscreenElement(document));
      fullscreenRequestedRef.current = active;
      setIsFullscreen(active);
      leaveViolationIgnoreUntilRef.current = Math.max(
        leaveViolationIgnoreUntilRef.current,
        Date.now() + ignoreMs,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotSupportedError') {
        setFullscreenSupported(false);
        return;
      }
      // Thường xảy ra khi không có thao tác người dùng hoặc user từ chối
      setFullscreenError('Không thể bật toàn màn hình. Hãy bấm nút lần nữa hoặc kiểm tra quyền/trình duyệt.');
    }
  }, [fullscreenSupported]);

  const showWorkspaceStep = Boolean(attempt && exam && questions.length > 0 && !workspacePhotoTaken);
  /** Yêu cầu học viên chụp ảnh khuôn mặt trước khi làm bài. Bật camera khi vào bước này; chỉ cho vào đề sau khi chụp thành công. */
  const showCameraStep = Boolean(attempt && exam && questions.length > 0 && workspacePhotoTaken && !photoVerified);

  useEffect(() => {
    if ((!showCameraStep && !showWorkspaceStep) || !attemptId) return;
    setCameraError('');
    const controller = new AbortController();
    let stream: MediaStream | null = null;
    let detachTrackListeners: (() => void) | null = null;
    // Bước chụp bàn làm việc dùng camera sau (environment) để quét không gian xung quanh;
    // bước chụp khuôn mặt dùng camera trước (user) để xác thực danh tính.
    const facingMode: VideoFacingModeEnum = showWorkspaceStep ? 'environment' : 'user';
    openCamera({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
        },
      }, { signal: controller.signal })
      .then((s) => {
        if (controller.signal.aborted) { stopCamera(s); return; }
        stream = s;
        const track = s.getVideoTracks()[0];
        const interrupted = () => {
          setStartPhotoVideoReady(false);
          setCameraError('Camera bị gián đoạn. Bấm thử lại camera để tiếp tục.');
        };
        track?.addEventListener('mute', interrupted);
        track?.addEventListener('ended', interrupted);
        detachTrackListeners = () => {
          track?.removeEventListener('mute', interrupted);
          track?.removeEventListener('ended', interrupted);
        };
        setCameraStream(s);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Bạn cần cấp quyền camera để làm bài. Vui lòng bật quyền camera trong cài đặt trình duyệt rồi tải lại trang.'
            : err instanceof Error ? err.message : 'Không thể bật camera. Vui lòng kiểm tra thiết bị rồi thử lại.'
        );
      });
    return () => {
      controller.abort();
      detachTrackListeners?.();
      stopCamera(stream);
      setCameraStream(null);
    };
  }, [showCameraStep, showWorkspaceStep, attemptId, cameraRetry]);

  useEffect(() => {
    setStartPhotoVideoReady(false);
  }, [cameraStream]);

  useEffect(() => {
    if (!cameraStream || !showCameraStep || !startPhotoVideoReady) {
      setStartPhotoCanCapture(false);
      setStartPhotoWarmupLeftSec(0);
      return;
    }
    setStartPhotoCanCapture(false);
    const startAt = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startAt;
      const left = Math.max(0, Math.ceil((START_PHOTO_WARMUP_MS - elapsed) / 1000));
      setStartPhotoWarmupLeftSec(left);
    };
    tick();
    const iv = window.setInterval(tick, 250);
    const to = window.setTimeout(() => {
      window.clearInterval(iv);
      setStartPhotoWarmupLeftSec(0);
      setStartPhotoCanCapture(true);
    }, START_PHOTO_WARMUP_MS);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(to);
    };
  }, [cameraStream, showCameraStep, startPhotoVideoReady]);

  const handleCaptureAndStart = useCallback(async () => {
    if (!attemptId || !videoRef.current || !cameraStream || capturing || !startPhotoCanCapture) return;
    const video = videoRef.current;
    if (!cameraHasUsableTrack(cameraStream) || video.paused || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Camera chưa phát hình. Bấm thử lại camera để tiếp tục.');
      return;
    }
    setCapturing(true);
    setCameraError('');
    try {
      // Mục 1: crop chân dung 3:4 theo mặt. Mục 2a (lúc vào thi): chặn 0 mặt / nhiều mặt (BlazeFace).
      const portrait = await validateAndBuildStartExamPortrait(video, {
        // false: tọa độ mặt trùng pixel gốc của <video> (drawImage). true sẽ lệch ngang so với preview mirror.
        flipHorizontal: false,
        jpegQuality: 0.88,
        maxLongSide: 720,
      });
      if (!portrait.ok) {
        const msg =
          portrait.reason === 'no_face'
            ? 'Không phát hiện khuôn mặt. Hãy chỉnh ánh sáng, bỏ khẩu trang và đưa mặt vào khung oval.'
            : portrait.reason === 'multiple_faces'
              ? 'Phát hiện nhiều hơn một người trong khung hình. Chỉ một người được phép trước camera.'
              : portrait.reason === 'not_ready'
                ? 'Camera chưa sẵn sàng. Đợi 1–2 giây rồi thử lại.'
                : 'Không phân tích được hình ảnh (BlazeFace). Thử lại hoặc tải lại trang.';
        setCameraError(msg);
        return;
      }
      const blob = portrait.blob;
      const up = await uploadExamFileViaEdge({
        category: 'proctoring',
        attemptId,
        kind: 'start_photo',
        file: blob,
      });
      if (!up.ok) throw new Error(up.error || 'Upload ảnh giám sát thất bại.');
      await logAuditEvent(attemptId, 'photo_taken', { url: up.signedUrl, path: up.path });
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      proctoringDoneRef.current = true;
      setPhotoVerified(true);
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : 'Chụp ảnh thất bại. Vui lòng thử lại.');
    } finally {
      setCapturing(false);
    }
  }, [attemptId, cameraStream, capturing, startPhotoCanCapture]);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;
    const v = videoRef.current;
    v.srcObject = cameraStream;
    v.play().catch(() => setCameraError('Camera chưa phát hình. Bấm thử lại camera để tiếp tục.'));
    let raf = 0;
    let stopped = false;
    const poll = () => {
      if (stopped) return;
      if (v.readyState >= 2 && !v.paused && v.videoWidth > 0 && v.videoHeight > 0) {
        setStartPhotoVideoReady(true);
        return;
      }
      raf = requestAnimationFrame(poll);
    };
    poll();
    const timeout = window.setTimeout(() => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (v.readyState < 2 || v.paused) setCameraError('Camera chưa phát hình. Kiểm tra quyền camera rồi bấm thử lại.');
    }, 15_000);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
      v.srcObject = null;
    };
  }, [cameraStream]);

  /** Chụp ảnh bàn làm việc: không cần BlazeFace, chỉ capture frame hiện tại và upload. */
  const handleCaptureWorkspace = useCallback(async () => {
    if (!attemptId || !videoRef.current || !cameraStream || capturingWorkspace) return;
    const video = videoRef.current;
    if (!cameraHasUsableTrack(cameraStream) || video.paused || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Camera chưa phát hình. Bấm thử lại camera để tiếp tục.');
      return;
    }
    setCapturingWorkspace(true);
    setCameraError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Không tạo được canvas.');
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob thất bại.'))), 'image/jpeg', 0.82)
      );
      const up = await uploadExamFileViaEdge({ category: 'proctoring', attemptId, kind: 'start_photo', file: blob });
      if (!up.ok) throw new Error(up.error || 'Upload ảnh bàn làm việc thất bại.');
      await logAuditEvent(attemptId, 'workspace_photo', { url: up.signedUrl, path: up.path });
      setWorkspacePhotoTaken(true);
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : 'Chụp ảnh thất bại. Vui lòng thử lại.');
    } finally {
      setCapturingWorkspace(false);
    }
  }, [attemptId, cameraStream, capturingWorkspace]);

  /** Tải BlazeFace sớm khi hiện bước chụp mặt — lần bấm Chụp sẽ nhanh hơn. */
  useEffect(() => {
    if (!showCameraStep) return;
    loadBlazeFaceModel().catch(() => { });
  }, [showCameraStep]);

  const load = useCallback(async () => {
    if (!attemptId || !user?.id) return;
    try {
      const loaded = await loadTheorySession(attemptId, user.id);
      if (loaded.kind === 'completed') {
        navigate(`/exam/${attemptId}/result`, { replace: true });
        return;
      }
      setAttempt(loaded.attempt);
      setExam(loaded.exam);
      setAnswers(loaded.answers);
      lastSavedRef.current = loaded.answers;
      setQuestions(loaded.questions);
      setEffectiveEndTime(loaded.deadline);
      setRemainingMs(Math.max(0, loaded.deadline - Date.now()));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tìm thấy bài làm hoặc đề thi.');
    }
  }, [attemptId, user?.id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // Working time starts on the server once both photos are taken. Until it answers, the loaded deadline
  // (the latest one the server allows) stays on screen, so a failed call never shortens the exam locally.
  useEffect(() => {
    if (!photoVerified || !attemptId) return;
    let cancelled = false;
    let retry: number | undefined;
    const ask = (triesLeft: number) => {
      beginExamClock(attemptId)
        .then((deadline) => { if (!cancelled && Number.isFinite(deadline) && deadline > 0) setEffectiveEndTime(deadline); })
        .catch(() => { if (!cancelled && triesLeft > 0) retry = window.setTimeout(() => ask(triesLeft - 1), 3000); });
    };
    ask(5);
    return () => { cancelled = true; window.clearTimeout(retry); };
  }, [photoVerified, attemptId]);

  useEffect(() => {
    if (effectiveEndTime === null) return;
    const t = setInterval(() => {
      const r = Math.max(0, effectiveEndTime - Date.now());
      setRemainingMs(r);
      if (r <= 0 && !timeUpSubmittedRef.current && Date.now() >= nextSubmitRetryAtRef.current) {
        nextSubmitRetryAtRef.current = Date.now() + 5000;
        void handleSubmitRef.current?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [effectiveEndTime]);

  const handleSubmit = async (opts?: { dueToViolations?: boolean }) => {
    const att = attemptRef.current;
    const ex = examRef.current;
    if (!attemptId || !att || submitInFlightRef.current) return;
    if (att.status !== 'in_progress') {
      // Nếu trên server bài đã ở trạng thái completed (vd: auto-nộp do hết giờ / vi phạm)
      // thì chuyển thẳng sang trang kết quả để tránh việc nút "Nộp bài" không phản hồi.
      navigate(`/exam/${attemptId}/result`, { replace: true });
      return;
    }
    submitInFlightRef.current = true;
    setShowSubmitConfirm(false);
    setSubmitting(true);
    setError('');
    const toSave = answersRef.current;
    try {
      // Server locks the attempt, saves only before its deadline, then grades in one transaction.
      const result = await submitAttempt(attemptId, toSave, opts?.dueToViolations === true);
      if (!result.ok) {
        if (result.error === 'already_completed') {
          timeUpSubmittedRef.current = true;
          if (opts?.dueToViolations) {
            submittedDueToViolationRef.current = true;
          }
          const base = (import.meta.env.BASE_URL || '').replace(/\/$/, '');
          window.location.replace(`${base}/exam/${attemptId}/result`);
          return;
        }
        setError(result.error ?? 'Chấm bài thất bại.');
        setSubmitting(false);
        return;
      }
      timeUpSubmittedRef.current = true;
      if (opts?.dueToViolations) {
        submittedDueToViolationRef.current = true;
      }
      // Đã chấm xong — luôn chuyển sang trang kết quả (kể cả khi sync lỗi), dùng full page redirect để ổn định trên mobile
      let syncSkipped = false;
      let syncMissingModule = false;
      let syncMissingStudentId = false;
      let syncMissingClassId = false;
      let isTrial = false;
      try {
        const updated = await getAttempt(attemptId);
        if (updated && ex && isTtdtSyncConfigured()) {
          const windowContext = await getAttemptWindowContext(updated.id);
          if (windowContext?.is_trial) {
            isTrial = true;
            // kỳ thi thử — không đồng bộ, không báo lỗi
          } else {
            const hasModule = ex.module_id != null && String(ex.module_id).trim() !== '';
            const hasStudentId = Boolean((user?.student_id ?? studentSession?.student_id) && String(user?.student_id ?? studentSession?.student_id).trim() !== '');
            const hasClassId = Boolean(windowContext?.class_id && String(windowContext.class_id).trim() !== '');
            const hasEnrollmentInfo = (hasStudentId && hasClassId) || undefined;
            if (hasModule && hasEnrollmentInfo) {
              const sync = await syncAttemptToTtdt(updated, ex, {
                studentId: user?.student_id ?? studentSession?.student_id ?? undefined,
                classId: windowContext?.class_id ?? undefined,
                userEmail: user?.email ?? undefined,
                userName: (studentSession?.student_name ?? (user as { student_name?: string } | null)?.student_name ?? user?.name) ?? undefined,
              });
              syncSkipped = !sync.success;
            } else {
              syncSkipped = true;
              syncMissingModule = !hasModule;
              syncMissingStudentId = !hasStudentId;
              syncMissingClassId = !hasClassId;
            }
          }
        }
      } catch {
        syncSkipped = true;
      }
      const base = (import.meta.env.BASE_URL || '').replace(/\/$/, '');
      const resultPath = `${base}/exam/${attemptId}/result`;
      const url = new URL(resultPath, window.location.origin);
      if (isTrial) {
        url.searchParams.set('isTrial', '1');
      } else if (syncSkipped || syncMissingModule || syncMissingStudentId || syncMissingClassId) {
        url.searchParams.set('syncSkipped', '1');
        if (syncMissingModule) url.searchParams.set('syncMissingModule', '1');
        if (syncMissingStudentId) url.searchParams.set('syncMissingStudentId', '1');
        if (syncMissingClassId) url.searchParams.set('syncMissingClassId', '1');
      }
      if (opts?.dueToViolations) {
        submittedDueToViolationRef.current = true;
      }
      window.location.replace(url.pathname + url.search);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi nộp bài.');
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  handleSubmitRef.current = handleSubmit;

  /**
   * Tự nộp khi đủ vi phạm.
   * Trước đây đặt submittedDueToViolationRef trước khi gọi handleSubmit trong khi handleSubmit đọc `attempt` từ closure —
   * có thể return sớm → ref chặn mọi lần thử sau, bài không bao giờ tự nộp.
   */
  const scheduleViolationAutoSubmit = useCallback(() => {
    if (submittedDueToViolationRef.current || violationSubmitPendingRef.current) return;
    violationSubmitPendingRef.current = true;
    let tries = 0;
    const tick = (): void => {
      tries += 1;
      const a = attemptRef.current;
      const fn = handleSubmitRef.current;
      if (attemptId && a?.status === 'in_progress' && fn) {
        void (async () => {
          try {
            await fn({ dueToViolations: true });
          } finally {
            violationSubmitPendingRef.current = false;
          }
        })();
        return;
      }
      if (tries < 120) {
        window.setTimeout(tick, 200);
      } else {
        violationSubmitPendingRef.current = false;
      }
    };
    window.setTimeout(tick, 200);
  }, [attemptId]);

  const applyBrowserState = useCallback((state: BrowserProctoringState) => {
    setViolationCount(state.violation_count);
    if (state.should_auto_submit) {
      setAutoSubmitReason('browser');
      setViolationsCapActive(true);
      if (!state.attempt_completed) scheduleViolationAutoSubmit();
    }
    if (state.attempt_completed && attemptId) navigate(`/exam/${attemptId}/result`, { replace: true });
  }, [attemptId, navigate, scheduleViolationAutoSubmit]);

  const captureViolationEvidence = useCallback(async (kind: BrowserViolationKind) => {
    if (!attemptId) return;
    const state = await recordBrowserViolation(attemptId, kind);
    applyBrowserState(state);
    if (!state.audit_id) return;
    let metadata: Record<string, unknown> = { evidence_error: true };
    try {
      const res = await evidenceRef.current?.captureAndUpload(kind, { toastOnceKey: `evidence_${kind}` });
      if (res?.ok) metadata = { evidence_url: res.publicUrl, evidence_path: res.path };
    } catch { /* The server count is already stored even when the camera fails. */ }
    await attachBrowserViolationEvidence(state.audit_id, metadata);
  }, [attemptId, applyBrowserState]);

  const handleAiProctorViolation = useCallback(
    (
      kind: AiViolationKind,
      captureResult?: {
        ok: true;
        path?: string;
        publicUrl?: string;
        evidence?: { phase: string; path?: string; publicUrl?: string }[];
      } | { ok: false },
      detection?: AiDetectionDetails,
    ) => {
      if (captureResult === undefined) {
        showViolationAlert(kind);
        return;
      }
      if (!attemptId) return;
      void (async () => {
        try {
          const result = await recordAiProctoringIncident(attemptId, kind, {
            ...(captureResult.ok
              ? {
                evidence_url: captureResult.publicUrl,
                evidence_path: captureResult.path,
                evidence: captureResult.evidence ?? [],
              }
              : { evidence_error: true }),
            detection: detection ?? null,
          });
          setAiProctoringState(result);
          if (result.should_auto_submit) {
            setAutoSubmitReason('ai');
            setViolationsCapActive(true);
            scheduleViolationAutoSubmit();
          }
        } catch {
          await logAuditEvent(attemptId, kind, {
            evidence_error: !captureResult.ok,
            evidence_url: captureResult.ok ? captureResult.publicUrl : undefined,
            evidence_path: captureResult.ok ? captureResult.path : undefined,
            detection: detection ?? null,
            ai_policy_error: true,
          });
        }
      })();
    },
    [attemptId, scheduleViolationAutoSubmit, showViolationAlert],
  );

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    getAiProctoringState(attemptId)
      .then((state) => {
        if (cancelled) return;
        setAiProctoringState(state);
        if (state.should_auto_submit) {
          setAutoSubmitReason('ai');
          setViolationsCapActive(true);
          scheduleViolationAutoSubmit();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAiProctoringState({
            mode: 'standard',
            risk_threshold: DEFAULT_AI_RISK_THRESHOLD,
            risk_score: 0,
            incident_count: 0,
            should_auto_submit: false,
          });
        }
      });
    return () => { cancelled = true; };
  }, [attemptId, scheduleViolationAutoSubmit]);

  useEffect(() => {
    setViolationCount(0);
    submittedDueToViolationRef.current = false;
    violationSubmitPendingRef.current = false;
    leaveViolationBundleAtRef.current = 0;
    leaveViolationIgnoreUntilRef.current = 0;
    setViolationsCapActive(false);
    setAutoSubmitReason(null);
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const state = await getBrowserProctoringState(attemptId);
        if (!cancelled) applyBrowserState(state);
      } catch {
        if (!cancelled) setError('Không tải được trạng thái giám sát. Kiểm tra kết nối rồi tải lại trang.');
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [attemptId, applyBrowserState]);

  /** Đủ vi phạm: retry tự nộp định kỳ nếu lần đầu lỗi mạng / race. */
  useEffect(() => {
    if (!violationsCapActive || !photoVerified) return;
    const id = window.setInterval(() => {
      if (submittedDueToViolationRef.current) return;
      if (attemptRef.current?.status !== 'in_progress') return;
      scheduleViolationAutoSubmit();
    }, 2_500);
    return () => window.clearInterval(id);
  }, [violationsCapActive, photoVerified, scheduleViolationAutoSubmit]);

  const persistAnswers = useCallback(async () => {
    if (!attemptId || autosaveInFlightRef.current || submitInFlightRef.current || timeUpSubmittedRef.current) return;
    if (JSON.stringify(answersRef.current) === JSON.stringify(lastSavedRef.current)) return;

    autosaveInFlightRef.current = true;
    setAutosaveStatus('saving');
    try {
      do {
        const snapshot = { ...answersRef.current };
        if (JSON.stringify(snapshot) === JSON.stringify(lastSavedRef.current)) break;
        await updateAttemptAnswers(attemptId, snapshot);
        lastSavedRef.current = snapshot;
      } while (!submitInFlightRef.current && !timeUpSubmittedRef.current && JSON.stringify(answersRef.current) !== JSON.stringify(lastSavedRef.current));
      setAutosaveStatus('idle');
    } catch (err) {
      console.error('[Autosave] Lưu bài thất bại:', err);
      setAutosaveStatus('error');
    } finally {
      autosaveInFlightRef.current = false;
    }
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId) return;
    autosaveRef.current = setInterval(() => { void persistAnswers(); }, 10000);
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') void persistAnswers();
    };
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current);
      document.removeEventListener('visibilitychange', saveWhenHidden);
      void persistAnswers();
    };
  }, [attemptId, persistAnswers]);

  useAttemptHeartbeat(attemptId, attempt?.status === 'in_progress');

  useEffect(() => {
    if (
      !photoVerified ||
      !attemptId ||
      !attempt ||
      attempt.status !== 'in_progress' ||
      !exam ||
      questions.length === 0
    ) {
      return;
    }

    const tryConsumeLeaveBundle = (): boolean => {
      const t = Date.now();
      if (!canRecordLeaveViolation(leaveViolationBundleAtRef.current, t)) return false;
      leaveViolationBundleAtRef.current = t;
      return true;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && attemptId) {
        if (Date.now() < leaveViolationIgnoreUntilRef.current) return;
        if (!tryConsumeLeaveBundle()) return;
        captureViolationEvidence('visibility_hidden').catch(() => { });
        showViolationAlert('visibility_hidden');
      }
      if (document.visibilityState === 'visible' && attemptId) {
        if (pendingViolationRef.current) {
          setViolationAlert(pendingViolationRef.current);
          pendingViolationRef.current = null;
        }
        getAttempt(attemptId)
          .then((a) => {
            if (a?.status === 'completed') {
              navigate(`/exam/${attemptId}/result`, { replace: true });
            }
          })
          .catch(() => { });
      }
    };
    const onBlur = () => {
      if (!attemptId) return;
      if (Date.now() < leaveViolationIgnoreUntilRef.current) return;
      if (!tryConsumeLeaveBundle()) return;
      captureViolationEvidence('focus_lost').catch(() => { });
      showViolationAlert('focus_lost');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    attempt,
    attemptId,
    captureViolationEvidence,
    exam,
    navigate,
    photoVerified,
    questions.length,
    scheduleViolationAutoSubmit,
    showViolationAlert,
  ]);

  /** Chặn copy/paste trên màn làm bài và ghi audit */
  useEffect(() => {
    if (!attemptId) return;
    const prevent = (e: ClipboardEvent) => {
      e.preventDefault();
      logAuditEvent(attemptId, 'copy_paste_blocked').catch(() => { });
    };
    document.addEventListener('copy', prevent);
    document.addEventListener('paste', prevent);
    return () => {
      document.removeEventListener('copy', prevent);
      document.removeEventListener('paste', prevent);
    };
  }, [attemptId]);

  /** Bắt buộc toàn màn hình khi làm bài; ghi audit khi thoát fullscreen; đếm vi phạm và auto-nộp sau N lần */
  useEffect(() => {
    if (!photoVerified || !attemptId || !attempt || questions.length === 0) return;
    const onFullscreenChange = () => {
      const active = Boolean(activeFullscreenElement(document));
      setIsFullscreen(active);
      if (active) {
        fullscreenRequestedRef.current = true;
        leaveViolationIgnoreUntilRef.current = Math.max(
          leaveViolationIgnoreUntilRef.current,
          Date.now() + 2_000,
        );
        return;
      }
      if (fullscreenRequestedRef.current && attemptId) {
        fullscreenRequestedRef.current = false;
        const t = Date.now();
        if (!canRecordLeaveViolation(leaveViolationBundleAtRef.current, t)) return;
        leaveViolationBundleAtRef.current = t;
        captureViolationEvidence('fullscreen_exited').catch(() => { });
        showViolationAlert('fullscreen_exited');
      }
    };
    return listenForFullscreenChange(document, onFullscreenChange);
  }, [
    attempt,
    attemptId,
    captureViolationEvidence,
    photoVerified,
    questions.length,
    showViolationAlert,
  ]);

  // Phải đặt useMemo TRƯỚC early return để tuân thủ Rules of Hooks (không gọi hook sau return có điều kiện)
  const shuffledQuestions = useMemo(() => {
    const qSeed = hashStringToSeed(attemptId ?? 'seed');
    return shuffleWithSeed(questions, qSeed);
  }, [questions, attemptId]);


  return {
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
  };
}
