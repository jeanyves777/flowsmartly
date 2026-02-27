"use client";

import { CanvasEditor } from "./canvas-editor";
import { TopToolbar } from "./toolbar/top-toolbar";
import { TextToolbar } from "./toolbar/text-toolbar";
import { BottomToolbar } from "./toolbar/bottom-toolbar";
import { LeftPanel } from "./panels/left-panel";
import { RightPanel } from "./panels/right-panel";
import { PagesPanel } from "./panels/pages-panel";

export function StudioLayout() {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Top Toolbar - fixed at top */}
      <TopToolbar />

      {/* Main Content: Left Panel + Canvas + Right Panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left Panel - fixed on left */}
        <LeftPanel />

        {/* Canvas Work Area + Floating Text Toolbar */}
        <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
          <TextToolbar />
          <CanvasEditor />
        </div>

        {/* Right Panel - fixed on right */}
        <RightPanel />
      </div>

      {/* Pages Panel - between canvas area and bottom toolbar */}
      <PagesPanel />

      {/* Bottom Toolbar - fixed at bottom, full width */}
      <BottomToolbar />
    </div>
  );
}
