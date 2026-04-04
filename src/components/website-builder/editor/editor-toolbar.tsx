"use client";

import { useRouter } from "next/navigation";
import { useWebsiteEditorStore } from "@/stores/website-editor-store";
import {
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Eye,
  Globe,
  Save,
  Loader2,
  Check,
} from "lucide-react";

export function EditorToolbar() {
  const router = useRouter();
  const {
    websiteName,
    websiteSlug,
    websiteId,
    pages,
    currentPageId,
    devicePreview,
    isDirty,
    isSaving,
    isPublishing,
    setDevicePreview,
    save,
    publish,
    undo,
    redo,
    canUndo,
    canRedo,
    switchPage,
  } = useWebsiteEditorStore();

  const handleSwitchPage = async (pageId: string) => {
    if (pageId === currentPageId) return;
    if (isDirty) await save();
    // Fetch new page blocks
    try {
      const res = await fetch(`/api/websites/${websiteId}/pages/${pageId}`);
      const data = await res.json();
      const blocks = JSON.parse(data.blocks || "[]");
      switchPage(pageId, blocks);
    } catch (err) {
      console.error("Failed to load page:", err);
    }
  };

  const currentPage = pages.find((p) => p.id === currentPageId);

  return (
    <div className="h-12 border-b border-border bg-background flex items-center justify-between px-3 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/websites/${websiteId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline font-medium">{websiteName}</span>
        </button>

        <div className="h-5 w-px bg-border" />

        {/* Page Switcher */}
        <select
          value={currentPageId}
          onChange={(e) => handleSwitchPage(e.target.value)}
          className="text-sm bg-transparent border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} {p.isHomePage ? "(Home)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Center — Device Preview */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
        {[
          { device: "desktop" as const, icon: Monitor, label: "Desktop" },
          { device: "tablet" as const, icon: Tablet, label: "Tablet" },
          { device: "mobile" as const, icon: Smartphone, label: "Mobile" },
        ].map(({ device, icon: Icon, label }) => (
          <button
            key={device}
            onClick={() => setDevicePreview(device)}
            title={label}
            className={`p-1.5 rounded-md transition-colors ${
              devicePreview === device
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Undo/Redo */}
        <button onClick={undo} disabled={!canUndo()} title="Undo (Ctrl+Z)" className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={redo} disabled={!canRedo()} title="Redo (Ctrl+Shift+Z)" className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-border" />

        {/* Save Status */}
        <button
          onClick={() => save()}
          disabled={!isDirty && !isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isDirty ? <Save className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5 text-green-500" />}
          <span className="hidden sm:inline">{isSaving ? "Saving..." : isDirty ? "Save" : "Saved"}</span>
        </button>

        {/* Preview */}
        <a
          href={`/sites/${websiteSlug}${currentPage?.slug ? `/${currentPage.slug}` : ""}`}
          target="_blank"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Preview</span>
        </a>

        {/* Publish */}
        <button
          onClick={() => publish()}
          disabled={isPublishing}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-all font-medium disabled:opacity-50"
        >
          {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
          <span>{isPublishing ? "Publishing..." : "Publish"}</span>
        </button>
      </div>
    </div>
  );
}
