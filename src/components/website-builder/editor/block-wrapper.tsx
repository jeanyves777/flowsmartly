"use client";

import { useWebsiteEditorStore } from "@/stores/website-editor-store";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { WebsiteBlock } from "@/types/website-builder";
import {
  GripVertical,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";

interface BlockWrapperProps {
  block: WebsiteBlock;
  children: React.ReactNode;
}

export function BlockWrapper({ block, children }: BlockWrapperProps) {
  const {
    selectedBlockId,
    hoveredBlockId,
    selectBlock,
    hoverBlock,
    deleteBlock,
    duplicateBlock,
    moveBlock,
    updateBlock,
  } = useWebsiteEditorStore();

  const isSelected = selectedBlockId === block.id;
  const isHovered = hoveredBlockId === block.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const blockLabel = block.type.charAt(0).toUpperCase() + block.type.slice(1).replace(/-/g, " ");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${
        isSelected
          ? "ring-2 ring-primary ring-offset-1"
          : isHovered
            ? "ring-1 ring-primary/40"
            : ""
      } ${!block.visibility.enabled ? "opacity-50" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        selectBlock(block.id);
      }}
      onMouseEnter={() => hoverBlock(block.id)}
      onMouseLeave={() => hoverBlock(null)}
    >
      {/* Block Label */}
      {(isSelected || isHovered) && (
        <div className="absolute -top-6 left-2 z-20 flex items-center gap-1">
          <span className="text-[10px] font-medium bg-primary text-primary-foreground px-1.5 py-0.5 rounded-t-md">
            {blockLabel}
          </span>
        </div>
      )}

      {/* Drag Handle + Toolbar */}
      {(isSelected || isHovered) && (
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-0.5 bg-background border border-border rounded-md shadow-sm p-0.5">
          <button {...attributes} {...listeners} className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing" title="Drag to reorder">
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "up"); }} className="p-1 text-muted-foreground hover:text-foreground" title="Move up">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "down"); }} className="p-1 text-muted-foreground hover:text-foreground" title="Move down">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top-right Toolbar */}
      {isSelected && (
        <div className="absolute -top-6 right-2 z-20 flex items-center gap-0.5 bg-background border border-border rounded-t-md shadow-sm px-1">
          <button
            onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { visibility: { ...block.visibility, enabled: !block.visibility.enabled } }); }}
            className="p-1 text-muted-foreground hover:text-foreground" title={block.visibility.enabled ? "Hide" : "Show"}
          >
            {block.visibility.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }} className="p-1 text-muted-foreground hover:text-foreground" title="Duplicate">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }} className="p-1 text-muted-foreground hover:text-red-500" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Block Content */}
      {children}
    </div>
  );
}
