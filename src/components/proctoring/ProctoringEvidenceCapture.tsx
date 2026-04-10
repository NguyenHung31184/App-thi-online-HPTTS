import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
  error?: string;
}

export interface ProctoringEvidenceCaptureRef {
  captureAndUpload: (kind: EvidenceKind, opts?: { toastOnceKey?: string }) => Promise<CaptureEvidenceResult>;
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

export const ProctoringEvidenceCapture = forwardRef<ProctoringEvidenceCaptureRef, ProctoringEvidenceCaptureProps>(
  function ProctoringEvidenceCapture(props, ref) {
    const { enabled, attemptId, examId, studentKey } = props;
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [ready, setReady] = useState(false);
    const toastOnceRef = useRef<Set<string>>(new Set());

    const stop = useCallback(() => {
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
    }, []);

    const ensureStarted = useCallback(async () => {
      if (!enabled) return;
      if (streamRef.current && ready) return;
      if (!videoRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      } catch (e) {
        setReady(false);
        const msg = e instanceof Error ? e.message : 'Không thể bật camera evidence.';
        if (!toastOnceRef.current.has('camera_denied')) {
          toastOnceRef.current.add('camera_denied');
          toast.warning('Không bật được camera giám sát', { description: msg });
        }
      }
    }, [enabled, ready]);

    const captureAndUpload = useCallback(
      async (kind: EvidenceKind, opts?: { toastOnceKey?: string }): Promise<CaptureEvidenceResult> => {
        if (!enabled) return { ok: false, error: 'disabled' };
        await ensureStarted();
        const video = videoRef.current;
        if (!video || !streamRef.current || !ready || video.videoWidth === 0 || video.videoHeight === 0) {
          if (opts?.toastOnceKey && !toastOnceRef.current.has(opts.toastOnceKey)) {
            toastOnceRef.current.add(opts.toastOnceKey);
            toast.info('Không chụp được ảnh giám sát', { description: 'Camera chưa sẵn sàng.' });
          }
          return { ok: false, error: 'not_ready' };
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return { ok: false, error: 'no_canvas_ctx' };
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await canvasToBlob(canvas);

        const safeExam = ensureSafeKey(examId);
        const safeStudent = ensureSafeKey(studentKey);
        const safeAttempt = ensureSafeKey(attemptId);
        const filename = `${kind}_${Date.now()}.jpg`;
        // Path thực sẽ được Edge quyết định; client chỉ gửi context để audit/debug.
        const res = await uploadExamFileViaEdge({
          category: 'proctoring',
          attemptId: safeAttempt,
          kind: `${safeExam}_${safeStudent}_${filename}`,
          file: new Blob([blob], { type: 'image/jpeg' }),
        });
        if (!res.ok) return { ok: false, error: res.error };
        return { ok: true, path: res.path, publicUrl: res.signedUrl };
      },
      [attemptId, enabled, ensureStarted, examId, ready, studentKey]
    );

    useImperativeHandle(ref, () => ({
      captureAndUpload,
      getVideoElement: () => videoRef.current,
    }), [captureAndUpload]);

    useEffect(() => {
      if (!enabled) {
        // Dừng stream trực tiếp tại đây — không gọi stop() để tránh setState đồng bộ trong body effect
        // (gây cascading render). setReady sẽ được gọi trong cleanup của lần enabled=true trước đó.
        const s = streamRef.current;
        if (s) s.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        return;
      }
      // Khởi động camera sớm để khi vi phạm có thể chụp ngay.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- setState gọi bất đồng bộ sau getUserMedia resolve, không phải synchronously
      ensureStarted();
      return () => stop();
    }, [enabled, ensureStarted, stop]);

    return (
      <video
        ref={videoRef}
        muted
        playsInline
        // Ẩn hoàn toàn: chỉ dùng để capture frame
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    );
  }
);

