import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAttempt, updateAttemptAnswers, getQuestionsForAttempt, submitAttempt, logAuditEvent } from '../services/attemptService';
import { getExam } from '../services/examService';
import { getExamWindow } from '../services/examWindowService';
import { syncAttemptToTtdt, isTtdtSyncConfigured } from '../services/ttdtSyncService';
import { supabase } from '../lib/supabaseClient';
import { SortableOptionList } from '../components/SortableOptionList';
import { LabelOnImageDrop } from '../components/LabelOnImageDrop';
import ConfirmationModal from '../components/ConfirmationModal';
import { CheckCircle } from 'lucide-react';
import type { Attempt, Exam, QuestionForStudent } from '../types';

function hashStringToSeed(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ExamTakePage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user, studentSession } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<QuestionForStudent[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);
  const [fullscreenSupported] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    const hasStandard = typeof el.requestFullscreen === 'function';
    const hasWebkit = typeof el.webkitRequestFullscreen === 'function';
    // iOS Safari thường chỉ có webkit* và vẫn không hoạt động ổn định cho exam; tắt bắt buộc fullscreen trên iOS.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    if (isIOS) return false;
    return hasStandard || hasWebkit;
  });
  const [fullscreenError, setFullscreenError] = useState<string>('');
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedRef = useRef<Record<string, string>>({});
  const timeUpSubmittedRef = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;
  const proctoringDoneRef = useRef(false);
  const handleSubmitRef = useRef<null | (() => void)>(null);
  const violationCountRef = useRef(0);
  const submittedDueToViolationRef = useRef(false);
  const fullscreenRequestedRef = useRef(false);
  const MAX_VIOLATIONS = 3;

  /** Bước 1: Chụp ảnh khuôn mặt bắt buộc trước khi làm bài. Chỉ sau khi chụp xong mới cho vào fullscreen + đề. */
  const [photoVerified, setPhotoVerified] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const enterFullscreen = useCallback(async () => {
    setFullscreenError('');
    const el = document.documentElement;
    if (!fullscreenSupported || !el.requestFullscreen) {
      setFullscreenError('Trình duyệt không hỗ trợ toàn màn hình. Bạn vẫn có thể tiếp tục làm bài bình thường.');
      // Nếu không hỗ trợ, không bắt buộc fullscreen nữa.
      setIsFullscreen(true);
      return;
    }
    try {
      await el.requestFullscreen();
      fullscreenRequestedRef.current = true;
      setIsFullscreen(true);
    } catch {
      // Thường xảy ra khi không có thao tác người dùng hoặc user từ chối
      setFullscreenError('Không thể bật toàn màn hình. Hãy bấm nút lần nữa hoặc kiểm tra quyền/trình duyệt.');
    }
  }, [fullscreenSupported]);

  /** Yêu cầu học viên chụp ảnh khuôn mặt trước khi làm bài. Bật camera khi vào bước này; chỉ cho vào đề sau khi chụp thành công. */
  const showCameraStep = Boolean(attempt && exam && questions.length > 0 && !photoVerified);

  useEffect(() => {
    if (!showCameraStep || !attemptId) return;
    setCameraError('');
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      .then((s) => {
        stream = s;
        setCameraStream(s);
      })
      .catch((err) => {
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Bạn cần cấp quyền camera để làm bài. Vui lòng bật quyền camera trong cài đặt trình duyệt rồi tải lại trang.'
            : 'Không thể bật camera. Vui lòng kiểm tra thiết bị và tải lại trang.'
        );
      });
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    };
  }, [showCameraStep, attemptId]);

  const handleCaptureAndStart = useCallback(async () => {
    if (!attemptId || !videoRef.current || !cameraStream || capturing) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    setCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
      if (!blob) return;
      const path = `proctoring/${attemptId}/start.jpg`;
      const { error: uploadErr } = await supabase.storage.from('exam-uploads').upload(path, blob, { upsert: true });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data: urlData } = supabase.storage.from('exam-uploads').getPublicUrl(path);
      await logAuditEvent(attemptId, 'photo_taken', { url: urlData.publicUrl });
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      proctoringDoneRef.current = true;
      setPhotoVerified(true);
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : 'Chụp ảnh thất bại. Vui lòng thử lại.');
    } finally {
      setCapturing(false);
    }
  }, [attemptId, cameraStream, capturing]);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;
    videoRef.current.srcObject = cameraStream;
    videoRef.current.play().catch(() => {});
  }, [cameraStream]);

  const load = useCallback(async () => {
    if (!attemptId || !user?.id) return;
    const [a, e] = await Promise.all([getAttempt(attemptId), getAttempt(attemptId).then((at) => at && getExam(at.exam_id))]);
    if (!a || !e) {
      setError('Không tìm thấy bài làm hoặc đề thi.');
      return;
    }
    if (a.user_id !== user.id) {
      setError('Bạn không có quyền làm bài này.');
      return;
    }
    if (a.status === 'completed') {
      navigate(`/exam/${attemptId}/result`, { replace: true });
      return;
    }
    setAttempt(a);
    setExam(e);
    setAnswers((a.answers as Record<string, string>) ?? {});
    lastSavedRef.current = (a.answers as Record<string, string>) ?? {};
    const questionsList = await getQuestionsForAttempt(a.exam_id);
    setQuestions(questionsList);
    const endTime = a.started_at + e.duration_minutes * 60 * 1000;
    setRemainingMs(Math.max(0, endTime - Date.now()));
  }, [attemptId, user?.id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (remainingMs === null) return;
    const t = setInterval(() => {
      if (!attempt || !exam) return;
      const endTime = attempt.started_at + exam.duration_minutes * 60 * 1000;
      const r = Math.max(0, endTime - Date.now());
      setRemainingMs(r);
      if (r <= 0 && attempt.status === 'in_progress' && !timeUpSubmittedRef.current) {
        timeUpSubmittedRef.current = true;
        handleSubmit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [remainingMs, attempt?.id, exam?.id]);

  const handleSubmit = async () => {
    if (!attemptId || !attempt || attempt.status !== 'in_progress') return;
    setShowSubmitConfirm(false);
    setSubmitting(true);
    setError('');
    const toSave = answersRef.current;
    try {
      await updateAttemptAnswers(attemptId, toSave);
      const result = await submitAttempt(attemptId);
      if (!result.ok) {
        setError(result.error ?? 'Chấm bài thất bại.');
        setSubmitting(false);
        return;
      }
      // Đã chấm xong — luôn chuyển sang trang kết quả (kể cả khi sync lỗi), dùng full page redirect để ổn định trên mobile
      let syncSkipped = false;
      let syncMissingModule = false;
      let syncMissingStudentId = false;
      let syncMissingClassId = false;
      try {
        const updated = await getAttempt(attemptId);
        if (updated && exam && isTtdtSyncConfigured()) {
          const win = await getExamWindow(updated.window_id);
          const hasModule = exam.module_id != null && String(exam.module_id).trim() !== '';
          const hasStudentId = Boolean((user?.student_id ?? studentSession?.student_id) && String(user?.student_id ?? studentSession?.student_id).trim() !== '');
          const hasClassId = Boolean(win?.class_id && String(win?.class_id).trim() !== '');
          const hasEnrollmentInfo = (hasStudentId && hasClassId) || undefined;
          if (hasModule && hasEnrollmentInfo) {
            await syncAttemptToTtdt(updated, exam, {
              studentId: user?.student_id ?? studentSession?.student_id ?? undefined,
              classId: win?.class_id ?? undefined,
            });
          } else {
            syncSkipped = true;
            syncMissingModule = !hasModule;
            syncMissingStudentId = !hasStudentId;
            syncMissingClassId = !hasClassId;
          }
        }
      } catch (_) {
        syncSkipped = true;
      }
      const base = (import.meta.env.BASE_URL || '').replace(/\/$/, '');
      const resultPath = `${base}/exam/${attemptId}/result`;
      const url = new URL(resultPath, window.location.origin);
      if (syncSkipped || syncMissingModule || syncMissingStudentId || syncMissingClassId) {
        url.searchParams.set('syncSkipped', '1');
        if (syncMissingModule) url.searchParams.set('syncMissingModule', '1');
        if (syncMissingStudentId) url.searchParams.set('syncMissingStudentId', '1');
        if (syncMissingClassId) url.searchParams.set('syncMissingClassId', '1');
      }
      window.location.replace(url.pathname + url.search);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi nộp bài.');
    } finally {
      setSubmitting(false);
    }
  };

  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    if (!attemptId || Object.keys(answers).length === 0) return;
    autosaveRef.current = setInterval(async () => {
      if (JSON.stringify(answers) === JSON.stringify(lastSavedRef.current)) return;
      try {
        await updateAttemptAnswers(attemptId, answers);
        lastSavedRef.current = { ...answers };
      } catch (_) {}
    }, 10000);
    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current);
    };
  }, [attemptId, answers]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && attemptId) {
        logAuditEvent(attemptId, 'visibility_hidden').catch(() => {});
        violationCountRef.current += 1;
        if (violationCountRef.current >= MAX_VIOLATIONS && !submittedDueToViolationRef.current) {
          submittedDueToViolationRef.current = true;
          setTimeout(() => handleSubmitRef.current?.(), 200);
        }
      }
      if (document.visibilityState === 'visible' && attemptId) {
        getAttempt(attemptId).then((a) => {
          if (a?.status === 'completed') {
            navigate(`/exam/${attemptId}/result`, { replace: true });
          }
        }).catch(() => {});
      }
    };
    const onBlur = () => {
      if (attemptId) {
        logAuditEvent(attemptId, 'focus_lost').catch(() => {});
        violationCountRef.current += 1;
        if (violationCountRef.current >= MAX_VIOLATIONS && !submittedDueToViolationRef.current) {
          submittedDueToViolationRef.current = true;
          setTimeout(() => handleSubmitRef.current?.(), 200);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [attemptId]);

  /** Chặn copy/paste trên màn làm bài và ghi audit */
  useEffect(() => {
    if (!attemptId) return;
    const prevent = (e: ClipboardEvent) => {
      e.preventDefault();
      logAuditEvent(attemptId, 'copy_paste_blocked').catch(() => {});
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
    if (!attemptId || !attempt || questions.length === 0) return;
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (document.fullscreenElement) return;
      if (fullscreenRequestedRef.current && attemptId) {
        logAuditEvent(attemptId, 'fullscreen_exited').catch(() => {});
        violationCountRef.current += 1;
        if (violationCountRef.current >= MAX_VIOLATIONS && !submittedDueToViolationRef.current) {
          submittedDueToViolationRef.current = true;
          setTimeout(() => handleSubmitRef.current?.(), 200);
        }
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [attemptId, attempt?.id, questions.length]);

  if (error && !attempt) return <p className="p-4 text-red-600">{error}</p>;
  if (!attempt || !exam) return <p className="p-4 text-slate-500">Đang tải...</p>;

  const answeredCount = questions.filter((q) => {
    const v = answers[q.id];
    if (v == null || typeof v !== 'string') return false;
    return v.trim() !== '';
  }).length;
  const totalQuestions = questions.length;

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Bước 1: Chụp ảnh khuôn mặt — bắt buộc trước khi làm bài */}
      {showCameraStep && (
        <div className="fixed inset-0 z-[60] bg-slate-900/90 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-5">
            <div className="font-semibold text-slate-900 text-lg mb-1">Chụp ảnh khuôn mặt trước khi làm bài</div>
            <p className="text-slate-600 text-sm mb-4">
              Vui lòng bật quyền camera và đưa khuôn mặt vào khung hình. Sau đó bấm <strong>Chụp ảnh và bắt đầu làm bài</strong>. Ảnh dùng để giám sát thi.
            </p>
            {cameraError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                {cameraError}
              </div>
            )}
            {cameraStream && (
              <>
                <div className="relative rounded-lg overflow-hidden bg-slate-800 mb-4 aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCaptureAndStart}
                  disabled={capturing}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                >
                  {capturing ? 'Đang chụp và tải lên...' : 'Chụp ảnh và bắt đầu làm bài'}
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
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
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
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Vào toàn màn hình
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
        <span className="font-medium text-slate-800">{exam.title}</span>
        <span className={`font-mono text-lg ${remainingMs !== null && remainingMs < 60000 ? 'text-red-600' : 'text-slate-700'}`}>
          {remainingMs !== null ? formatRemaining(remainingMs) : '—'}
        </span>
      </div>

      {error && <p className="text-red-600 mb-2">{error}</p>}

      <p className="text-slate-500 text-sm mb-4">Trình duyệt sẽ ghi nhận khi bạn chuyển tab, mất focus hoặc thoát toàn màn hình. Nếu ẩn tab / thoát fullscreen 3 lần, bài sẽ được <strong>tự động nộp</strong>; khi quay lại tab, trang sẽ chuyển sang kết quả nếu đã nộp.</p>

      <div className="space-y-6">
        {(() => {
          // Tráo thứ tự câu hỏi theo attemptId (ổn định cho thí sinh trong suốt lượt làm)
          const qSeed = hashStringToSeed(attemptId ?? 'seed');
          const shuffledQuestions = shuffleWithSeed(questions, qSeed);
          return shuffledQuestions.map((q, idx) => {
            const rawOpts = (Array.isArray(q.options) ? q.options as { id: string; text: string }[] : []);
            // Tráo đáp án cho trắc nghiệm (giữ id, chỉ tráo thứ tự hiển thị)
            const optSeed = hashStringToSeed(`${attemptId ?? 'seed'}|${q.id}|opts`);
            const opts = (q.question_type === 'single_choice' || q.question_type === 'multiple_choice')
              ? shuffleWithSeed(rawOpts, optSeed)
              : rawOpts;
          const isMultiple = q.question_type === 'multiple_choice';
          const isDragDrop = q.question_type === 'drag_drop';
          const isLabelOnImage = isDragDrop && q.image_url && opts.length === 4;
          const isEssay = q.question_type === 'video_paragraph' || q.question_type === 'main_idea';
          const currentSingle = answers[q.id] ?? '';
          let currentMultiple: string[] = [];
          let currentOrder: string[] = [];
          try {
            if (answers[q.id]?.startsWith('[')) {
              const parsed = JSON.parse(answers[q.id]) as string[];
              if (isDragDrop) currentOrder = parsed;
              else currentMultiple = parsed;
            } else if (answers[q.id]) {
              currentMultiple = [answers[q.id]];
              currentOrder = opts.length ? opts.map((o) => o.id) : [];
            }
          } catch {}
          if (isDragDrop && currentOrder.length === 0 && opts.length) currentOrder = opts.map((o) => o.id);
          const labelOnImageValue = isLabelOnImage
            ? (currentOrder.length >= 4 ? currentOrder : [...currentOrder, '', '', '', ''].slice(0, 4))
            : [];

          return (
            <div key={q.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="font-medium text-slate-800 mb-2">
                Câu {idx + 1}. {q.stem}
                {isMultiple && <span className="text-slate-500 text-sm ml-1">(chọn nhiều đáp án đúng)</span>}
                {isDragDrop && <span className="text-slate-500 text-sm ml-1">(kéo thả sắp xếp đúng thứ tự)</span>}
                {isLabelOnImage && <span className="text-slate-500 text-sm ml-1">(kéo nhãn vào đúng ô trên hình)</span>}
                {isEssay && <span className="text-slate-500 text-sm ml-1">(tự luận)</span>}
              </p>
              {q.image_url && !isLabelOnImage && (
                <img src={q.image_url} alt="" className="max-w-full rounded mb-2 max-h-48 object-contain" />
              )}
              {isEssay && q.media_url && (
                <div className="mb-2">
                  <video src={q.media_url} controls className="max-w-full rounded max-h-64" />
                </div>
              )}
              {isEssay ? (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={5}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="Nhập câu trả lời..."
                />
              ) : isLabelOnImage ? (
                (() => {
                  let r = q.rubric;
                  if (typeof r === 'string' && r.trim()) {
                    try {
                      r = JSON.parse(r) as unknown;
                    } catch {
                      r = undefined;
                    }
                  }
                  const zones =
                    r &&
                    typeof r === 'object' &&
                    r !== null &&
                    'zones' in r &&
                    Array.isArray((r as { zones?: unknown }).zones) &&
                    (r as { zones: { x: number; y: number }[] }).zones.length === 4
                      ? (r as { zones: { x: number; y: number }[] }).zones
                      : undefined;
                  return (
                    <LabelOnImageDrop
                      imageUrl={q.image_url!}
                      options={shuffleWithSeed(opts, hashStringToSeed(`${attemptId ?? 'seed'}|${q.id}|labels`))}
                      value={labelOnImageValue}
                      onChange={(zoneLabelIds) => setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(zoneLabelIds) }))}
                      zones={zones}
                    />
                  );
                })()
              ) : isDragDrop && opts.length > 0 ? (
                <SortableOptionList
                  options={shuffleWithSeed(opts, hashStringToSeed(`${attemptId ?? 'seed'}|${q.id}|drag`))}
                  value={currentOrder}
                  onChange={(orderedIds) => setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(orderedIds) }))}
                />
              ) : (
                <div className="space-y-2">
                  {opts.map((opt) =>
                    isMultiple ? (
                      <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentMultiple.includes(opt.id)}
                          onChange={() => {
                            const next = currentMultiple.includes(opt.id)
                              ? currentMultiple.filter((x) => x !== opt.id)
                              : [...currentMultiple, opt.id].sort();
                            setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(next) }));
                          }}
                          className="w-4 h-4"
                        />
                        <span>{opt.text}</span>
                      </label>
                    ) : (
                      <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={q.id}
                          checked={currentSingle === opt.id}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                          className="w-4 h-4"
                        />
                        <span>{opt.text}</span>
                      </label>
                    )
                  )}
                </div>
              )}
            </div>
          );
          });
        })()}
      </div>

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
          disabled={submitting || (remainingMs !== null && remainingMs <= 0)}
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
