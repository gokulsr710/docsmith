import type { ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableGridProps<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, dragging: boolean) => ReactNode;
  className?: string;
  layout?: 'grid' | 'list';
  /** Extra node rendered at the end (e.g. "add more" tile). Not sortable. */
  trailing?: ReactNode;
  itemLabel?: (item: T, index: number) => string;
}

/**
 * Drag-and-drop sortable collection. Mouse drags start after 6px of movement,
 * touch drags after a short press (so scrolling still works on phones), and
 * keyboard users can pick up an item with Space and move it with arrow keys.
 */
export function SortableGrid<T extends { id: string }>({ items, onReorder, renderItem, className, layout = 'grid', trailing, itemLabel }: SortableGridProps<T>) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: 'To reorder, press Space to pick up an item, use the arrow keys to move it, then press Space again to drop it.' },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableItem key={item.id} id={item.id} label={itemLabel?.(item, index)}>
              {(dragging) => renderItem(item, index, dragging)}
            </SortableItem>
          ))}
          {trailing}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, children, label }: { id: string; children: (dragging: boolean) => ReactNode; label?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, touchAction: 'manipulation' }}
      className={`relative outline-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      {...attributes}
      {...listeners}
      aria-label={label}
      aria-roledescription="sortable item"
    >
      {children(isDragging)}
    </div>
  );
}

/** Spread on interactive controls inside a sortable item so they don't start a drag. */
export const noDrag = {
  onMouseDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onTouchStart: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onKeyDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
};
