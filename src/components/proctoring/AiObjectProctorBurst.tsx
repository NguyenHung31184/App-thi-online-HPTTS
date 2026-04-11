import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { BlazeFaceModel } from '@tensorflow-models/blazeface';
import { detectFacesInVideo, loadBlazeFaceModel } from '../../utils/blazeFaceProctor';
import type { ProctoringEvidenceCaptureRef } from './ProctoringEvidenceCapture';

type CocoSsd = typeof import('@tensorflow-models/coco-ssd');
type CocoModel = Awaited<ReturnType<CocoSsd['load']>>;

export interface AiObjectProctorBurstProps {
  enabled: boolean;
  evidenceRef: React.RefObject<ProctoringEvidenceCaptureRef | null>;
  /**
   * Ghi nhận vi phạm: gọi 2 lần — (1) chỉ `kind` để UI cảnh báo ngay; (2) sau khi chụp evidence để ghi audit.
   */
  onViolation?: (
    kind: 'ai_cell_phone' | 'ai_prohibited_object' | 'ai_no_face' | 'ai_multiple_face',
    captureResult?: { ok: true; path?: string; publicUrl?: string } | { ok: false },
  ) => void;
  /**
   * true (mặc định): COCO-SSD (điện thoại, vật cấm) + BlazeFace (mặt).
   * false: chỉ BlazeFace — dùng khi tắt VITE_AI_PROCTORING_ENABLED nhưng vẫn muốn kiểm tra không mặt / nhiều mặt (mục 2a).
   */
  detectObjects?: boolean;
  /** @deprecated Giữ tương thích; không còn dùng (quét liên tục). */
  burstEveryMs?: number;
  /** @deprecated Giữ tương thích; không còn dùng. */
  burstDurationMs?: number;
  /** Chu kỳ quét liên tục (ms), mặc định 2,5s */
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
    burstEveryMs: _burstEveryMs = 60_000,
    burstDurationMs: _burstDurationMs = 5_000,
    detectIntervalMs = 2_500,
    minScore = 0.6,
    notify = false,
  } = props;

  // ownVideoRef: video element dự phòng, chỉ dùng khi không có shared video từ ProctoringEvidenceCapture
  const ownVideoRef = useRef<HTMLVideoElement | null>(null);
  // streamRef: chỉ giữ stream mở bởi chính component này (không phải shared stream)
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<CocoModel | null>(null);
  const blazeFaceRef = useRef<BlazeFaceModel | null>(null);
  const timersRef = useRef<{ tick?: number }>({});
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
    const cocoDoneRef = { current: false };
    const blazeDoneRef = { current: false };

    const trySetBurstReady = () => {
      if (cancelled) return;
      const modelsOk = detectObjects ? cocoDoneRef.current && blazeDoneRef.current : blazeDoneRef.current;
      if (modelsOk) setBurstReady(true);
    };

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
        cocoDoneRef.current = true;
        trySetBurstReady();
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
        blazeDoneRef.current = true;
        trySetBurstReady();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Không tải BlazeFace.';
        toast.error('Không thể tải kiểm tra khuôn mặt', { description: msg });
      }
    };

    setBurstReady(false);
    cocoDoneRef.current = false;
    blazeDoneRef.current = false;
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

    const clearTick = () => {
      const t = timersRef.current.tick;
      if (t) window.clearInterval(t);
      timersRef.current.tick = undefined;
    };

    const stopTimersAndOwnStream = () => {
      clearTick();
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    const getActiveVideo = (): HTMLVideoElement | null => {
      const shared = evidenceRef.current?.getVideoElement?.();
      if (shared && shared.readyState >= 2 && shared.videoWidth > 0) return shared;
      return ownVideoRef.current;
    };

    const detectOnce = async () => {
      const video = getActiveVideo();
      // HAVE_CURRENT_DATA (2) đủ cho nhiều trình duyệt với MediaStream; trước đây yêu cầu === 4 khiến không bao giờ quét.
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

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

        let faceCount: number | null = null;
        if (blazeFaceRef.current) {
          try {
            // Cùng flip với bước chụp mặt đầu bài (selfie).
            const { count } = await detectFacesInVideo(video, true);
            faceCount = count;
          } catch {
            faceCount = null;
          }
        }
        if (faceCount !== null) {
          if (faceCount === 0) await maybeHit('ai_no_face');
          if (faceCount > 1) await maybeHit('ai_multiple_face');
        } else if (preds) {
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
        /* một frame lỗi — bỏ qua */
      }
    };

    const maybeHit = async (kind: 'ai_cell_phone' | 'ai_prohibited_object' | 'ai_no_face' | 'ai_multiple_face') => {
      const last = lastHitRef.current[kind] ?? 0;
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
      onViolation?.(kind);
      const res = await evidenceRef.current?.captureAndUpload(kind, { toastOnceKey: `evidence_${kind}` });
      onViolation?.(kind, res?.ok ? { ok: true, path: res.path, publicUrl: res.publicUrl } : { ok: false });
    };

    timersRef.current.tick = window.setInterval(() => {
      void detectOnce();
    }, detectIntervalMs);

    return () => stopTimersAndOwnStream();
  }, [
    enabled,
    configKey,
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

