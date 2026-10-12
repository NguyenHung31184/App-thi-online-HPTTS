import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  id: string;
  text: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled?: boolean;
}

function SortableItem({ id, text, index, total, onMoveUp, onMoveDown, disabled }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 border rounded bg-white border-slate-200 ${isDragging ? 'opacity-80 shadow-lg z-50' : ''}`}
    >
      {/* Grab handle — chỉ phần này kích hoạt drag */}
      <span
        className="text-slate-400 cursor-grab active:cursor-grabbing select-none px-1 touch-none"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </span>
      <span className="flex-1 text-sm">{text || '(Trống)'}</span>
      {/* Nút lên/xuống — thay thế cho drag trên mobile */}
      {!disabled && (
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 text-slate-500
                       hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
            aria-label="Chuyển lên"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 text-slate-500
                       hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
            aria-label="Chuyển xuống"
          >
            ▼
          </button>
        </div>
      )}
    </div>
  );
}

interface SortableOptionListProps {
  options: { id: string; text: string }[];
  value: string[];
  onChange: (orderedIds: string[]) => void;
  disabled?: boolean;
}

export function SortableOptionList({ options, value, onChange, disabled }: SortableOptionListProps) {
  const orderedIds = value.length > 0 ? value : options.map((o) => o.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Phải kéo ≥ 8px mới tính là drag — tránh drag nhầm khi scroll trên mobile
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(orderedIds, oldIndex, newIndex));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    onChange(arrayMove(orderedIds, index, index - 1));
  };

  const handleMoveDown = (index: number) => {
    if (index === orderedIds.length - 1) return;
    onChange(arrayMove(orderedIds, index, index + 1));
  };

  if (orderedIds.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy} disabled={disabled}>
        <div className="space-y-2">
          {orderedIds.map((optId, index) => {
            const opt = options.find((o) => o.id === optId);
            if (!opt) return null;
            return (
              <SortableItem
                key={opt.id}
                id={opt.id}
                text={opt.text}
                index={index}
                total={orderedIds.length}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                disabled={disabled}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
