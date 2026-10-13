export interface FaceScanner {
  readonly mode: 'worker' | 'mediapipe' | 'blazeface';
  detect: (video: HTMLVideoElement) => Promise<number>;
  close: () => void;
}

export type FaceWorkerRequest =
  | { kind: 'init'; libraryUrl: string; wasmBase: string; modelUrl: string }
  | { kind: 'detect'; id: number; bitmap: ImageBitmap; timestamp: number };

export type FaceWorkerResponse =
  | { kind: 'ready' }
  | { kind: 'result'; id: number; count: number }
  | { kind: 'error'; id?: number; message: string };
