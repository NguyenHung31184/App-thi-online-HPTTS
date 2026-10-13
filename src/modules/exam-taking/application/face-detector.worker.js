// MediaPipe 1.0.1 loads its WASM glue through importScripts, which needs a classic worker.
let detector = null;

self.onmessage = (event) => {
  const request = event.data;
  if (request.kind === 'init') {
    void (async () => {
      try {
        importScripts(request.libraryUrl);
        const vision = await self.Vision.FilesetResolver.forVisionTasks(request.wasmBase);
        detector = await self.Vision.FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: request.modelUrl },
          canvas: new OffscreenCanvas(1, 1),
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.65,
          minSuppressionThreshold: 0.3,
        });
        self.postMessage({ kind: 'ready' });
      } catch (error) {
        self.postMessage({ kind: 'error', message: error instanceof Error ? error.message : 'Face worker failed to start' });
      }
    })();
    return;
  }
  try {
    if (!detector) throw new Error('Face worker is not ready');
    const count = detector.detectForVideo(request.bitmap, request.timestamp).detections.length;
    self.postMessage({ kind: 'result', id: request.id, count });
  } catch (error) {
    self.postMessage({ kind: 'error', id: request.id, message: error instanceof Error ? error.message : 'Face inference failed' });
  } finally {
    request.bitmap.close();
  }
};
