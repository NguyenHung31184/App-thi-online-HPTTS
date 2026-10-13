import type { AiDetectionDetails } from '../../domain/proctoring-evidence';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { FaceScanner } from '../../domain/face-scanner';
import {
  AI_DETECTION_RULES,
  CAMERA_COVERED_RULE,
  FACE_SCAN_INTERVAL_MS,
  advanceDetectionWindow,
  createDetectionWindowState,
  frameLooksCovered,
  type AiViolationKind,
  type DetectionWindowState,
} from '../../domain/proctoring-policy';
import {
  createFaceScanner, forgetObjectDetector, loadObjectDetector, logAuditEvent, proctoringWasPreloaded,
  type ObjectDetector,
} from '../../queries/session-actions';
import type { ProctoringEvidenceCaptureRef } from '../../domain/proctoring-evidence';

type CocoModel = ObjectDetector;

/** Scans measured before the timing line is written to the attempt log. */
const TIMED_SCANS = 15;

function summary(values: number[]) {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return { first: Math.round(values[0]), avg: Math.round(total / values.length), max: Math.round(Math.max(...values)) };
}

export interface AiObjectProctorBurstProps {
  enabled: boolean;
  /** Attempt that receives one `proctoring_timing` log line, used to judge how the device copes. */
  attemptId?: string;
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
  /** Chu kỳ quét vật thể (ms), mặc định 2,5s. Khuôn mặt quét theo FACE_SCAN_INTERVAL_MS. */
  detectIntervalMs?: number;
  /** Ngưỡng confidence để tính vi phạm */
  minScore?: number;
  /** Nếu true: sẽ hiển thị toast khi phát hiện */
  notify?: boolean;
}

function now() {
  return Date.now();
}

function pageIsHidden(): boolean { return document.visibilityState === 'hidden'; }

