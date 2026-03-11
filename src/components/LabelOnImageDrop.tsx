/**
 * Câu hỏi "kéo nhãn vào đúng ô trên ảnh" (vd: ảnh xe nâng, 4 ô có mũi tên, học viên kéo Càng nâng, Cabin... vào đúng ô).
 * Dùng khi: drag_drop + có ảnh + đúng 4 mục. Thứ tự 4 mục = thứ tự ô (1=trái-trên, 2=phải-trên, 3=trái-dưới, 4=phải-dưới).
 */
import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const ZONE_IDS = ['zone-0', 'zone-1', 'zone-2', 'zone-3'];

/** Tọa độ mặc định 4 ô (x, y theo % 0–100). Có thể ghi đè bằng prop zones. */
const DEFAULT_ZONES: { x: number; y: number }[] = [
  { x: 10, y: 10 },
  { x: 70, y: 10 },
  { x: 10, y: 70 },
  { x: 70, y: 70 },
];

function DroppableZone({
  id,
  children,
  isOver,
  leftPct,
  topPct,
}: { id: string; children?: React.ReactNode; isOver: boolean; leftPct: number; topPct: number }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`absolute min-w-[80px] min-h-[36px] border-2 border-dashed rounded-lg flex items-center justify-center text-sm bg-white/90 ${
        isOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300'
      }`}
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      {children ?? <span className="text-slate-400">Thả vào đây</span>}
    </div>
  );
}

function DraggableLabel({ id, text }: { id: string; text: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data: { type: 'label' } });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`px-3 py-2 border rounded-lg bg-white border-slate-200 cursor-grab active:cursor-grabbing shadow-sm ${isDragging ? 'opacity-90 shadow-md z-10' : ''}`}
      {...listeners}
      {...attributes}
    >
      {text || '(Trống)'}
    </div>
  );
}

export interface LabelOnImageDropProps {
  imageUrl: string;
  options: { id: string; text: string }[];
  value: string[];
  onChange: (zoneLabelIds: string[]) => void;
  /** Tọa độ 4 ô (x, y theo % 0–100). Ô 1 = index 0, ô 2 = index 1, ... */
  zones?: { x: number; y: number }[];
  disabled?: boolean;
}

export function LabelOnImageDrop({ imageUrl, options, value, onChange, zones, disabled }: LabelOnImageDropProps) {
  const zoneValues = value.length === 4 ? value : ['', '', '', ''];
  const [overId, setOverId] = useState<string | null>(null);
  const positions = zones && zones.length === 4 ? zones : DEFAULT_ZONES;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setOverId(null);
    if (disabled || !over) return;
    const labelId = String(active.id);
    const overStr = String(over.id);
    let zoneIndex = ZONE_IDS.indexOf(overStr);
    if (zoneIndex === -1) {
      const inZone = zoneValues.findIndex((id) => id === overStr);
      if (inZone !== -1) zoneIndex = inZone;
      else return;
    }
    const next = [...zoneValues];
    const prevIndex = next.indexOf(labelId);
    if (prevIndex !== -1) next[prevIndex] = '';
    next[zoneIndex] = labelId;
    onChange(next);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverId(null);
      return;
    }
    const overStr = String(over.id);
    if (ZONE_IDS.includes(overStr)) setOverId(overStr);
    else {
      const idx = zoneValues.indexOf(overStr);
      setOverId(idx !== -1 ? ZONE_IDS[idx] : null);
    }
  };

  const usedIds = zoneValues.filter(Boolean);
  const unassigned = options.filter((o) => !usedIds.includes(o.id));

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="space-y-4">
        <div className="relative inline-block max-w-full">
          <img src={imageUrl} alt="" className="max-w-full rounded-lg border border-slate-200 block" />
          {ZONE_IDS.map((zid, idx) => (
            <DroppableZone
              key={zid}
              id={zid}
              isOver={overId === zid}
              leftPct={positions[idx]?.x ?? 10}
              topPct={positions[idx]?.y ?? 10}
            >
              {zoneValues[idx] ? (
                <DraggableLabel
                  id={zoneValues[idx]}
                  text={options.find((o) => o.id === zoneValues[idx])?.text ?? ''}
                />
              ) : null}
            </DroppableZone>
          ))}
        </div>
        <p className="text-slate-600 text-sm">Kéo các nhãn bên dưới vào đúng ô trên hình (4 ô tương ứng 4 vị trí). Có thể kéo lại để đổi chỗ.</p>
        <div className="flex flex-wrap gap-2">
          {unassigned.map((opt) => (
            <DraggableLabel key={opt.id} id={opt.id} text={opt.text} />
          ))}
        </div>
      </div>
    </DndContext>
  );
}
