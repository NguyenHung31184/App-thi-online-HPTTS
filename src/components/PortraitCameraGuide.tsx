import { useId } from 'react';

/**
 * Lớp phủ hướng dẫn chụp chân dung: vùng tối + viền trắng đầu–vai (tương tự eKYC).
 * viewBox 16:9 để khớp khung video aspect-video.
 */
const VB_W = 160;
const VB_H = 90;

export function PortraitCameraGuide() {
  const rid = useId().replace(/:/g, '');
  const maskId = `portrait-guide-mask-${rid}`;
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <mask id={maskId}>
            <rect width={VB_W} height={VB_H} fill="white" />
            {/* Lỗ trong mặt + vai — thấy video rõ */}
            <ellipse cx="80" cy="36" rx="22" ry="27" fill="black" />
            <path d="M 38 58 Q 80 46 122 58 L 134 90 L 26 90 Z" fill="black" />
          </mask>
        </defs>
        <rect
          width={VB_W}
          height={VB_H}
          fill="rgba(0,0,0,0.48)"
          mask={`url(#${maskId})`}
        />
        <ellipse
          cx="80"
          cy="36"
          rx="22"
          ry="27"
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="1.1"
          vectorEffect="nonScalingStroke"
        />
        <path
          d="M 38 58 Q 80 46 122 58"
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="1.1"
          strokeLinecap="round"
          vectorEffect="nonScalingStroke"
        />
        <path
          d="M 38 58 L 26 90 M 122 58 L 134 90"
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="1.1"
          strokeLinecap="round"
          vectorEffect="nonScalingStroke"
        />
      </svg>
      <p className="pointer-events-none absolute bottom-3 left-1/2 z-[1] max-w-[92%] -translate-x-1/2 text-center text-[11px] leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] sm:bottom-4 sm:text-xs">
        Hãy đối diện với máy ảnh để <strong>cả hai tai lộ rõ</strong>. Căn mặt và vai trong khung trắng; chỉ một người trong hình.
      </p>
    </div>
  );
}