export function AiObjectProctorBurst(props: AiObjectProctorBurstProps) {
  const {
    enabled,
    attemptId,
    evidenceRef,
    onViolation,
    detectObjects = true,
    detectIntervalMs = 2_500,
    minScore = 0.6,
    notify = false,
  } = props;
  // burstEveryMs / burstDurationMs vẫn nằm trên interface (tương thích API cũ), không dùng trong quét liên tục.

  const modelRef = useRef<CocoModel | null>(null);
  const faceScannerRef = useRef<FaceScanner | null>(null);
  const detectionPromiseRef = useRef<Promise<void> | null>(null);
  const timersRef = useRef<{ tick?: number }>({});
  const lastHitRef = useRef<Record<string, number>>({});
  const signalStatesRef = useRef<Record<AiViolationKind, DetectionWindowState>>({
    ai_no_face: createDetectionWindowState(),
    ai_multiple_face: createDetectionWindowState(),
    ai_cell_phone: createDetectionWindowState(),
    ai_prohibited_object: createDetectionWindowState(),
  });
  const coveredStateRef = useRef<DetectionWindowState>(createDetectionWindowState());
  const lastObjectScanRef = useRef(0);
  const probeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const timingRef = useRef({ objectLoadMs: null as number | null, faceLoadMs: null as number | null, objectMs: [] as number[], faceMs: [] as number[], sent: false });
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
    const controller = new AbortController();
    let ownedModel: CocoModel | null = null;
    let ownedLoad: Promise<CocoModel> | null = null;
    const loadStartedAt = performance.now();
    let ownedScanner: FaceScanner | null = null;
    const cocoDoneRef = { current: false };
    const faceDoneRef = { current: false };

    const trySetBurstReady = () => {
      if (cancelled) return;
      const modelsOk = detectObjects ? cocoDoneRef.current && faceDoneRef.current : faceDoneRef.current;
      if (modelsOk) setBurstReady(true);
    };

    const loadModel = async () => {
      try {
        const loading = loadObjectDetector();
        const m = await loading;
        // Unmounted while loading: keep the model cached for the next mount.
        if (cancelled) return;
        ownedLoad = loading;
        ownedModel = m;
        timingRef.current.objectLoadMs = Math.round(performance.now() - loadStartedAt);
        modelRef.current = m;
        cocoDoneRef.current = true;
        trySetBurstReady();
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Không tải được model AI.';
        modelRef.current = null;
        cocoDoneRef.current = true;
        trySetBurstReady();
        toast.warning('Không thể tải nhận diện vật thể', { description: `${msg} Kiểm tra khuôn mặt vẫn hoạt động.` });
      }
    };

    const loadFaceDetector = async () => {
      try {
        const scanner = await createFaceScanner(controller.signal);
        if (cancelled) { scanner.close(); return; }
        ownedScanner = scanner;
        faceScannerRef.current = scanner;
        timingRef.current.faceLoadMs = Math.round(performance.now() - loadStartedAt);
        faceDoneRef.current = true;
        trySetBurstReady();
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Không tải được bộ nhận diện khuôn mặt.';
        toast.error('Không thể tải kiểm tra khuôn mặt', { description: msg });
      }
    };

    setBurstReady(false);
    signalStatesRef.current = {
      ai_no_face: createDetectionWindowState(),
      ai_multiple_face: createDetectionWindowState(),
      ai_cell_phone: createDetectionWindowState(),
      ai_prohibited_object: createDetectionWindowState(),
    };
    coveredStateRef.current = createDetectionWindowState();
    lastObjectScanRef.current = 0;
    cocoDoneRef.current = false;
    faceDoneRef.current = false;
    if (detectObjects) {
      loadModel();
      loadFaceDetector();
    } else {
      modelRef.current = null;
      loadFaceDetector();
    }

    return () => {
      cancelled = true;
      controller.abort();
      ownedScanner?.close();
      if (faceScannerRef.current === ownedScanner) faceScannerRef.current = null;
      if (modelRef.current === ownedModel) modelRef.current = null;
      const model = ownedModel;
      if (ownedLoad) forgetObjectDetector(ownedLoad);
      if (model) {
        // An asynchronous COCO scan may still be using its tensors.
        void (detectionPromiseRef.current ?? Promise.resolve()).finally(() => model.dispose());
      }
    };
  }, [enabled, evidenceRef, detectObjects]);

  useEffect(() => {
    if (!enabled || !burstReady) return;
    let cancelled = false;
    const fallbackController = new AbortController();
    let runtimeFallback: FaceScanner | null = null;
    let previousVideo: HTMLVideoElement | null = null;
    let previousVideoTime = -1;

    const clearTick = () => {
      const t = timersRef.current.tick;
      if (t) window.clearInterval(t);
      timersRef.current.tick = undefined;
    };

    const getActiveVideo = (): HTMLVideoElement | null => {
      const shared = evidenceRef.current?.getVideoElement?.();
      if (shared && shared.readyState >= 2 && shared.videoWidth > 0) return shared;
      return null;
    };

    const detectOnce = async () => {
      if (cancelled || pageIsHidden()) { resetWindows(); return; }
      const video = getActiveVideo();
      // HAVE_CURRENT_DATA (2) đủ cho nhiều trình duyệt với MediaStream; trước đây yêu cầu === 4 khiến không bao giờ quét.
      if (!video || video.paused || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        resetWindows();
        return;
      }
      if (previousVideo === video && previousVideoTime === video.currentTime) {
        resetWindows();
        return;
      }
      previousVideo = video;
      previousVideoTime = video.currentTime;
      const source = video.srcObject;

      try {
        let preds: Awaited<ReturnType<CocoModel['detect']>> | null = null;
        const model = modelRef.current;
        const objectScanDue = now() - lastObjectScanRef.current >= detectIntervalMs;
        if (detectObjects && model && objectScanDue) {
          lastObjectScanRef.current = now();
          const objectStartedAt = performance.now();
          preds = await model.detect(video);
          if (timingRef.current.objectMs.length < TIMED_SCANS) timingRef.current.objectMs.push(performance.now() - objectStartedAt);
          if (cancelled || pageIsHidden() || getActiveVideo() !== video || video.srcObject !== source) return;
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
          await updateSignal('ai_cell_phone', phoneScore > 0, detectIntervalMs, {
            confidence: phoneScore || undefined,
            bboxRatio: phoneBboxRatio || undefined,
          });
          await updateSignal('ai_prohibited_object', prohibitedScore > 0, detectIntervalMs, {
            confidence: prohibitedScore || undefined,
            bboxRatio: prohibitedBboxRatio || undefined,
          });
        }

        const covered = advanceDetectionWindow(coveredStateRef.current, isCovered(video), CAMERA_COVERED_RULE);
        coveredStateRef.current = covered.state;
        if (covered.confirmed) {
          await maybeHit('ai_no_face', {
            cameraCovered: true,
            observedScans: CAMERA_COVERED_RULE.windowScans,
            requiredHits: CAMERA_COVERED_RULE.requiredHits,
            windowScans: CAMERA_COVERED_RULE.windowScans,
            durationMs: CAMERA_COVERED_RULE.windowScans * FACE_SCAN_INTERVAL_MS,
          });
        }

        let faceCount: number | null = null;
        const scanner = faceScannerRef.current;
        if (scanner) {
          try {
            const faceStartedAt = performance.now();
            faceCount = await scanner.detect(video);
            if (timingRef.current.faceMs.length < TIMED_SCANS) timingRef.current.faceMs.push(performance.now() - faceStartedAt);
            reportTiming(scanner.mode);
          } catch {
            if (cancelled) return;
            if (scanner.mode === 'worker') {
              scanner.close();
              faceScannerRef.current = null;
              const fallback = await createFaceScanner(fallbackController.signal, false);
              if (cancelled) { fallback.close(); return; }
              runtimeFallback = fallback;
              faceScannerRef.current = fallback;
              return;
            }
          }
        }
        if (cancelled || pageIsHidden() || getActiveVideo() !== video || video.srcObject !== source) return;
        if (faceCount !== null) {
          await updateSignal('ai_no_face', faceCount === 0, FACE_SCAN_INTERVAL_MS);
          await updateSignal('ai_multiple_face', faceCount > 1, FACE_SCAN_INTERVAL_MS);
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
          await updateSignal('ai_no_face', !hasPerson, detectIntervalMs);
          await updateSignal('ai_multiple_face', personCount > 1, detectIntervalMs);
        }
      } catch {
        /* một frame lỗi — bỏ qua */
      }
    };

    const reportTiming = (faceMode: string) => {
      const timing = timingRef.current;
      if (timing.sent || !attemptId || timing.faceMs.length < TIMED_SCANS) return;
      timing.sent = true;
      void logAuditEvent(attemptId, 'proctoring_timing', {
        preloaded: proctoringWasPreloaded(),
        object_load_ms: timing.objectLoadMs,
        face_load_ms: timing.faceLoadMs,
        face_mode: faceMode,
        object_scan_ms: summary(timing.objectMs),
        face_scan_ms: summary(timing.faceMs),
      }).catch(() => undefined);
    };

    const resetWindows = () => {
      for (const kind of Object.keys(signalStatesRef.current) as AiViolationKind[]) {
        const state = signalStatesRef.current[kind];
        // Missing frames neither confirm an incident nor count as clean recovery scans.
        signalStatesRef.current[kind] = { ...state, samples: [], recoveryCount: 0 };
      }
      coveredStateRef.current = { ...coveredStateRef.current, samples: [], recoveryCount: 0 };
    };

    const isCovered = (video: HTMLVideoElement): boolean => {
      try {
        const canvas = probeCanvasRef.current ?? (probeCanvasRef.current = document.createElement('canvas'));
        canvas.width = 32;
        canvas.height = 24;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return false;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return frameLooksCovered(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
      } catch {
        return false;
      }
    };

    const updateSignal = async (
      kind: AiViolationKind,
      detected: boolean,
      scanIntervalMs: number,
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
        durationMs: rule.windowScans * scanIntervalMs,
      });
    };

    const maybeHit = async (kind: AiViolationKind, detection: AiDetectionDetails) => {
      if (cancelled || document.visibilityState === 'hidden') return;
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

    const runDetection = async () => {
      if (detectionPromiseRef.current || cancelled) return;
      const pending = detectOnce();
      detectionPromiseRef.current = pending;
      try { await pending; }
      finally { if (detectionPromiseRef.current === pending) detectionPromiseRef.current = null; }
    };

    void runDetection();
    const visibilityChanged = () => {
      resetWindows();
      previousVideoTime = -1;
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    timersRef.current.tick = window.setInterval(() => {
      void runDetection();
    }, FACE_SCAN_INTERVAL_MS);

    return () => {
      cancelled = true;
      fallbackController.abort();
      document.removeEventListener('visibilitychange', visibilityChanged);
      runtimeFallback?.close();
      if (runtimeFallback && faceScannerRef.current === runtimeFallback) faceScannerRef.current = null;
      clearTick();
      previousVideo = null;
    };
  }, [
    enabled,
    attemptId,
    configKey,
    detectIntervalMs,
    detectObjects,
    evidenceRef,
    minScore,
    notify,
    burstReady,
    onViolation,
  ]);

  return null;
}

