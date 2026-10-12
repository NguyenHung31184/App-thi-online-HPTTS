import type { FaceDetector } from '@mediapipe/tasks-vision';

const MEDIAPIPE_WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let detectorPromise: Promise<FaceDetector> | null = null;

export async function loadMediaPipeFaceDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.65,
        minSuppressionThreshold: 0.3,
      });
    })().catch((error) => {
      detectorPromise = null;
      throw error;
    });
  }
  return detectorPromise;
}

export function detectFacesWithMediaPipe(detector: FaceDetector, video: HTMLVideoElement): number {
  return detector.detectForVideo(video, performance.now()).detections.length;
}
