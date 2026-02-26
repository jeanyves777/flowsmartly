"use client";

import {
  LayoutTemplate,
  Shapes,
  Type,
  Upload,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCanvasStore, type ActivePanel } from "../hooks/use-canvas-store";
import { TemplatesPanel } from "./templates-panel";
import { ElementsPanel } from "./elements-panel";
import { TextPanel } from "./text-panel";
import { UploadsPanel } from "./uploads-panel";
import { AiPanel } from "./ai-panel";
import { BackgroundsPanel } from "./backgrounds-panel";

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
];

const PANEL_COMPONENTS: Record<ActivePanel, React.ComponentType> = {
  templates: TemplatesPanel,
  elements: ElementsPanel,
  text: TextPanel,
  uploads: UploadsPanel,
  ai: AiPanel,
  backgrounds: BackgroundsPanel,
};

export function LeftPanel() {
  const { activePanel, setActivePanel } = useCanvasStore();
  const PanelContent = PANEL_COMPONENTS[activePanel];

  return (
    <div className="flex h-full shrink-0">
      {/* Icon strip */}
      <div className="w-[72px] bg-muted/50 border-r flex flex-col items-center py-2 gap-1 shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePanel === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
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
      </div>

      {/* Panel content */}
      <div className="w-[280px] border-r bg-background overflow-y-auto shrink-0">
        <PanelContent />
      </div>
    </div>
  );
}
