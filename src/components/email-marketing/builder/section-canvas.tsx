"use client";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SectionBlock } from "./section-block";
import type { EmailSection } from "@/lib/marketing/email-renderer";

interface SectionCanvasProps {
  sections: EmailSection[];
  onReorder: (activeId: string, overId: string) => void;
  onUpdate: (id: string, updates: Partial<EmailSection>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function SectionCanvas({ sections, onReorder, onUpdate, onDelete, onDuplicate }: SectionCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id as string, over.id as string);
    }
  }

  if (sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
        <div>
          <p className="text-muted-foreground text-sm">No sections yet</p>
          <p className="text-muted-foreground text-xs mt-1">Use the toolbar above to add email content blocks</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 flex-1">
          {sections.map((section, idx) => (
            <SectionBlock
              key={section.id}
              section={section}
              onUpdate={(updates) => onUpdate(section.id, updates)}
              onDelete={() => onDelete(section.id)}
              onDuplicate={() => onDuplicate(section.id)}
              onMoveUp={() => idx > 0 && onReorder(section.id, sections[idx - 1].id)}
              onMoveDown={() => idx < sections.length - 1 && onReorder(section.id, sections[idx + 1].id)}
              isFirst={idx === 0}
              isLast={idx === sections.length - 1}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
