"use client";

import { useState, useRef, useEffect } from "react";
import {
  Undo2,
  Redo2,
  Play,
  Pause,
  Square,
  SkipBack,
  Download,
  Save,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVideoStore } from "../hooks/use-video-store";
import { ExportDialog } from "../export-dialog";

interface PlaybackControls {
  play: () => void;
  pause: () => void;
  stop: () => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

export function VideoTopToolbar({
  onSave,
  playback,
  history,
}: VideoTopToolbarProps) {
  const project = useVideoStore((s) => s.project);
  const setProject = useVideoStore((s) => s.setProject);
  const isDirty = useVideoStore((s) => s.isDirty);
  const isExporting = useVideoStore((s) => s.isExporting);

  const [isEditingName, setIsEditingName] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

      {/* Center: Undo/Redo + Transport + Time */}
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
          title="Stop"
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

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Time display */}
        <span className="text-xs font-mono text-muted-foreground min-w-[110px] text-center tabular-nums">
          {formatTime(playback.currentTime)} / {formatTime(playback.duration)}
        </span>

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Resolution */}
        <span className="text-xs text-muted-foreground font-mono">
          {project.width}x{project.height}
        </span>
      </div>

      {/* Right: Export */}
      <div className="flex items-center gap-1">
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
