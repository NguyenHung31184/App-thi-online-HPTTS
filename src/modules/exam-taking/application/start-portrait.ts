/**
 * The face check before the exam starts. BlazeFace runs on WebGL, which fails on some phones and in-app browsers;
 * when it does, MediaPipe (WebAssembly) and then BlazeFace on the CPU are tried, so the check is not lost with it.
 * The first detector that works is kept for the next press of the button.
 */
import type { FaceDetector } from '@mediapipe/tasks-vision';
import {
  buildStartPortrait, detectFacesInVideo, loadBlazeFaceModel, pickLargestFace, resetBlazeFaceModelCache,
  type FaceBoxPx, type PortraitOptions,
} from './blaze-face-proctor';
import { detectFaceBoxesWithMediaPipe, loadMediaPipeFaceDetector, releaseMediaPipeFaceDetector } from './mediapipe-face-proctor';

interface StartFaceDetector {
  name: string;
  boxes: (video: HTMLVideoElement) => Promise<FaceBoxPx[]>;
  close: () => void;
}

export type StartPortraitCheck =
  | { ok: true; blob: Blob; detector: string }
  | { ok: false; reason: 'no_face' | 'multiple_faces' | 'not_ready'; detector: string }
  | { ok: false; reason: 'model_error'; detail: string };

async function blazeFaceDetector(name: string): Promise<StartFaceDetector> {
  await loadBlazeFaceModel();
  return { name, boxes: async (video) => (await detectFacesInVideo(video, false)).boxes, close: () => {} };
}

async function mediaPipeDetector(): Promise<StartFaceDetector> {
  const detector: FaceDetector = await loadMediaPipeFaceDetector();
  return {
    name: 'mediapipe',
    boxes: async (video) => detectFaceBoxesWithMediaPipe(detector, video),
    close: () => releaseMediaPipeFaceDetector(detector),
  };
}

/** TensorFlow.js without WebGL: slower, but it runs where the graphics context cannot be created. */
async function blazeFaceOnCpu(): Promise<StartFaceDetector> {
  const tf = await import('@tensorflow/tfjs');
  await tf.setBackend('cpu');
  await tf.ready();
  resetBlazeFaceModelCache();
  return blazeFaceDetector('blazeface-cpu');
}

const DETECTORS: (() => Promise<StartFaceDetector>)[] = [() => blazeFaceDetector('blazeface'), mediaPipeDetector, blazeFaceOnCpu];

let working: StartFaceDetector | null = null;
let workingIndex = 0;

function message(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** Exactly one face, then the 3:4 portrait cropped on it. */
export async function checkStartPortrait(video: HTMLVideoElement, opts: PortraitOptions): Promise<StartPortraitCheck> {
  if (!video.videoWidth || !video.videoHeight) return { ok: false, reason: 'not_ready', detector: working?.name ?? '' };
  const errors: string[] = [];
  for (let index = workingIndex; index < DETECTORS.length; index += 1) {
    try {
      if (!working || workingIndex !== index) {
        working?.close();
        working = null;
        working = await DETECTORS[index]();
        workingIndex = index;
      }
      const boxes = await working.boxes(video);
      if (boxes.length === 0) return { ok: false, reason: 'no_face', detector: working.name };
      if (boxes.length > 1) return { ok: false, reason: 'multiple_faces', detector: working.name };
      const blob = await buildStartPortrait(video, pickLargestFace(boxes), opts);
      return { ok: true, blob, detector: working.name };
    } catch (error) {
      errors.push(`${working?.name ?? `detector ${index + 1}`}: ${message(error)}`);
      working?.close();
      working = null;
      workingIndex = index + 1;
    }
  }
  // Every detector failed: start again from the first on the next press, the failure may have been passing.
  workingIndex = 0;
  return { ok: false, reason: 'model_error', detail: errors.join(' | ').slice(0, 900) };
}

/** The portrait without the face check, cropped on the middle of the frame, for a phone where no detector runs. */
export function buildUncheckedStartPortrait(video: HTMLVideoElement, opts: PortraitOptions): Promise<Blob> {
  return buildStartPortrait(video, null, opts);
}

/** Frees the detector once the photo is taken; live proctoring loads its own. */
export function releaseStartPortraitDetector(): void {
  working?.close();
  working = null;
  workingIndex = 0;
}
