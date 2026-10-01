import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { BlazeFaceModel } from '@tensorflow-models/blazeface';
import type { FaceDetector } from '@mediapipe/tasks-vision';
import {
  AI_DETECTION_RULES,
  advanceDetectionWindow,
  createDetectionWindowState,
  type AiViolationKind,
  type DetectionWindowState,
} from '../../modules/exam-taking/public';
import { detectFacesInVideo, loadBlazeFaceModel } from '../../utils/blazeFaceProctor';
import { detectFacesWithMediaPipe, loadMediaPipeFaceDetector } from '../../utils/mediaPipeFaceProctor';
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
    kind: AiViolationKind,
    captureResult?: {
      ok: true;
      path?: string;
      publicUrl?: string;
      evidence?: { phase: string; path?: string; publicUrl?: string }[];
    } | { ok: false },
    detection?: AiDetectionDetails,
  ) => void;
  /**
   * true (mặc định): COCO-SSD (điện thoại, vật cấm) + MediaPipe (mặt).
   * false: chỉ MediaPipe; BlazeFace là phương án dự phòng nếu MediaPipe không tải được.
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

export interface AiDetectionDetails {
  confidence?: number;
  bboxRatio?: number;
  observedScans: number;
  requiredHits: number;
  windowScans: number;
  durationMs: number;
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
    detectIntervalMs = 2_500,
    minScore = 0.6,
    notify = false,
  } = props;
  // burstEveryMs / burstDurationMs vẫn nằm trên interface (tương thích API cũ), không dùng trong quét liên tục.

  // ownVideoRef: video element dự phòng, chỉ dùng khi không có shared video từ ProctoringEvidenceCapture
  const ownVideoRef = useRef<HTMLVideoElement | null>(null);
  // streamRef: chỉ giữ stream mở bởi chính component này (không phải shared stream)
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<CocoModel | null>(null);
  const blazeFaceRef = useRef<BlazeFaceModel | null>(null);
  const mediaPipeFaceRef = useRef<FaceDetector | null>(null);
  const timersRef = useRef<{ tick?: number }>({});
  const lastHitRef = useRef<Record<string, number>>({});
  const signalStatesRef = useRef<Record<AiViolationKind, DetectionWindowState>>({
    ai_no_face: createDetectionWindowState(),
    ai_multiple_face: createDetectionWindowState(),
    ai_cell_phone: createDetectionWindowState(),
    ai_prohibited_object: createDetectionWindowState(),
  });
  /** Sẵn sàng quét khi bộ nhận diện mặt và, nếu bật, bộ nhận diện vật thể đã khởi tạo xong. */
  const [burstReady, setBurstReady] = useState(false);

  const configKey = useMemo(
    () => `${detectIntervalMs}|${minScore}|${detectObjects}`,
    [detectIntervalMs, minScore, detectObjects]
  );

  useEffect(() => {
    if (!enabled) {
      setBurstReady(false);
      return;
    }
    let cancelled = false;
    const cocoDoneRef = { current: false };
    const faceDoneRef = { current: false };

    const trySetBurstReady = () => {
      if (cancelled) return;
      const modelsOk = detectObjects ? cocoDoneRef.current && faceDoneRef.current : faceDoneRef.current;
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
        modelRef.current = null;
        cocoDoneRef.current = true;
        trySetBurstReady();
        toast.warning('Không thể tải nhận diện vật thể', { description: `${msg} Kiểm tra khuôn mặt vẫn hoạt động.` });
      }
    };

    const loadFaceDetector = async () => {
      try {
        const detector = await loadMediaPipeFaceDetector();
        if (cancelled) return;
        mediaPipeFaceRef.current = detector;
        blazeFaceRef.current = null;
        faceDoneRef.current = true;
        trySetBurstReady();
      } catch {
        try {
          const fallback = await loadBlazeFaceModel();
          if (cancelled) return;
          mediaPipeFaceRef.current = null;
          blazeFaceRef.current = fallback;
          faceDoneRef.current = true;
          trySetBurstReady();
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Không tải được bộ nhận diện khuôn mặt.';
          toast.error('Không thể tải kiểm tra khuôn mặt', { description: msg });
        }
      }
    };

    setBurstReady(false);
    signalStatesRef.current = {
      ai_no_face: createDetectionWindowState(),
      ai_multiple_face: createDetectionWindowState(),
      ai_cell_phone: createDetectionWindowState(),
      ai_prohibited_object: createDetectionWindowState(),
    };
    cocoDoneRef.current = false;
    faceDoneRef.current = false;
    startCamera();
    if (detectObjects) {
      loadModel();
      loadFaceDetector();
    } else {
      modelRef.current = null;
      loadFaceDetector();
    }

    return () => {
      cancelled = true;
    };
  }, [enabled, evidenceRef, detectObjects]);

  useEffect(() => {
    if (!enabled || !burstReady) return;
    let cancelled = false;

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
          let phoneScore = 0;
          let phoneBboxRatio = 0;
          let prohibitedScore = 0;
          let prohibitedBboxRatio = 0;
          const frameArea = video.videoWidth * video.videoHeight;
          for (const p of preds) {
            const score = p.score ?? 0;
            const bboxArea = Math.max(0, p.bbox[2]) * Math.max(0, p.bbox[3]);
            const bboxRatio = frameArea > 0 ? bboxArea / frameArea : 0;
            if (p.class === 'cell phone') {
              if (score >= Math.max(minScore, 0.75) && bboxRatio >= 0.003 && score > phoneScore) {
                phoneScore = score;
                phoneBboxRatio = bboxRatio;
              }
            } else if (p.class === 'book' || p.class === 'knife' || p.class === 'scissors') {
              if (score >= Math.max(minScore, 0.7) && bboxRatio >= 0.01 && score > prohibitedScore) {
                prohibitedScore = score;
                prohibitedBboxRatio = bboxRatio;
              }
            }
          }
          await updateSignal('ai_cell_phone', phoneScore > 0, {
            confidence: phoneScore || undefined,
            bboxRatio: phoneBboxRatio || undefined,
          });
          await updateSignal('ai_prohibited_object', prohibitedScore > 0, {
            confidence: prohibitedScore || undefined,
            bboxRatio: prohibitedBboxRatio || undefined,
          });
        }

        let faceCount: number | null = null;
        if (mediaPipeFaceRef.current) {
          try {
            faceCount = detectFacesWithMediaPipe(mediaPipeFaceRef.current, video);
          } catch {
            faceCount = null;
          }
        } else if (blazeFaceRef.current) {
          try {
            // Cùng flip với bước chụp mặt đầu bài (selfie).
            const { count } = await detectFacesInVideo(video, false);
            faceCount = count;
          } catch {
            faceCount = null;
          }
        }
        if (faceCount !== null) {
          await updateSignal('ai_no_face', faceCount === 0);
          await updateSignal('ai_multiple_face', faceCount > 1);
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
          await updateSignal('ai_no_face', !hasPerson);
          await updateSignal('ai_multiple_face', personCount > 1);
        }
      } catch {
        /* một frame lỗi — bỏ qua */
      }
    };

    const updateSignal = async (
      kind: AiViolationKind,
      detected: boolean,
      details?: Pick<AiDetectionDetails, 'confidence' | 'bboxRatio'>,
    ) => {
      const rule = AI_DETECTION_RULES[kind];
      const result = advanceDetectionWindow(signalStatesRef.current[kind], detected, rule);
      signalStatesRef.current[kind] = result.state;
      if (!result.confirmed) return;
      await maybeHit(kind, {
        ...details,
        observedScans: result.state.samples.length || rule.windowScans,
        requiredHits: rule.requiredHits,
        windowScans: rule.windowScans,
        durationMs: rule.windowScans * detectIntervalMs,
      });
    };

    const maybeHit = async (kind: AiViolationKind, detection: AiDetectionDetails) => {
      if (cancelled) return;
      const last = lastHitRef.current[kind] ?? 0;
      // Face violations: cooldown 5s (phát hiện nhanh hơn); object violations: 10s (nặng hơn, tránh false positive)
      const cooldownMs = (kind === 'ai_no_face' || kind === 'ai_multiple_face') ? 5_000 : 10_000;
      if (now() - last < cooldownMs) return;
      lastHitRef.current[kind] = now();
      if (notify) {
        toast.warning('Phát hiện vi phạm', {
          description:
            kind === 'ai_cell_phone'
              ? 'Điện thoại'
              : kind === 'ai_prohibited_object'
                ? 'Sách hoặc vật cấm'
                : kind === 'ai_multiple_face'
                  ? 'Nhiều người'
                  : 'Không thấy khuôn mặt',
        });
      }
      onViolation?.(kind, undefined, detection);
      const res = await evidenceRef.current?.captureSequenceAndUpload(kind, { toastOnceKey: `evidence_${kind}` });
      if (cancelled) return;
      onViolation?.(
        kind,
        res?.ok
          ? { ok: true, path: res.path, publicUrl: res.publicUrl, evidence: res.evidence }
          : { ok: false },
        detection,
      );
    };

    let detectionInFlight = false;
    const runDetection = async () => {
      if (detectionInFlight) return;
      detectionInFlight = true;
      try {
        await detectOnce();
      } finally {
        detectionInFlight = false;
      }
    };

    void runDetection();
    timersRef.current.tick = window.setInterval(() => {
      void runDetection();
    }, detectIntervalMs);

    return () => {
      cancelled = true;
      stopTimersAndOwnStream();
    };
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

