/**
 * Camera trực tiếp với khung hướng dẫn để chụp CCCD mặt trước.
 * Port và đơn giản hoá từ LiveCameraModal (Chatbot HPTTS).
 * Chỉ hỗ trợ preset ID_CARD (tỉ lệ 85.6:54 — đúng chuẩn thẻ căn cước).
 * Ảnh được cắt chính xác theo vùng overlay trước khi trả về.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface CccdCameraCaptureProps {
  isOpen: boolean;
  onCancel: () => void;
  /** File ảnh đã crop + encode webp, sẵn sàng upload. */
  onCapture: (file: File) => void;
}

type FacingMode = 'user' | 'environment';

/** Tỉ lệ thẻ CCCD theo tiêu chuẩn ISO/IEC 7810 (85.6mm x 54mm). */
const ID_CARD_ASPECT = 85.6 / 54;

function safeRound(n: number): number {
  return Math.max(0, Math.round(n));
}

async function canvasToWebpBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  const q = Math.max(0.1, Math.min(0.95, quality));
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Không thể xuất ảnh từ camera'));
        resolve(blob);
      },
      'image/webp',
      q,
    );
  });
}

const CccdCameraCapture: React.FC<CccdCameraCaptureProps> = ({ isOpen, onCancel, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) throw new Error('Video element không khởi tạo được');
      v.srcObject = stream;
      await v.play();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Không thể truy cập camera. Kiểm tra quyền Camera và thử lại.';
      setError(msg);
      stopStream();
    } finally {
      setIsStarting(false);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (!isOpen) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Trình duyệt không hỗ trợ camera. Vui lòng dùng HTTPS hoặc trình duyệt khác.');
      return;
    }
    startStream();
    return () => stopStream();
  }, [isOpen, startStream, stopStream]);

  /**
   * Tính toán vùng overlay (px trong container) rồi ánh xạ ngược về pixel video thật.
   * Video dùng object-fit: cover nên cần tính offset để crop đúng vùng hiển thị.
   */
  const handleCapture = useCallback(async () => {
    const v = videoRef.current;
    const container = containerRef.current;
    if (!v || !container || isCapturing) return;

    const videoW = v.videoWidth;
    const videoH = v.videoHeight;
    if (!videoW || !videoH) {
      setError('Camera chưa sẵn sàng. Vui lòng chờ 1–2 giây rồi thử lại.');
      return;
    }

    setIsCapturing(true);
    setError(null);

    try {
      const cRect = container.getBoundingClientRect();
      const containerW = cRect.width;
      const containerH = cRect.height;

      // Kích thước overlay (82% container, giữ nguyên tỉ lệ ID_CARD)
      let overlayW = containerW * 0.82;
      let overlayH = overlayW / ID_CARD_ASPECT;
      if (overlayH > containerH * 0.82) {
        overlayH = containerH * 0.82;
        overlayW = overlayH * ID_CARD_ASPECT;
      }
      const overlayX = (containerW - overlayW) / 2;
      const overlayY = (containerH - overlayH) / 2;

      // object-fit: cover → tính scale và offset
      const scale = Math.max(containerW / videoW, containerH / videoH);
      const displayW = videoW * scale;
      const displayH = videoH * scale;
      const offsetX = (displayW - containerW) / 2;
      const offsetY = (displayH - containerH) / 2;

      const sx = safeRound((overlayX + offsetX) / scale);
      const sy = safeRound((overlayY + offsetY) / scale);
      const sw = safeRound(overlayW / scale);
      const sh = safeRound(overlayH / scale);

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, sw);
      canvas.height = Math.max(1, sh);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Trình duyệt không hỗ trợ Canvas 2D');

      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToWebpBlob(canvas, 0.92);
      const file = new File([blob], `cccd_${Date.now()}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
      });
      stopStream();
      onCapture(file);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Chụp ảnh thất bại. Vui lòng thử lại.');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, onCapture, stopStream]);

  const handleToggleCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="font-semibold text-gray-900">📷 Chụp CCCD mặt trước</div>
          <button
            onClick={() => { stopStream(); onCancel(); }}
            className="rounded-md px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Đóng
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Khung camera */}
          <div
            ref={containerRef}
            className="relative h-[380px] w-full overflow-hidden rounded-xl bg-black"
          >
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              playsInline
              muted
            />

            {/* Overlay khung hướng dẫn — bóng đen xung quanh, viền trắng chính xác */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="rounded-lg border-2 border-white shadow-[0_0_0_2000px_rgba(0,0,0,0.5)]"
                style={{
                  width: '82%',
                  aspectRatio: `${ID_CARD_ASPECT}`,
                  maxHeight: '82%',
                }}
              />
            </div>

            {/* Góc bo trang trí */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                style={{
                  width: '82%',
                  aspectRatio: `${ID_CARD_ASPECT}`,
                  maxHeight: '82%',
                  position: 'relative',
                }}
              >
                {/* 4 góc L-shape */}
                {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
                  <div
                    key={pos}
                    className="absolute"
                    style={{
                      width: 20,
                      height: 20,
                      top: pos.startsWith('t') ? -1 : 'auto',
                      bottom: pos.startsWith('b') ? -1 : 'auto',
                      left: pos.endsWith('l') ? -1 : 'auto',
                      right: pos.endsWith('r') ? -1 : 'auto',
                      borderTop: pos.startsWith('t') ? '3px solid #60a5fa' : 'none',
                      borderBottom: pos.startsWith('b') ? '3px solid #60a5fa' : 'none',
                      borderLeft: pos.endsWith('l') ? '3px solid #60a5fa' : 'none',
                      borderRight: pos.endsWith('r') ? '3px solid #60a5fa' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Hướng dẫn dưới khung */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              Canh thẻ CCCD đúng vào trong khung, đủ sáng
            </div>

            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="text-white text-sm">Đang mở camera...</span>
              </div>
            )}
          </div>

          {/* Các nút điều khiển */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              onClick={handleToggleCamera}
              disabled={isStarting}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Đổi camera trước/sau"
            >
              🔄 Đổi camera
            </button>

            <button
              onClick={startStream}
              disabled={isStarting}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {isStarting ? 'Đang mở…' : 'Mở lại'}
            </button>

            <button
              onClick={handleCapture}
              disabled={isStarting || isCapturing || Boolean(error)}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
            >
              {isCapturing ? 'Đang chụp...' : '📸 Chụp'}
            </button>
          </div>

          <p className="mt-2 text-center text-xs text-gray-500">
            Ảnh sẽ được cắt đúng vùng trong khung và nén trước khi gửi OCR.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CccdCameraCapture;
