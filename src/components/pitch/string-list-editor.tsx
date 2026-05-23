"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface StringListEditorProps {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

export function StringListEditor({ title, items, onChange, placeholder = "Add item" }: StringListEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...safeItems, ""])}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {safeItems.map((item, index) => (
          <div key={`${title}-${index}`} className="flex gap-2">
            <Textarea
              rows={2}
              value={item}
              onChange={(event) => onChange(safeItems.map((entry, entryIndex) => entryIndex === index ? event.target.value : entry))}
              placeholder={placeholder}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => onChange(safeItems.filter((_, entryIndex) => entryIndex !== index))}>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        {safeItems.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
      </div>
    </div>
  );
}
