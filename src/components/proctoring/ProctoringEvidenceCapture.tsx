import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { toast } from 'sonner';
import { uploadExamFileViaEdge } from '../../services/examUploadService';

export type EvidenceKind =
  | 'focus_lost'
  | 'visibility_hidden'
  | 'fullscreen_exited'
  | 'ai_cell_phone'
  | 'ai_prohibited_object'
  | 'ai_no_face'
  | 'ai_multiple_face';

export interface CaptureEvidenceResult {
  ok: boolean;
  path?: string;
  publicUrl?: string;
  evidence?: { phase: string; path?: string; publicUrl?: string }[];
  error?: string;
}

export interface ProctoringEvidenceCaptureRef {
  captureAndUpload: (kind: EvidenceKind, opts?: { toastOnceKey?: string }) => Promise<CaptureEvidenceResult>;
  captureSequenceAndUpload: (kind: EvidenceKind, opts?: { toastOnceKey?: string }) => Promise<CaptureEvidenceResult>;
  /** Trả về video element nội bộ để AiObjectProctorBurst tái dụng, tránh mở 2 luồng camera */
  getVideoElement: () => HTMLVideoElement | null;
}

export interface ProctoringEvidenceCaptureProps {
  enabled: boolean;
  attemptId: string;
  examId: string;
  studentKey: string; // student_id nếu có, fallback user_id
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

function streamHasLiveVideo(stream: MediaStream | null): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some((t) => t.readyState === 'live');
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
    useLayoutEffect(() => {
      enabledRef.current = enabled;
    }, [enabled]);
    /** Tăng mỗi lần tắt stream / disabled để huỷ kết quả của getUserMedia/play đang treo. */
    const sessionTokenRef = useRef(0);
    /** Chỉ một lần khởi động camera tại một thời điểm — tránh play() bị cắt bởi gán srcObject mới. */
    const startPromiseRef = useRef<Promise<void> | null>(null);
    const preEventBlobRef = useRef<Blob | null>(null);

    const stop = useCallback(() => {
      sessionTokenRef.current += 1;
      preEventBlobRef.current = null;
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      readySyncRef.current = false;
      const v = videoRef.current;
      if (v) v.srcObject = null;
    }, []);

    const ensureStarted = useCallback(async () => {
      if (!enabledRef.current) return;
      if (!videoRef.current) return;

      if (readySyncRef.current && streamHasLiveVideo(streamRef.current)) return;

      if (startPromiseRef.current) {
        await startPromiseRef.current;
        return;
      }

      const run = async (): Promise<void> => {
        const tokenAtStart = sessionTokenRef.current;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: false,
          });
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
          v.srcObject = stream;
          await v.play();
          if (tokenAtStart !== sessionTokenRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            v.srcObject = null;
            return;
          }
          readySyncRef.current = true;
        } catch (e) {
          readySyncRef.current = false;
          const msg = e instanceof Error ? e.message : 'Không thể bật camera evidence.';
          if (!toastOnceRef.current.has('camera_denied')) {
            toastOnceRef.current.add('camera_denied');
            toast.warning('Không bật được camera giám sát', { description: msg });
          }
        }
      };

      const p = run().finally(() => {
        startPromiseRef.current = null;
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
      getVideoElement: () => videoRef.current,
    }), [captureAndUpload, captureSequenceAndUpload]);

    useEffect(() => {
      if (!enabled) {
        const s = streamRef.current;
        if (s) s.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        readySyncRef.current = false;
        const v = videoRef.current;
        if (v) v.srcObject = null;
        sessionTokenRef.current += 1;
        return;
      }
      void ensureStarted();
      return () => stop();
    }, [enabled, ensureStarted, stop]);

    useEffect(() => {
      preEventBlobRef.current = null;
      if (!enabled) {
        return;
      }
      const refresh = async () => {
        const blob = await captureFrameBlob();
        if (blob) preEventBlobRef.current = blob;
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
