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
}

function SortableItem({ id, text }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 border rounded bg-white border-slate-200 ${isDragging ? 'opacity-80 shadow' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="text-slate-400 cursor-grab">⋮⋮</span>
      <span>{text || '(Trống)'}</span>
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
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    onChange(next);
  };

  if (orderedIds.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy} disabled={disabled}>
        <div className="space-y-2">
          {orderedIds.map((optId) => {
            const opt = options.find((o) => o.id === optId);
            if (!opt) return null;
            return <SortableItem key={opt.id} id={opt.id} text={opt.text} />;
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
