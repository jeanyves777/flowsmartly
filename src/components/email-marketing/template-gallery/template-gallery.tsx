"use client";

import { useState, useEffect } from "react";
import { Search, Sparkles, FileText, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { TemplateCard } from "./template-card";
import { TemplatePreviewModal } from "./template-preview-modal";
import type { EmailSection } from "@/lib/marketing/email-renderer";

export interface TemplateItem {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  subject?: string | null;
  preheader?: string | null;
  source: string;
  isDefault: boolean;
  usageCount: number;
  sections: string;
  thumbnailUrl?: string | null;
  createdAt: string;
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "custom", label: "My Templates" },
  { value: "promotional", label: "Promotional" },
  { value: "lifecycle", label: "Lifecycle" },
  { value: "content", label: "Content" },
  { value: "holiday", label: "Holiday" },
  { value: "birthday", label: "Birthday" },
  { value: "transactional", label: "Transactional" },
];

interface TemplateGalleryProps {
  onSelect: (template: TemplateItem) => void;
  onCreateBlank: () => void;
  onGenerateAI: () => void;
}

export function TemplateGallery({ onSelect, onCreateBlank, onGenerateAI }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, [category, search]);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (search) params.set("search", search);
      const res = await fetch(`/api/email-templates?${params}`);
      const data = await res.json();
      if (data.success) setTemplates(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (tpl) { setDeleteTarget(tpl); setDeleteError(null); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/email-templates/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        setDeleteError(data.error ?? "Failed to delete template");
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
      setDeleteError("Failed to delete template");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onCreateBlank}
          className="flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-lg hover:border-brand-500 hover:bg-brand-500/5 transition-colors"
        >
          <FileText className="w-6 h-6 text-muted-foreground" />
          <span className="text-sm font-medium">Start from Blank</span>
          <span className="text-[10px] text-muted-foreground">Build your email from scratch</span>
        </button>
        <button
          onClick={onGenerateAI}
          className="flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-lg hover:border-purple-500 hover:bg-purple-500/5 transition-colors"
        >
          <Sparkles className="w-6 h-6 text-purple-500" />
          <span className="text-sm font-medium">Create with AI</span>
          <span className="text-[10px] text-muted-foreground">Describe your email, AI builds it</span>
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={cn(
              "px-3 py-1 text-xs rounded-full font-medium transition-colors",
              category === cat.value
                ? "bg-brand-500 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">
            {search ? "No templates match your search" : "No templates yet"}
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Create a blank email or generate one with AI
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onSelect={() => onSelect(tpl)}
              onPreview={() => setPreviewTemplate(tpl)}
              onDelete={tpl.isDefault ? undefined : () => handleDeleteTemplate(tpl.id)}
            />
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUse={() => {
            onSelect(previewTemplate);
            setPreviewTemplate(null);
          }}
        />
      )}

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive" />
              Delete Template
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold">&quot;{deleteTarget?.name}&quot;</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
