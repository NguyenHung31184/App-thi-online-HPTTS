import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';

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
}

export interface ProctoringEvidenceCaptureProps {
  enabled: boolean;
  attemptId: string;
  examId: string;
  studentKey: string; // student_id nếu có, fallback user_id
  bucket?: string; // mặc định exam-uploads
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
    const { enabled, attemptId, examId, studentKey, bucket = 'exam-uploads' } = props;
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
        const path = `exam_uploads/${safeExam}/${safeStudent}/${safeAttempt}/${filename}`;

        const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, blob, {
          upsert: true,
          contentType: 'image/jpeg',
        });
        if (uploadErr) return { ok: false, error: uploadErr.message };

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        return { ok: true, path, publicUrl: urlData?.publicUrl };
      },
      [attemptId, bucket, enabled, ensureStarted, examId, ready, studentKey]
    );

    useImperativeHandle(ref, () => ({ captureAndUpload }), [captureAndUpload]);

    useEffect(() => {
      if (!enabled) {
        stop();
        return;
      }
      // Khởi động camera sớm để khi vi phạm có thể chụp ngay.
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

