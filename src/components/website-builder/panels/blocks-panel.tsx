"use client";

import { useState } from "react";
import { useWebsiteEditorStore } from "@/stores/website-editor-store";
import { BLOCK_CATEGORIES } from "@/lib/website/block-defaults";
import type { WebsiteBlockType } from "@/types/website-builder";
import * as LucideIcons from "lucide-react";
import { Search } from "lucide-react";

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

export function BlocksPanel() {
  const { addBlock, selectedBlockId } = useWebsiteEditorStore();
  const [search, setSearch] = useState("");

  const allBlocks = BLOCK_CATEGORIES.flatMap((cat) =>
    cat.blocks.map((b) => ({ ...b, category: cat.name }))
  );

  const filtered = search
    ? allBlocks.filter(
        (b) =>
          b.label.toLowerCase().includes(search.toLowerCase()) ||
          b.description.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="p-3">
      <h3 className="text-sm font-semibold mb-3 px-1">Add Blocks</h3>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search blocks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Filtered Results */}
      {filtered ? (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((block) => (
            <button
              key={block.type}
              onClick={() => addBlock(block.type, selectedBlockId || undefined)}
              className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-center"
            >
              <DynamicIcon name={block.icon} className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs font-medium">{block.label}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-2 text-sm text-muted-foreground text-center py-4">No blocks found</p>
          )}
        </div>
      ) : (
        /* Category View */
        <div className="space-y-4">
          {BLOCK_CATEGORIES.map((category) => (
            <div key={category.name}>
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <DynamicIcon name={category.icon} className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {category.blocks.map((block) => (
                  <button
                    key={block.type}
                    onClick={() => addBlock(block.type, selectedBlockId || undefined)}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-center group"
                    title={block.description}
                  >
                    <DynamicIcon name={block.icon} className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-[11px] font-medium leading-tight">{block.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
