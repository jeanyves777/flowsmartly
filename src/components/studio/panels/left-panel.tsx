"use client";

import {
  LayoutTemplate,
  Shapes,
  Type,
  Upload,
  Sparkles,
  Image as ImageIcon,
  Eraser,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCanvasStore, type ActivePanel } from "../hooks/use-canvas-store";
import { TemplatesPanel } from "./templates-panel";
import { ElementsPanel } from "./elements-panel";
import { TextPanel } from "./text-panel";
import { UploadsPanel } from "./uploads-panel";
import { AiPanel } from "./ai-panel";
import { BackgroundsPanel } from "./backgrounds-panel";
import { EraserPanel } from "./eraser-panel";

const TABS: {
  id: ActivePanel;
  icon: React.ElementType;
  label: string;
}[] = [
  { id: "templates", icon: LayoutTemplate, label: "Templates" },
  { id: "elements", icon: Shapes, label: "Elements" },
  { id: "text", icon: Type, label: "Text" },
  { id: "uploads", icon: Upload, label: "Uploads" },
  { id: "ai", icon: Sparkles, label: "AI" },
  { id: "backgrounds", icon: ImageIcon, label: "Background" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
];

const PANEL_COMPONENTS: Record<ActivePanel, React.ComponentType> = {
  templates: TemplatesPanel,
  elements: ElementsPanel,
  text: TextPanel,
  uploads: UploadsPanel,
  ai: AiPanel,
  backgrounds: BackgroundsPanel,
  eraser: EraserPanel,
};

export function LeftPanel() {
  const activePanel = useCanvasStore((s) => s.activePanel);
  const setActivePanel = useCanvasStore((s) => s.setActivePanel);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const isLeftPanelCollapsed = useCanvasStore((s) => s.isLeftPanelCollapsed);
  const toggleLeftPanel = useCanvasStore((s) => s.toggleLeftPanel);
  const isReadOnly = useCanvasStore((s) => s.isReadOnly);
  const PanelContent = PANEL_COMPONENTS[activePanel];

  // Hide entire left panel for view-only users
  if (isReadOnly) return null;

  return (
    <div className="flex h-full shrink-0">
      {/* Icon strip - always visible */}
      <div className="w-[72px] bg-muted/50 border-r flex flex-col items-center py-2 gap-1 shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePanel === tab.id && !isLeftPanelCollapsed;
          return (
            <button
              key={tab.id}
              onClick={() => {
                // Reset drawing mode when switching away from eraser
                if (tab.id !== "eraser") {
                  setActiveTool("select");
                }
                setActivePanel(tab.id);
                if (isLeftPanelCollapsed) toggleLeftPanel();
              }}
              className={cn(
                "flex flex-col items-center justify-center w-14 h-14 rounded-lg text-xs gap-1 transition-colors",
                isActive
                  ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={tab.label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] leading-none">{tab.label}</span>
            </button>
          );
        })}

        <div className="flex-1" />

        <button
          onClick={toggleLeftPanel}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mb-1"
          title={isLeftPanelCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isLeftPanelCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Panel content - hidden when collapsed */}
      {!isLeftPanelCollapsed && (
        <div className="w-[280px] border-r bg-background overflow-y-auto shrink-0">
          <PanelContent />
        </div>
      )}
    </div>
  );
}
