import { FACE_MODEL_URL } from './mediapipe-face-proctor';

type CocoSsd = typeof import('@tensorflow-models/coco-ssd');
export type ObjectDetector = Awaited<ReturnType<CocoSsd['load']>>;

export const objectDetectionEnabled = (import.meta.env.VITE_AI_PROCTORING_ENABLED ?? '') === '1';

let pending: Promise<ObjectDetector> | null = null;
let preloadStarted = false;

/**
 * One model per page. `coco.load()` downloads the weights and runs a first inference on the main thread,
 * which is the slow part on phones, so the rules screen starts it before the exam clock does.
 */
export function loadObjectDetector(): Promise<ObjectDetector> {
  if (pending) return pending;
  const loading = (async () => {
    await import('@tensorflow/tfjs');
    const coco = await import('@tensorflow-models/coco-ssd');
    return coco.load();
  })();
  pending = loading;
  loading.catch(() => { if (pending === loading) pending = null; });
  return loading;
}

/** Drops the cached model so the next exam loads a fresh one; the caller disposes it once no scan uses it. */
export function forgetObjectDetector(loaded: Promise<ObjectDetector>): void {
  if (pending === loaded) pending = null;
}

/** Whether the rules screen already started the download in this page. */
export function proctoringWasPreloaded(): boolean { return preloadStarted; }

/** Starts the downloads the exam page needs. Failures are left for the exam page to report. */
export function preloadProctoring(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  if (objectDetectionEnabled) void loadObjectDetector().catch(() => undefined);
  // The face Worker fetches this file itself; asking for it here only fills the HTTP cache.
  void fetch(FACE_MODEL_URL).catch(() => undefined);
}
