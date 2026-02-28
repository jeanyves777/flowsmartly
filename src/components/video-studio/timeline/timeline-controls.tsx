"use client";

import { Plus, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useVideoStore } from "../hooks/use-video-store";
import type { TrackType } from "@/lib/video-editor/types";

export function TimelineControls() {
  const timelineZoom = useVideoStore((s) => s.timelineZoom);
  const setTimelineZoom = useVideoStore((s) => s.setTimelineZoom);
  const addTrack = useVideoStore((s) => s.addTrack);

  const handleAddTrack = (type: TrackType) => {
    addTrack(type);
  };

  return (
    <div className="h-8 border-t bg-muted/30 flex items-center px-2 gap-2 shrink-0">
      {/* Add Track */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
            <Plus className="h-3 w-3" />
            Add Track
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleAddTrack("video")}>
            Video Track
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddTrack("audio")}>
            Audio Track
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddTrack("text")}>
            Text Track
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddTrack("caption")}>
            Caption Track
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      {/* Zoom controls */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setTimelineZoom(timelineZoom - 10)}
        title="Zoom Out"
      >
        <ZoomOut className="h-3 w-3" />
      </Button>

      <input
        type="range"
        value={timelineZoom}
        onChange={(e) => setTimelineZoom(parseInt(e.target.value))}
        min={10}
        max={200}
        step={5}
        className="w-[100px] accent-brand-500"
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setTimelineZoom(timelineZoom + 10)}
        title="Zoom In"
      >
        <ZoomIn className="h-3 w-3" />
      </Button>

      <span className="text-[10px] text-muted-foreground font-mono w-10 text-center">
        {timelineZoom}px/s
      </span>
    </div>
  );
}
