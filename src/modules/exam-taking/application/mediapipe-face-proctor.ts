import type { FaceDetector } from '@mediapipe/tasks-vision';

export const MEDIAPIPE_WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
export const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

export function releaseMediaPipeFaceDetector(detector: FaceDetector): void {
  detector.close();
}

export async function loadMediaPipeFaceDetector(): Promise<FaceDetector> {
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
  return FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: FACE_MODEL_URL },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.65,
    minSuppressionThreshold: 0.3,
  });
}

export function detectFacesWithMediaPipe(detector: FaceDetector, video: HTMLVideoElement): number {
  return detector.detectForVideo(video, performance.now()).detections.length;
}
