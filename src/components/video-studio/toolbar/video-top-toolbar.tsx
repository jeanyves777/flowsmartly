"use client";

import { useState, useRef, useEffect, memo } from "react";
import {
  Undo2,
  Redo2,
  Play,
  Pause,
  Square,
  SkipBack,
  Download,
  Save,
  SlidersHorizontal,
  Scissors,
  Monitor,
  Smartphone,
  SquareIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";
import { useVideoStore } from "../hooks/use-video-store";
import { ExportDialog } from "../export-dialog";
import {
  CANVAS_SIZE_PRESETS,
  getAspectRatioFromDimensions,
} from "@/lib/constants/video-presets";

interface PlaybackControls {
  play: () => void;
  pause: () => void;
  stop: () => void;
  isPlaying: boolean;
}

interface HistoryControls {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface VideoTopToolbarProps {
  onSave: () => void;
  playback: PlaybackControls;
  history: HistoryControls;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

/**
 * Isolated time display — subscribes to currentTime directly so only
 * this tiny component re-renders at 60fps during playback, not the
 * entire toolbar or layout tree.
 */
const TimeDisplay = memo(function TimeDisplay() {
  const currentTime = useVideoStore((s) => s.currentTime);
  const timelineDuration = useVideoStore((s) => s.timelineDuration);

  return (
    <span className="text-xs font-mono text-muted-foreground min-w-[110px] text-center tabular-nums">
      {formatTime(currentTime)} / {formatTime(timelineDuration)}
    </span>
  );
});

export function VideoTopToolbar({
  onSave,
  playback,
  history,
}: VideoTopToolbarProps) {
  const project = useVideoStore((s) => s.project);
  const setProject = useVideoStore((s) => s.setProject);
  const isDirty = useVideoStore((s) => s.isDirty);
  const isExporting = useVideoStore((s) => s.isExporting);
  const playbackSpeed = useVideoStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useVideoStore((s) => s.setPlaybackSpeed);
  const isRightPanelCollapsed = useVideoStore((s) => s.isRightPanelCollapsed);
  const toggleRightPanel = useVideoStore((s) => s.toggleRightPanel);
  const splitClip = useVideoStore((s) => s.splitClip);
  const currentTime = useVideoStore((s) => s.currentTime);
  const selectedClipIds = useVideoStore((s) => s.selectedClipIds);
  const clips = useVideoStore((s) => s.clips);

  const [isEditingName, setIsEditingName] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [customW, setCustomW] = useState(project.width);
  const [customH, setCustomH] = useState(project.height);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const applyCanvasSize = (w: number, h: number) => {
    const aspectRatio = getAspectRatioFromDimensions(w, h);
    setProject({ width: w, height: h, aspectRatio });
    setCustomW(w);
    setCustomH(h);
  };

  const handleSplitAtPlayhead = () => {
    const ct = currentTime;
    // Try selected clips first
    for (const id of selectedClipIds) {
      const clip = clips[id];
      if (clip && ct > clip.startTime && ct < clip.startTime + clip.duration) {
        splitClip(id, ct);
        return;
      }
    }
    // Fallback: split any clip at the playhead
    for (const clip of Object.values(clips)) {
      if (ct > clip.startTime && ct < clip.startTime + clip.duration) {
        splitClip(clip.id, ct);
        return;
      }
    }
  };

  const hasClipAtPlayhead = Object.values(clips).some(
    (clip) => currentTime > clip.startTime && currentTime < clip.startTime + clip.duration
  );

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (!project.name.trim()) {
      setProject({ name: "Untitled Video" });
    }
  };

  return (
    <div className="flex items-center justify-between h-12 px-3 border-b bg-background shrink-0">
      {/* Left: Project name + save */}
      <div className="flex items-center gap-2 min-w-0">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={project.name}
            onChange={(e) => setProject({ name: e.target.value })}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSubmit();
              if (e.key === "Escape") setIsEditingName(false);
            }}
            className="text-sm font-medium bg-transparent border-b border-brand-500 outline-none px-1 max-w-[200px]"
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-sm font-medium truncate max-w-[200px] hover:text-brand-600 transition-colors"
          >
            {project.name}
            {isDirty && (
              <span className="text-muted-foreground ml-1">*</span>
            )}
          </button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onSave}
          title="Save (Ctrl+S)"
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: Undo/Redo + Transport + Time + Speed */}
      <div className="flex items-center gap-1">
        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={history.undo}
          disabled={!history.canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={history.redo}
          disabled={!history.canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Transport controls */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={playback.stop}
          title="Return to start"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="default"
          size="icon"
          className="h-8 w-8 bg-brand-500 hover:bg-brand-600 text-white"
          onClick={playback.isPlaying ? playback.pause : playback.play}
          title={playback.isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {playback.isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>

        {playback.isPlaying && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={playback.stop}
            title="Stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        )}

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Time display — isolated component to avoid 60fps re-renders */}
        <TimeDisplay />

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Playback Speed */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-mono px-2 min-w-[42px]"
              title="Playback speed"
            >
              {playbackSpeed}x
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {SPEED_OPTIONS.map((speed) => (
              <DropdownMenuItem
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={playbackSpeed === speed ? "bg-brand-500/10 font-medium" : ""}
              >
                {speed}x {speed === 1 && "(Normal)"}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Split / Cut */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 px-2"
          onClick={handleSplitAtPlayhead}
          disabled={!hasClipAtPlayhead}
          title="Split clip at playhead (S)"
        >
          <Scissors className="h-3.5 w-3.5" />
          Cut
        </Button>

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Canvas Size Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-mono px-2 gap-1"
              title="Canvas size"
            >
              {project.width}x{project.height}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="center">
            <div className="space-y-3">
              <div className="text-xs font-semibold">Canvas Size</div>

              {/* Quick aspect ratio buttons */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => applyCanvasSize(1920, 1080)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-colors",
                    project.aspectRatio === "16:9"
                      ? "border-brand-500 bg-brand-500/10 text-brand-600"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <Monitor className="h-4 w-4" />
                  16:9
                </button>
                <button
                  onClick={() => applyCanvasSize(1080, 1920)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-colors",
                    project.aspectRatio === "9:16"
                      ? "border-brand-500 bg-brand-500/10 text-brand-600"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <Smartphone className="h-4 w-4" />
                  9:16
                </button>
                <button
                  onClick={() => applyCanvasSize(1080, 1080)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-colors",
                    project.aspectRatio === "1:1"
                      ? "border-brand-500 bg-brand-500/10 text-brand-600"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <SquareIcon className="h-4 w-4" />
                  1:1
                </button>
              </div>

              {/* Preset categories (collapsible) */}
              <div className="border rounded-lg">
                <button
                  onClick={() => setPresetsOpen(!presetsOpen)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium hover:bg-muted/50 transition-colors"
                >
                  {presetsOpen ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                  Size Presets
                </button>
                {presetsOpen && (
                  <div className="px-3 pb-2 space-y-2 max-h-[200px] overflow-y-auto">
                    {CANVAS_SIZE_PRESETS.map((cat) => (
                      <div key={cat.id}>
                        <div className="text-[10px] font-medium mb-0.5 text-muted-foreground uppercase tracking-wider">
                          {cat.name}
                        </div>
                        <div className="space-y-0.5">
                          {cat.presets.map((preset) => (
                            <button
                              key={preset.name}
                              onClick={() => applyCanvasSize(preset.width, preset.height)}
                              className={cn(
                                "w-full text-left px-2 py-1 rounded text-xs hover:bg-muted transition-colors flex justify-between",
                                project.width === preset.width && project.height === preset.height
                                  ? "bg-brand-500/10 text-brand-600 font-medium"
                                  : "text-muted-foreground"
                              )}
                            >
                              <span>{preset.name}</span>
                              <span className="font-mono text-[10px]">{preset.width}x{preset.height}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom size inputs */}
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">Custom Size</div>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 items-center">
                  <Input
                    type="number"
                    value={customW}
                    onChange={(e) => setCustomW(parseInt(e.target.value) || 1)}
                    onBlur={() => applyCanvasSize(customW, customH)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyCanvasSize(customW, customH); }}
                    className="h-7 text-xs font-mono"
                    min={100}
                    max={7680}
                  />
                  <span className="text-[10px] text-muted-foreground">x</span>
                  <Input
                    type="number"
                    value={customH}
                    onChange={(e) => setCustomH(parseInt(e.target.value) || 1)}
                    onBlur={() => applyCanvasSize(customW, customH)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyCanvasSize(customW, customH); }}
                    className="h-7 text-xs font-mono"
                    min={100}
                    max={7680}
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Right: Properties toggle + Export */}
      <div className="flex items-center gap-1">
        <Button
          variant={isRightPanelCollapsed ? "ghost" : "secondary"}
          size="sm"
          className="h-8 gap-1.5"
          onClick={toggleRightPanel}
          title={isRightPanelCollapsed ? "Show properties panel" : "Hide properties panel"}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Properties
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={isExporting}
          onClick={() => setShowExportDialog(true)}
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />
    </div>
  );
}
