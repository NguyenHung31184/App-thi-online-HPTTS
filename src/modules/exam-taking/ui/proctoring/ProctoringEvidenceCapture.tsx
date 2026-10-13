import type { EvidenceKind, CaptureEvidenceResult, ProctoringEvidenceCaptureRef, ProctoringCameraStatus } from '../../domain/proctoring-evidence';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { toast } from 'sonner';
import { uploadExamFileViaEdge } from '../../queries/session-actions';
import { cameraHasUsableTrack, openCamera, playCameraVideo, stopCamera } from '../../../../platform/media/camera';

export interface ProctoringEvidenceCaptureProps {
  enabled: boolean;
  attemptId: string;
  examId: string;
  studentKey: string; // student_id nếu có, fallback user_id
  onCameraStatus?: (status: ProctoringCameraStatus) => void;
}

function ensureSafeKey(s: string): string {
  return String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Không thể tạo ảnh evidence.'))),
      'image/jpeg',
      quality
    );
  });
}

export const ProctoringEvidenceCapture = forwardRef<ProctoringEvidenceCaptureRef, ProctoringEvidenceCaptureProps>(
  function ProctoringEvidenceCapture(props, ref) {
    const { enabled, attemptId, examId, studentKey } = props;
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const toastOnceRef = useRef<Set<string>>(new Set());
    /** Đồng bộ ngay sau play() — tránh đọc state React stale sau await ensureStarted. */
    const readySyncRef = useRef(false);
    const enabledRef = useRef(enabled);
    const statusCallbackRef = useRef(props.onCameraStatus);
    const controllerRef = useRef<AbortController | null>(null);
    const trackCleanupRef = useRef<(() => void) | null>(null);
    useLayoutEffect(() => {
      enabledRef.current = enabled;
      statusCallbackRef.current = props.onCameraStatus;
    }, [enabled, props.onCameraStatus]);
    /** Tăng mỗi lần tắt stream / disabled để huỷ kết quả của getUserMedia/play đang treo. */
    const sessionTokenRef = useRef(0);
    /** Chỉ một lần khởi động camera tại một thời điểm — tránh play() bị cắt bởi gán srcObject mới. */
    const startPromiseRef = useRef<Promise<void> | null>(null);
    const preEventBlobRef = useRef<Blob | null>(null);

    const stop = useCallback(() => {
      sessionTokenRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      startPromiseRef.current = null;
      trackCleanupRef.current?.();
      trackCleanupRef.current = null;
      preEventBlobRef.current = null;
      const s = streamRef.current;
      stopCamera(s);
      streamRef.current = null;
      readySyncRef.current = false;
      const v = videoRef.current;
      if (v) v.srcObject = null;
    }, []);

    const ensureStarted = useCallback(async () => {
      if (!enabledRef.current || document.visibilityState === 'hidden') return;
      if (!videoRef.current) return;

      if (readySyncRef.current && cameraHasUsableTrack(streamRef.current) && !videoRef.current.paused) return;

      if (startPromiseRef.current) {
        await startPromiseRef.current;
        return;
      }

      const run = async (): Promise<void> => {
        const tokenAtStart = sessionTokenRef.current;
        const controller = new AbortController();
        controllerRef.current = controller;
        statusCallbackRef.current?.('starting');
        try {
          stopCamera(streamRef.current);
          trackCleanupRef.current?.();
          const stream = await openCamera({
            video: { width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 }, facingMode: 'user' },
            audio: false,
          }, { signal: controller.signal });
          if (tokenAtStart !== sessionTokenRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          const v = videoRef.current;
          if (!v || !enabledRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          const track = stream.getVideoTracks()[0];
          const interrupted = () => {
            readySyncRef.current = false;
            preEventBlobRef.current = null;
            statusCallbackRef.current?.('interrupted');
          };
          const resumed = () => {
            readySyncRef.current = cameraHasUsableTrack(stream);
            if (readySyncRef.current) statusCallbackRef.current?.('ready');
          };
          track?.addEventListener('mute', interrupted);
          track?.addEventListener('ended', interrupted);
          track?.addEventListener('unmute', resumed);
          trackCleanupRef.current = () => {
            track?.removeEventListener('mute', interrupted);
            track?.removeEventListener('ended', interrupted);
            track?.removeEventListener('unmute', resumed);
          };
          v.srcObject = stream;
          await playCameraVideo(v, controller.signal);
          if (tokenAtStart !== sessionTokenRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          readySyncRef.current = cameraHasUsableTrack(stream);
          statusCallbackRef.current?.(readySyncRef.current ? 'ready' : 'interrupted');
        } catch (e) {
          if (tokenAtStart !== sessionTokenRef.current || controller.signal.aborted) return;
          stopCamera(streamRef.current);
          streamRef.current = null;
          if (videoRef.current) videoRef.current.srcObject = null;
          readySyncRef.current = false;
          statusCallbackRef.current?.('error');
          const msg = e instanceof Error ? e.message : 'Không thể bật camera evidence.';
          if (!toastOnceRef.current.has('camera_denied')) {
            toastOnceRef.current.add('camera_denied');
            toast.warning('Không bật được camera giám sát', { description: msg });
          }
        }
      };

      const p = run().finally(() => {
        if (startPromiseRef.current === p) startPromiseRef.current = null;
      });
      startPromiseRef.current = p;
      await p;
    }, []);

    const captureFrameBlob = useCallback(async (): Promise<Blob | null> => {
      const video = videoRef.current;
      if (
        !video ||
        !streamRef.current ||
        !readySyncRef.current ||
        !cameraHasUsableTrack(streamRef.current) ||
        video.paused || video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) return null;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvasToBlob(canvas);
    }, []);

    const restartCamera = useCallback(async () => {
      stop();
      await ensureStarted();
    }, [stop, ensureStarted]);

    const uploadBlob = useCallback(async (kind: EvidenceKind, blob: Blob, phase?: string): Promise<CaptureEvidenceResult> => {
        const safeExam = ensureSafeKey(examId);
        const safeStudent = ensureSafeKey(studentKey);
        const safeAttempt = ensureSafeKey(attemptId);
        const filename = `${kind}_${phase ? `${phase}_` : ''}${Date.now()}.jpg`;
        const res = await uploadExamFileViaEdge({
          category: 'proctoring',
          attemptId: safeAttempt,
          kind: `${safeExam}_${safeStudent}_${filename}`,
          file: new Blob([blob], { type: 'image/jpeg' }),
        });
        if (!res.ok) return { ok: false, error: res.error };
        return { ok: true, path: res.path, publicUrl: res.signedUrl };
    }, [attemptId, examId, studentKey]);

    const notifyNotReady = useCallback((toastOnceKey?: string) => {
      if (toastOnceKey && !toastOnceRef.current.has(toastOnceKey)) {
        toastOnceRef.current.add(toastOnceKey);
        toast.info('Không chụp được ảnh giám sát', { description: 'Camera chưa sẵn sàng.' });
      }
    }, []);

    const captureAndUpload = useCallback(
      async (kind: EvidenceKind, opts?: { toastOnceKey?: string }): Promise<CaptureEvidenceResult> => {
        if (!enabled) return { ok: false, error: 'disabled' };
        await ensureStarted();
        const blob = await captureFrameBlob();
        if (!blob) {
          notifyNotReady(opts?.toastOnceKey);
          return { ok: false, error: 'not_ready' };
        }
        return uploadBlob(kind, blob);
      },
      [captureFrameBlob, enabled, ensureStarted, notifyNotReady, uploadBlob]
    );

    const captureSequenceAndUpload = useCallback(
      async (kind: EvidenceKind, opts?: { toastOnceKey?: string }): Promise<CaptureEvidenceResult> => {
        if (!enabled) return { ok: false, error: 'disabled' };
        const sessionToken = sessionTokenRef.current;
        await ensureStarted();
        if (!enabledRef.current || sessionToken !== sessionTokenRef.current) {
          return { ok: false, error: 'disabled' };
        }
        const before = preEventBlobRef.current;
        const during = await captureFrameBlob();
        if (!during) {
          notifyNotReady(opts?.toastOnceKey);
          return { ok: false, error: 'not_ready' };
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1_500));
        if (!enabledRef.current || sessionToken !== sessionTokenRef.current) {
          return { ok: false, error: 'disabled' };
        }
        const after = await captureFrameBlob();
        const frames = [
          before ? { phase: 'before', blob: before } : null,
          { phase: 'during', blob: during },
          after ? { phase: 'after', blob: after } : null,
        ].filter((frame): frame is { phase: string; blob: Blob } => frame !== null);
        const uploaded = await Promise.all(frames.map(async (frame) => ({
          phase: frame.phase,
          result: await uploadBlob(kind, frame.blob, frame.phase),
        })));
        const evidence = uploaded
          .filter((item) => item.result.ok)
          .map((item) => ({ phase: item.phase, path: item.result.path, publicUrl: item.result.publicUrl }));
        const primary = evidence.find((item) => item.phase === 'during');
        if (!primary) return { ok: false, error: 'upload_failed' };
        return { ok: true, path: primary.path, publicUrl: primary.publicUrl, evidence };
      },
      [captureFrameBlob, enabled, ensureStarted, notifyNotReady, uploadBlob],
    );

    useImperativeHandle(ref, () => ({
      captureAndUpload,
      captureSequenceAndUpload,
      getVideoElement: () => readySyncRef.current && cameraHasUsableTrack(streamRef.current) ? videoRef.current : null,
      restartCamera,
    }), [captureAndUpload, captureSequenceAndUpload, restartCamera]);

    useEffect(() => {
      if (!enabled) {
        stop();
        statusCallbackRef.current?.('stopped');
        return;
      }
      void ensureStarted();
      return () => stop();
    }, [enabled, ensureStarted, stop]);

    useEffect(() => {
      if (!enabled) return;
      const resume = () => {
        if (document.visibilityState === 'hidden') {
          readySyncRef.current = false;
          preEventBlobRef.current = null;
          return;
        }
        void restartCamera();
      };
      document.addEventListener('visibilitychange', resume);
      window.addEventListener('pageshow', resume);
      return () => {
        document.removeEventListener('visibilitychange', resume);
        window.removeEventListener('pageshow', resume);
      };
    }, [enabled, restartCamera]);

    useEffect(() => {
      preEventBlobRef.current = null;
      if (!enabled) {
        return;
      }
      let snapshotInFlight = false;
      let lastVideoTime = -1;
      let lastFrameAt = Date.now();
      const refresh = async () => {
        if (document.visibilityState === 'hidden' || snapshotInFlight) return;
        const video = videoRef.current;
        if (readySyncRef.current && video) {
          if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            lastFrameAt = Date.now();
          } else if (Date.now() - lastFrameAt >= 5_000) {
            readySyncRef.current = false;
            preEventBlobRef.current = null;
            statusCallbackRef.current?.('interrupted');
          }
        }
        const token = sessionTokenRef.current;
        snapshotInFlight = true;
        try {
          const blob = await captureFrameBlob();
          if (blob && token === sessionTokenRef.current) preEventBlobRef.current = blob;
        } catch { /* A failed JPEG must not leave an unhandled rejection or an old pre-event frame. */
          if (token === sessionTokenRef.current) preEventBlobRef.current = null;
        } finally {
          snapshotInFlight = false;
        }
      };
      void refresh();
      const timer = window.setInterval(() => { void refresh(); }, 2_500);
      return () => window.clearInterval(timer);
    }, [attemptId, captureFrameBlob, enabled, examId, studentKey]);

    return (
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    );
  }
);
