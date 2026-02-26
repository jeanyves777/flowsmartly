"use client";

import { CanvasEditor } from "./canvas-editor";
import { TopToolbar } from "./toolbar/top-toolbar";
import { TextToolbar } from "./toolbar/text-toolbar";
import { LeftPanel } from "./panels/left-panel";
import { RightPanel } from "./panels/right-panel";

export function StudioLayout() {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Top Toolbar */}
      <TopToolbar />

      {/* Main Content: Left Panel + Canvas + Right Panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left Panel (icon tabs + content) */}
        <LeftPanel />

        {/* Canvas Work Area + Floating Text Toolbar */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
          <TextToolbar />
          <CanvasEditor />
        </div>

        {/* Right Panel (properties + layers) */}
        <RightPanel />
      </div>
    </div>
  );
}
