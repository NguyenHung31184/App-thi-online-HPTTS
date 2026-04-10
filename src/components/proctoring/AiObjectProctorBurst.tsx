import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { BlazeFaceModel } from '@tensorflow-models/blazeface';
import { loadBlazeFaceModel } from '../../utils/blazeFaceProctor';
import type { ProctoringEvidenceCaptureRef } from './ProctoringEvidenceCapture';

type CocoSsd = typeof import('@tensorflow-models/coco-ssd');
type CocoModel = Awaited<ReturnType<CocoSsd['load']>>;

export interface AiObjectProctorBurstProps {
  enabled: boolean;
  evidenceRef: React.RefObject<ProctoringEvidenceCaptureRef | null>;
  onViolation?: (kind: 'ai_cell_phone' | 'ai_prohibited_object' | 'ai_no_face' | 'ai_multiple_face', evidence?: { path?: string; publicUrl?: string }) => void;
  /**
   * true (mặc định): COCO-SSD (điện thoại, vật cấm) + BlazeFace (mặt).
   * false: chỉ BlazeFace — dùng khi tắt VITE_AI_PROCTORING_ENABLED nhưng vẫn muốn kiểm tra không mặt / nhiều mặt (mục 2a).
   */
  detectObjects?: boolean;
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
    detectObjects = true,
    burstEveryMs = 60_000,
    burstDurationMs = 5_000,
    detectIntervalMs = 1_000,
    minScore = 0.6,
    notify = false,
  } = props;

  // ownVideoRef: video element dự phòng, chỉ dùng khi không có shared video từ ProctoringEvidenceCapture
  const ownVideoRef = useRef<HTMLVideoElement | null>(null);
  // streamRef: chỉ giữ stream mở bởi chính component này (không phải shared stream)
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<CocoModel | null>(null);
  const blazeFaceRef = useRef<BlazeFaceModel | null>(null);
  const timersRef = useRef<{ schedule?: number; detect?: number; stopBurst?: number }>({});
  const lastHitRef = useRef<Record<string, number>>({});
  /** Sẵn sàng chạy burst: COCO xong (nếu detectObjects) hoặc BlazeFace xong (chế độ face-only). */
  const [burstReady, setBurstReady] = useState(false);

  const configKey = useMemo(
    () => `${burstEveryMs}|${burstDurationMs}|${detectIntervalMs}|${minScore}|${detectObjects}`,
    [burstEveryMs, burstDurationMs, detectIntervalMs, minScore, detectObjects]
  );

  useEffect(() => {
    if (!enabled) {
      setBurstReady(false);
      return;
    }
    let cancelled = false;

    const startCamera = async () => {
      // Ưu tiên tái dùng video element từ ProctoringEvidenceCapture (đã có stream sẵn)
      // → tránh mở 2 luồng camera song song, tiết kiệm CPU/GPU/pin
      const sharedVideo = evidenceRef.current?.getVideoElement?.();
      if (sharedVideo && sharedVideo.readyState >= 2 && sharedVideo.videoWidth > 0) {
        return; // Sẽ dùng shared video trong detectOnce, không cần mở camera riêng
      }
      // Fallback: mở camera riêng chỉ khi shared video chưa sẵn sàng
      if (!ownVideoRef.current || streamRef.current) return;
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
        ownVideoRef.current.srcObject = stream;
        await ownVideoRef.current.play();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Không thể bật camera AI.';
        toast.warning('Không bật được camera AI giám sát', { description: msg });
      }
    };

    const loadModel = async () => {
      try {
        await import('@tensorflow/tfjs');
        const coco = await import('@tensorflow-models/coco-ssd');
        const m = await coco.load();
        if (cancelled) return;
        modelRef.current = m;
        setBurstReady(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Không tải được model AI.';
        toast.error('Không thể tải AI giám sát', { description: msg });
      }
    };

    const loadBlaze = async () => {
      try {
        const bm = await loadBlazeFaceModel();
        if (cancelled) return;
        blazeFaceRef.current = bm;
        if (!detectObjects) setBurstReady(true);
      } catch (e) {
        if (!detectObjects) {
          const msg = e instanceof Error ? e.message : 'Không tải BlazeFace.';
          toast.error('Không thể tải kiểm tra khuôn mặt', { description: msg });
        }
      }
    };

    setBurstReady(false);
    startCamera();
    if (detectObjects) {
      loadModel();
      loadBlaze();
    } else {
      modelRef.current = null;
      loadBlaze();
    }

    return () => {
      cancelled = true;
    };
  }, [enabled, evidenceRef, detectObjects]);

  useEffect(() => {
    if (!enabled || !burstReady) return;

    const clearTimers = () => {
      const t = timersRef.current;
      if (t.schedule) window.clearInterval(t.schedule);
      if (t.detect) window.clearInterval(t.detect);
      if (t.stopBurst) window.clearTimeout(t.stopBurst);
      timersRef.current = {};
    };

    const stopTimersAndOwnStream = () => {
      clearTimers();
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    const getActiveVideo = (): HTMLVideoElement | null => {
      // Ưu tiên shared video; fallback về own video nếu shared chưa sẵn sàng
      const shared = evidenceRef.current?.getVideoElement?.();
      if (shared && shared.readyState >= 2 && shared.videoWidth > 0) return shared;
      return ownVideoRef.current;
    };

    const detectOnce = async () => {
      const video = getActiveVideo();
      if (!video || video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) return;

      try {
        let preds: Awaited<ReturnType<CocoModel['detect']>> | null = null;
        const model = modelRef.current;
        if (detectObjects && model) {
          preds = await model.detect(video);
          for (const p of preds) {
            if ((p.score ?? 0) < minScore) continue;
            if (p.class === 'cell phone') {
              await maybeHit('ai_cell_phone');
            } else if (p.class === 'book' || p.class === 'laptop') {
              await maybeHit('ai_prohibited_object');
            }
          }
        }

        const bf = blazeFaceRef.current;
        let faceHandled = false;
        if (bf) {
          try {
            const faces = await bf.estimateFaces(video, false, true, false);
            const n = faces.filter((f) => Array.isArray(f.topLeft)).length;
            if (n === 0) await maybeHit('ai_no_face');
            if (n > 1) await maybeHit('ai_multiple_face');
            faceHandled = true;
          } catch {
            /* fallback COCO khi có model */
          }
        }
        if (!faceHandled && preds) {
          let personCount = 0;
          let hasPerson = false;
          for (const p of preds) {
            if ((p.score ?? 0) < minScore) continue;
            if (p.class === 'person') {
              hasPerson = true;
              personCount += 1;
            }
          }
          if (!hasPerson) await maybeHit('ai_no_face');
          if (personCount > 1) await maybeHit('ai_multiple_face');
        }
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
      const canRun = detectObjects ? Boolean(modelRef.current) : Boolean(blazeFaceRef.current);
      if (!canRun) return;
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
    return () => stopTimersAndOwnStream();
  }, [
    enabled,
    configKey,
    burstDurationMs,
    burstEveryMs,
    detectIntervalMs,
    detectObjects,
    evidenceRef,
    minScore,
    notify,
    burstReady,
    onViolation,
  ]);

  // Video dự phòng: chỉ phát huy tác dụng khi shared video từ ProctoringEvidenceCapture chưa sẵn sàng
  return (
    <video
      ref={ownVideoRef}
      muted
      playsInline
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
    />
  );
}

