"use client";

import { useWebsiteEditorStore } from "@/stores/website-editor-store";
import { BlockRenderer } from "../blocks/block-renderer";
import { BlockWrapper } from "./block-wrapper";
import { Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

export function EditorCanvas() {
  const { blocks, theme, devicePreview, selectedBlockId, selectBlock, reorderBlocks, addBlock, setLeftPanel } = useWebsiteEditorStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderBlocks(active.id as string, over.id as string);
    }
  };

  const deviceWidth = devicePreview === "mobile" ? 375 : devicePreview === "tablet" ? 768 : "100%";

  return (
    <div
      className="min-h-full flex justify-center p-4 sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) selectBlock(null);
      }}
    >
      <div
        className="bg-background shadow-lg rounded-lg overflow-hidden transition-all duration-300 w-full"
        style={{
          maxWidth: typeof deviceWidth === "number" ? deviceWidth : undefined,
          minHeight: "100%",
        }}
      >
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Start Building</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm">
              Add blocks from the left panel to start building your page, or use AI to generate content.
            </p>
            <button
              onClick={() => setLeftPanel("blocks")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-all"
            >
              Browse Blocks
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {blocks.map((block) => (
                <BlockWrapper key={block.id} block={block}>
                  <BlockRenderer
                    block={block}
                    theme={theme}
                    isEditing
                  />
                </BlockWrapper>
              ))}
            </SortableContext>
          </DndContext>
        )}

        {/* Add Block Button at Bottom */}
        {blocks.length > 0 && (
          <div className="p-4 flex justify-center">
            <button
              onClick={() => setLeftPanel("blocks")}
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Block
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
