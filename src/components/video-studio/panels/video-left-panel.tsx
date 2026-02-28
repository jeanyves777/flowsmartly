"use client";

import {
  Upload,
  Sparkles,
  Mic2,
  Type,
  Music,
  Captions,
  Shapes,
  ArrowLeftRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useVideoStore } from "../hooks/use-video-store";
import type { VideoActivePanel } from "@/lib/video-editor/types";
import { MediaPanel } from "./media-panel";
import { GeneratePanel } from "./generate-panel";
import { VoicePanel } from "./voice-panel";
import { VideoTextPanel } from "./text-panel";
import { AudioPanel } from "./audio-panel";
import { CaptionsPanel } from "./captions-panel";
import { TransitionsPanel } from "./transitions-panel";

const TABS: {
  id: VideoActivePanel;
  icon: React.ElementType;
  label: string;
}[] = [
  { id: "media", icon: Upload, label: "Media" },
  { id: "generate", icon: Sparkles, label: "AI Video" },
  { id: "voice", icon: Mic2, label: "Voice" },
  { id: "captions", icon: Captions, label: "Captions" },
  { id: "text", icon: Type, label: "Text" },
  { id: "audio", icon: Music, label: "Audio" },
  { id: "transitions", icon: ArrowLeftRight, label: "Transitions" },
];

const PANEL_COMPONENTS: Record<VideoActivePanel, React.ComponentType> = {
  media: MediaPanel,
  generate: GeneratePanel,
  voice: VoicePanel,
  captions: CaptionsPanel,
  text: VideoTextPanel,
  audio: AudioPanel,
  elements: MediaPanel, // fallback
  transitions: TransitionsPanel,
};

export function VideoLeftPanel() {
  const activePanel = useVideoStore((s) => s.activePanel);
  const setActivePanel = useVideoStore((s) => s.setActivePanel);
  const isLeftPanelCollapsed = useVideoStore((s) => s.isLeftPanelCollapsed);
  const toggleLeftPanel = useVideoStore((s) => s.toggleLeftPanel);

  const PanelContent = PANEL_COMPONENTS[activePanel];

  return (
    <div className="flex h-full shrink-0">
      {/* Icon strip */}
      <div className="w-[60px] bg-muted/50 border-r flex flex-col items-center py-2 gap-1 shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePanel === tab.id && !isLeftPanelCollapsed;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActivePanel(tab.id);
                if (isLeftPanelCollapsed) toggleLeftPanel();
              }}
              className={cn(
                "flex flex-col items-center justify-center w-12 h-12 rounded-lg text-[10px] gap-0.5 transition-colors",
                isActive
                  ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate w-full text-center">{tab.label}</span>
            </button>
          );
        })}

        <div className="flex-1" />

        <button
          onClick={toggleLeftPanel}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          title={isLeftPanelCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isLeftPanelCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Panel content */}
      {!isLeftPanelCollapsed && (
        <div className="w-[280px] bg-background border-r flex flex-col overflow-hidden">
          <div className="px-3 py-3 border-b shrink-0">
            <h3 className="text-sm font-semibold">
              {TABS.find((t) => t.id === activePanel)?.label || activePanel}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <PanelContent />
          </div>
        </div>
      )}
    </div>
  );
}
