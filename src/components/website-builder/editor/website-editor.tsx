"use client";

import { useEffect, useCallback, useRef } from "react";
import { useWebsiteEditorStore } from "@/stores/website-editor-store";
import { EditorToolbar } from "./editor-toolbar";
import { EditorCanvas } from "./editor-canvas";
import { BlocksPanel } from "../panels/blocks-panel";
import { PagesPanel } from "../panels/pages-panel";
import { LayersPanel } from "../panels/layers-panel";
import { PropertiesPanel } from "../panels/properties-panel";
import type { WebsiteBlock, WebsiteTheme, WebsiteNavigation } from "@/types/website-builder";

interface WebsiteEditorProps {
  websiteId: string;
  websiteName: string;
  websiteSlug: string;
  pages: Array<{ id: string; title: string; slug: string; isHomePage: boolean; status: string; sortOrder: number; blocks: string }>;
  theme: string;
  navigation: string;
}

export function WebsiteEditor({ websiteId, websiteName, websiteSlug, pages, theme, navigation }: WebsiteEditorProps) {
  const init = useWebsiteEditorStore((s) => s.init);
  const save = useWebsiteEditorStore((s) => s.save);
  const undo = useWebsiteEditorStore((s) => s.undo);
  const redo = useWebsiteEditorStore((s) => s.redo);
  const isDirty = useWebsiteEditorStore((s) => s.isDirty);
  const leftPanel = useWebsiteEditorStore((s) => s.leftPanel);
  const selectedBlockId = useWebsiteEditorStore((s) => s.selectedBlockId);
  const saveTimerRef = useRef<NodeJS.Timeout>(undefined);

  // Initialize editor state
  useEffect(() => {
    const homePage = pages.find((p) => p.isHomePage) || pages[0];
    if (!homePage) return;

    let parsedBlocks: WebsiteBlock[] = [];
    try { parsedBlocks = JSON.parse(homePage.blocks || "[]"); } catch {}

    let parsedTheme: WebsiteTheme;
    try { parsedTheme = JSON.parse(theme || "{}"); } catch { parsedTheme = {} as WebsiteTheme; }

    let parsedNav: WebsiteNavigation | null = null;
    try { parsedNav = JSON.parse(navigation || "null"); } catch {}

    init({
      websiteId,
      websiteName,
      websiteSlug,
      pages: pages.map(({ blocks: _, ...p }) => p),
      currentPageId: homePage.id,
      blocks: parsedBlocks,
      theme: parsedTheme,
      navigation: parsedNav,
    });
  }, []);

  // Auto-save (debounced 3s)
  useEffect(() => {
    if (!isDirty) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { save(); }, 3000);
    return () => clearTimeout(saveTimerRef.current);
  }, [isDirty, save]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "s") { e.preventDefault(); save(); }
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      if (e.key === "y") { e.preventDefault(); redo(); }
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      const state = useWebsiteEditorStore.getState();
      if (state.selectedBlockId && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        state.deleteBlock(state.selectedBlockId);
      }
    }
  }, [save, undo, redo]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const LeftPanelContent = leftPanel === "pages" ? PagesPanel : leftPanel === "layers" ? LayersPanel : BlocksPanel;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-background">
      <EditorToolbar />
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-[280px] border-r border-border bg-background overflow-y-auto flex-shrink-0 hidden lg:block">
          <LeftPanelContent />
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-muted/30">
          <EditorCanvas />
        </div>

        {/* Right Panel */}
        {selectedBlockId && (
          <div className="w-[320px] border-l border-border bg-background overflow-y-auto flex-shrink-0 hidden lg:block">
            <PropertiesPanel />
          </div>
        )}
      </div>
    </div>
  );
}
