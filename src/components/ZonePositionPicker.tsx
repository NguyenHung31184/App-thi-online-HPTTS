/**
 * Cho phép GV kéo 4 chấm trên ảnh để đặt vị trí ô thả nhãn; tọa độ % cập nhật theo vị trí kéo.
 * Dùng trong form soạn câu hỏi kéo nhãn lên ảnh (drag_drop + ảnh + 4 mục).
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export interface ZonePositionPickerProps {
  imageUrl: string;
  zonePositions: { x: number; y: number }[];
  setZonePositions: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>;
}

export function ZonePositionPicker({ imageUrl, zonePositions, setZonePositions }: ZonePositionPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const updatePosition = useCallback(
    (index: number, clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      setZonePositions((prev) => {
        const next = [...prev];
        if (!next[index]) next[index] = { x: 10, y: 10 };
        next[index] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
        return next;
      });
    },
    [setZonePositions]
  );

  useEffect(() => {
    if (draggingIndex === null) return;
    const onMove = (e: MouseEvent) => updatePosition(draggingIndex, e.clientX, e.clientY);
    const onUp = () => setDraggingIndex(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingIndex, updatePosition]);

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        <strong>Cách đặt vị trí:</strong> Kéo 4 chấm tròn vào đúng vị trí trên ảnh (đầu mũi tên hoặc ô cần điền). Số X, Y % bên dưới cập nhật tự động; có thể chỉnh tay nếu cần.
      </p>
      <div
        ref={containerRef}
        className="relative inline-block max-w-full border border-slate-200 rounded-lg overflow-hidden bg-slate-100"
      >
        <img src={imageUrl} alt="Ảnh để đặt vị trí ô" className="block max-w-full max-h-80 object-contain pointer-events-none" />
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            role="button"
            tabIndex={0}
            aria-label={`Kéo để đặt vị trí ô ${idx + 1}`}
            className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-indigo-500 bg-indigo-100 cursor-grab active:cursor-grabbing flex items-center justify-center text-xs font-bold text-indigo-700 shadow-md hover:bg-indigo-200"
            style={{
              left: `${zonePositions[idx]?.x ?? 10}%`,
              top: `${zonePositions[idx]?.y ?? 10}%`,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setDraggingIndex(idx);
            }}
          >
            {idx + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
