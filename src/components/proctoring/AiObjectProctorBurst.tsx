import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ProctoringEvidenceCaptureRef } from './ProctoringEvidenceCapture';

type CocoSsd = typeof import('@tensorflow-models/coco-ssd');
type CocoModel = Awaited<ReturnType<CocoSsd['load']>>;

export interface AiObjectProctorBurstProps {
  enabled: boolean;
  evidenceRef: React.RefObject<ProctoringEvidenceCaptureRef | null>;
  onViolation?: (kind: 'ai_cell_phone' | 'ai_prohibited_object' | 'ai_no_face' | 'ai_multiple_face', evidence?: { path?: string; publicUrl?: string }) => void;
  /** Chu kỳ burst (ms). Ví dụ 60_000 */
  burstEveryMs?: number;
  /** Thời lượng burst (ms). Ví dụ 5_000 */
  burstDurationMs?: number;
  /** Tần suất detect trong burst (ms). Ví dụ 1_000 */
  detectIntervalMs?: number;
  /** Ngưỡng confidence để tính vi phạm */
  minScore?: number;
  /** Nếu true: sẽ hiển thị toast khi phát hiện */
  notify?: boolean;
}

function now() {
  return Date.now();
}

export function AiObjectProctorBurst(props: AiObjectProctorBurstProps) {
  const {
    enabled,
    evidenceRef,
    onViolation,
    burstEveryMs = 60_000,
    burstDurationMs = 5_000,
    detectIntervalMs = 1_000,
    minScore = 0.6,
    notify = false,
  } = props;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<CocoModel | null>(null);
  const timersRef = useRef<{ schedule?: number; detect?: number; stopBurst?: number }>({});
  const lastHitRef = useRef<Record<string, number>>({});
  const [modelReady, setModelReady] = useState(false);

  const configKey = useMemo(
    () => `${burstEveryMs}|${burstDurationMs}|${detectIntervalMs}|${minScore}`,
    [burstEveryMs, burstDurationMs, detectIntervalMs, minScore]
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const startCamera = async () => {
      if (!videoRef.current) return;
      if (streamRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Không thể bật camera AI.';
        toast.warning('Không bật được camera AI giám sát', { description: msg });
      }
    };

    const loadModel = async () => {
      try {
        // tfjs cần được import trước để init backend (webgl/cpu)
        await import('@tensorflow/tfjs');
        const coco = await import('@tensorflow-models/coco-ssd');
        const m = await coco.load();
        if (cancelled) return;
        modelRef.current = m;
        setModelReady(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Không tải được model AI.';
        toast.error('Không thể tải AI giám sát', { description: msg });
      }
    };

    startCamera();
    loadModel();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const clearTimers = () => {
      const t = timersRef.current;
      if (t.schedule) window.clearInterval(t.schedule);
      if (t.detect) window.clearInterval(t.detect);
      if (t.stopBurst) window.clearTimeout(t.stopBurst);
      timersRef.current = {};
    };

    const stopAll = () => {
      clearTimers();
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      modelRef.current = null;
      setModelReady(false);
    };

    const detectOnce = async () => {
      const model = modelRef.current;
      const video = videoRef.current;
      if (!model || !video || video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) return;

      try {
        const preds = await model.detect(video);
        let personCount = 0;
        let hasPerson = false;
        for (const p of preds) {
          if ((p.score ?? 0) < minScore) continue;
          if (p.class === 'cell phone') {
            await maybeHit('ai_cell_phone');
          } else if (p.class === 'book' || p.class === 'laptop') {
            await maybeHit('ai_prohibited_object');
          } else if (p.class === 'person') {
            hasPerson = true;
            personCount += 1;
          }
        }
        if (!hasPerson) await maybeHit('ai_no_face');
        if (personCount > 1) await maybeHit('ai_multiple_face');
      } catch {
        // bỏ qua để không ảnh hưởng luồng thi
      }
    };

    const maybeHit = async (kind: 'ai_cell_phone' | 'ai_prohibited_object' | 'ai_no_face' | 'ai_multiple_face') => {
      const last = lastHitRef.current[kind] ?? 0;
      // cooldown 10s mỗi loại để tránh spam
      if (now() - last < 10_000) return;
      lastHitRef.current[kind] = now();
      if (notify) {
        toast.warning('Phát hiện vi phạm', {
          description:
            kind === 'ai_cell_phone'
              ? 'Điện thoại'
              : kind === 'ai_prohibited_object'
              ? 'Vật cấm (sách / laptop)'
              : kind === 'ai_multiple_face'
              ? 'Nhiều người'
              : 'Không thấy khuôn mặt',
        });
      }
      const res = await evidenceRef.current?.captureAndUpload(kind, { toastOnceKey: `evidence_${kind}` });
      onViolation?.(kind, res?.ok ? { path: res.path, publicUrl: res.publicUrl } : undefined);
    };

    const startBurst = () => {
      // chạy detect theo interval trong burstDurationMs
      if (!modelRef.current) return;
      if (timersRef.current.detect) return;
      timersRef.current.detect = window.setInterval(() => {
        detectOnce();
      }, detectIntervalMs);
      timersRef.current.stopBurst = window.setTimeout(() => {
        if (timersRef.current.detect) window.clearInterval(timersRef.current.detect);
        timersRef.current.detect = undefined;
        if (timersRef.current.stopBurst) window.clearTimeout(timersRef.current.stopBurst);
        timersRef.current.stopBurst = undefined;
      }, burstDurationMs);
    };

    const schedule = () => {
      clearTimers();
      // scheduler: mỗi burstEveryMs chạy 1 burst
      timersRef.current.schedule = window.setInterval(() => {
        startBurst();
      }, burstEveryMs);
      // burst ngay khi bắt đầu
      startBurst();
    };

    schedule();
    return () => stopAll();
  }, [enabled, configKey, burstDurationMs, burstEveryMs, detectIntervalMs, evidenceRef, minScore, notify, modelReady, onViolation]);

  // Ẩn video: chỉ dùng làm input cho model
  return (
    <video
      ref={videoRef}
      muted
      playsInline
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
    />
  );
}

