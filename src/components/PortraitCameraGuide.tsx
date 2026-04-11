import { useId } from 'react';

/**
 * Lớp phủ hướng dẫn chụp chân dung: vùng tối + một khung oval (ellipse) — gọn, dễ căn mặt.
 * viewBox 16:9 để khớp khung video aspect-video.
 */
const VB_W = 160;
const VB_H = 90;

/** Trung tâm oval hơi thấp một chút để gồm cổ / vai trên trong cùng khung. */
const OVAL = { cx: 80, cy: 44, rx: 28, ry: 36 } as const;

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
            <ellipse
              cx={OVAL.cx}
              cy={OVAL.cy}
              rx={OVAL.rx}
              ry={OVAL.ry}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width={VB_W}
          height={VB_H}
          fill="rgba(0,0,0,0.48)"
          mask={`url(#${maskId})`}
        />
        <ellipse
          cx={OVAL.cx}
          cy={OVAL.cy}
          rx={OVAL.rx}
          ry={OVAL.ry}
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="1.2"
          vectorEffect="nonScalingStroke"
        />
      </svg>
      <p className="pointer-events-none absolute bottom-3 left-1/2 z-[1] max-w-[92%] -translate-x-1/2 text-center text-[11px] leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] sm:bottom-4 sm:text-xs">
        Hãy đối diện với máy ảnh để <strong>cả hai tai lộ rõ</strong>. Căn mặt vào <strong>giữa khung oval</strong>; chỉ một người trong hình.
      </p>
    </div>
  );
}
