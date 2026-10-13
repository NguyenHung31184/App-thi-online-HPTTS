import type { FaceScanner } from '../domain/face-scanner';
import { detectFacesInVideo, loadBlazeFaceModel } from './blaze-face-proctor';
import { FACE_MODEL_URL, MEDIAPIPE_WASM_BASE, detectFacesWithMediaPipe, loadMediaPipeFaceDetector, releaseMediaPipeFaceDetector } from './mediapipe-face-proctor';
import { WorkerFaceScanner } from './worker-face-scanner';

export async function createFaceScanner(signal: AbortSignal, preferWorker = true): Promise<FaceScanner> {
  signal.throwIfAborted();
  if (preferWorker && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function') {
    let scanner: WorkerFaceScanner | null = null;
    const abort = () => scanner?.close();
    try {
      scanner = new WorkerFaceScanner(new Worker(new URL('./face-detector.worker.js', import.meta.url)));
      signal.addEventListener('abort', abort, { once: true });
      await scanner.initialize(20_000, {
        libraryUrl: new URL(`${import.meta.env.BASE_URL}vendor/mediapipe-1.0.1/vision_bundle.js`, window.location.href).href,
        wasmBase: MEDIAPIPE_WASM_BASE,
        modelUrl: FACE_MODEL_URL,
      });
      signal.throwIfAborted();
      return scanner;
    } catch (error) {
      scanner?.close();
      signal.throwIfAborted();
      if (import.meta.env.DEV) console.warn('Face Worker không khả dụng, dùng bộ nhận diện dự phòng:', error);
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }
  try {
    const detector = await loadMediaPipeFaceDetector();
    if (signal.aborted) { releaseMediaPipeFaceDetector(detector); signal.throwIfAborted(); }
    return {
      mode: 'mediapipe',
      detect: async (video) => detectFacesWithMediaPipe(detector, video),
      close: () => releaseMediaPipeFaceDetector(detector),
    };
  } catch {
    signal.throwIfAborted();
    await loadBlazeFaceModel();
    signal.throwIfAborted();
    return {
      mode: 'blazeface',
      detect: async (video) => (await detectFacesInVideo(video, false)).count,
      close: () => {},
    };
  }
}
