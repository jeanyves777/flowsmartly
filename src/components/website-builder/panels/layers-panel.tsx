"use client";

import { useWebsiteEditorStore } from "@/stores/website-editor-store";
import { GripVertical, Eye, EyeOff } from "lucide-react";

export function LayersPanel() {
  const { blocks, selectedBlockId, selectBlock, updateBlock, moveBlock } = useWebsiteEditorStore();

  return (
    <div className="p-3">
      <h3 className="text-sm font-semibold mb-3 px-1">Layers</h3>
      <div className="space-y-0.5">
        {blocks.map((block, i) => {
          const label = block.type.charAt(0).toUpperCase() + block.type.slice(1).replace(/-/g, " ");
          const isSelected = selectedBlockId === block.id;
          return (
            <div
              key={block.id}
              onClick={() => selectBlock(block.id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab" />
              <span className="flex-1 truncate">{label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateBlock(block.id, { visibility: { ...block.visibility, enabled: !block.visibility.enabled } });
                }}
                className="p-0.5 text-muted-foreground hover:text-foreground"
              >
                {block.visibility.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
            </div>
          );
        })}
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No blocks yet</p>
        )}
      </div>
    </div>
  );
}
