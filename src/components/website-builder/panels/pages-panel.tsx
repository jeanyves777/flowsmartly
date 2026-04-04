"use client";

import { useState } from "react";
import { useWebsiteEditorStore } from "@/stores/website-editor-store";
import { Plus, FileText, Home, MoreVertical, Trash2, Edit3 } from "lucide-react";

export function PagesPanel() {
  const { websiteId, pages, currentPageId, switchPage, addPage, updatePage, deletePage, save, isDirty } = useWebsiteEditorStore();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleSwitchPage = async (pageId: string) => {
    if (pageId === currentPageId) return;
    if (isDirty) await save();
    try {
      const res = await fetch(`/api/websites/${websiteId}/pages/${pageId}`);
      const data = await res.json();
      const blocks = JSON.parse(data.blocks || "[]");
      switchPage(pageId, blocks);
    } catch {}
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const res = await fetch(`/api/websites/${websiteId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, slug, sortOrder: pages.length }),
      });
      const data = await res.json();
      addPage({ id: data.id, title: data.title, slug: data.slug, isHomePage: false, status: "DRAFT", sortOrder: data.sortOrder });
      setCreating(false);
      setNewTitle("");
    } catch {}
  };

  const handleRename = async (pageId: string) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    try {
      await fetch(`/api/websites/${websiteId}/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle }),
      });
      updatePage(pageId, { title: editTitle });
      setEditingId(null);
    } catch {}
  };

  const handleDelete = async (pageId: string) => {
    if (!confirm("Delete this page?")) return;
    try {
      await fetch(`/api/websites/${websiteId}/pages/${pageId}`, { method: "DELETE" });
      deletePage(pageId);
      if (currentPageId === pageId && pages.length > 1) {
        const remaining = pages.filter((p) => p.id !== pageId);
        if (remaining[0]) handleSwitchPage(remaining[0].id);
      }
    } catch {}
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold">Pages</h3>
        <button onClick={() => setCreating(true)} className="p-1 rounded-md hover:bg-muted transition-colors" title="Add page">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1">
        {pages
          .sort((a, b) => (a.isHomePage ? -1 : b.isHomePage ? 1 : a.sortOrder - b.sortOrder))
          .map((page) => (
            <div key={page.id} className="group">
              {editingId === page.id ? (
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRename(page.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(page.id); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 text-sm px-2 py-0.5 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ) : (
                <button
                  onClick={() => handleSwitchPage(page.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                    currentPageId === page.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                  }`}
                >
                  {page.isHomePage ? <Home className="w-3.5 h-3.5 flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span className="flex-1 text-left truncate">{page.title}</span>
                  {!page.isHomePage && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(page.id); setEditTitle(page.title); }} className="p-0.5 hover:text-primary">
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(page.id); }} className="p-0.5 hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </button>
              )}
            </div>
          ))}
      </div>

      {/* Create New */}
      {creating && (
        <div className="mt-2 flex items-center gap-1 px-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
            placeholder="Page title..."
            className="flex-1 text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={handleCreate} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded">Add</button>
        </div>
      )}
    </div>
  );
}
