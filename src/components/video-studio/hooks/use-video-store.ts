import { create } from "zustand";
import type {
  TimelineClip,
  TimelineTrack,
  VideoProject,
  PlaybackState,
  VideoActivePanel,
  CaptionSettings,
  TrackType,
} from "@/lib/video-editor/types";
import {
  generateId,
  createDefaultProject,
  createDefaultCaptionSettings,
  TRACK_HEIGHTS,
} from "@/lib/video-editor/types";

// ── Store Interface ──────────────────────────────────────────────────

export interface VideoStudioState {
  // ─── Project ───────────────────────────────────────────────
  project: VideoProject;
  setProject: (p: Partial<VideoProject>) => void;

  // ─── Timeline: Tracks & Clips ──────────────────────────────
  tracks: TimelineTrack[];
  clips: Record<string, TimelineClip>;

  addTrack: (type: TrackType, name?: string) => string;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  reorderTracks: (trackIds: string[]) => void;

  addClip: (clip: Omit<TimelineClip, "id">) => string;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void;
  splitClip: (clipId: string, atTime: number) => [string, string] | null;
  duplicateClip: (clipId: string) => string | null;

  // ─── Playback ──────────────────────────────────────────────
  playbackState: PlaybackState;
  currentTime: number;
  setPlaybackState: (s: PlaybackState) => void;
  setCurrentTime: (t: number) => void;

  // ─── Timeline computed ─────────────────────────────────────
  timelineDuration: number;
  refreshDuration: () => void;

  // ─── Timeline UI ───────────────────────────────────────────
  timelineZoom: number;    // px per second
  setTimelineZoom: (z: number) => void;
  scrollOffset: number;    // horizontal scroll in seconds
  setScrollOffset: (s: number) => void;
  selectedClipIds: string[];
  setSelectedClipIds: (ids: string[]) => void;

  // ─── Playback speed & snap ───────────────────────────────
  playbackSpeed: number;
  setPlaybackSpeed: (s: number) => void;
  snapEnabled: boolean;
  setSnapEnabled: (s: boolean) => void;

  // ─── Canvas (Fabric.js overlay) ────────────────────────────
  canvas: unknown | null;
  setCanvas: (c: unknown | null) => void;
  canvasZoom: number;
  setCanvasZoom: (z: number) => void;

  // ─── Panels ────────────────────────────────────────────────
  activePanel: VideoActivePanel;
  setActivePanel: (p: VideoActivePanel) => void;
  isLeftPanelCollapsed: boolean;
  toggleLeftPanel: () => void;
  isRightPanelCollapsed: boolean;
  toggleRightPanel: () => void;

  // ─── Dirty / Save ──────────────────────────────────────────
  isDirty: boolean;
  setDirty: (d: boolean) => void;
  projectId: string | null;
  setProjectId: (id: string | null) => void;

  // ─── Caption Settings ──────────────────────────────────────
  captionSettings: CaptionSettings;
  setCaptionSettings: (s: Partial<CaptionSettings>) => void;

  // ─── AI Generation ─────────────────────────────────────────
  isGenerating: boolean;
  generationStatus: string;
  setGenerating: (g: boolean, status?: string) => void;

  // ─── Export ────────────────────────────────────────────────
  isExporting: boolean;
  exportProgress: number;
  setExporting: (e: boolean, progress?: number) => void;

  // ─── History ───────────────────────────────────────────────
  canUndo: boolean;
  canRedo: boolean;
  setHistoryState: (canUndo: boolean, canRedo: boolean) => void;

  // ─── Bulk operations ───────────────────────────────────────
  hydrate: (data: {
    project: VideoProject;
    tracks: TimelineTrack[];
    clips: Record<string, TimelineClip>;
    captionSettings?: CaptionSettings;
  }) => void;
  reset: () => void;
}

// ── Helper: compute timeline duration ────────────────────────────────

function computeDuration(clips: Record<string, TimelineClip>): number {
  let maxEnd = 0;
  for (const clip of Object.values(clips)) {
    const end = clip.startTime + clip.duration;
    if (end > maxEnd) maxEnd = end;
  }
  return maxEnd;
}

/**
 * Find the end time of the last clip on a given track.
 * Used for auto-placing new clips at the end of existing content.
 */
function getTrackEndTime(
  trackId: string,
  tracks: TimelineTrack[],
  clips: Record<string, TimelineClip>
): number {
  const track = tracks.find((t) => t.id === trackId);
  if (!track) return 0;
  let maxEnd = 0;
  for (const clipId of track.clips) {
    const clip = clips[clipId];
    if (clip) {
      const end = clip.startTime + clip.duration;
      if (end > maxEnd) maxEnd = end;
    }
  }
  return maxEnd;
}

// ── Default initial tracks ───────────────────────────────────────────

function createDefaultTracks(): TimelineTrack[] {
  return [
    {
      id: generateId("track"),
      type: "video",
      name: "Video 1",
      height: TRACK_HEIGHTS.video,
      muted: false,
      locked: false,
      visible: true,
      clips: [],
    },
    {
      id: generateId("track"),
      type: "audio",
      name: "Audio 1",
      height: TRACK_HEIGHTS.audio,
      muted: false,
      locked: false,
      visible: true,
      clips: [],
    },
    {
      id: generateId("track"),
      type: "caption",
      name: "Captions",
      height: TRACK_HEIGHTS.caption,
      muted: false,
      locked: false,
      visible: true,
      clips: [],
    },
  ];
}

// ── Store ────────────────────────────────────────────────────────────

export const useVideoStore = create<VideoStudioState>((set, get) => ({
  // ─── Project ───────────────────────────────────────────────
  project: createDefaultProject(),
  setProject: (p) =>
    set((s) => ({
      project: { ...s.project, ...p },
      isDirty: true,
    })),

  // ─── Timeline ──────────────────────────────────────────────
  tracks: createDefaultTracks(),
  clips: {},

  addTrack: (type, name) => {
    const id = generateId("track");
    const count = get().tracks.filter((t) => t.type === type).length + 1;
    const trackName = name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`;

    set((s) => ({
      tracks: [
        ...s.tracks,
        {
          id,
          type,
          name: trackName,
          height: TRACK_HEIGHTS[type],
          muted: false,
          locked: false,
          visible: true,
          clips: [],
        },
      ],
      isDirty: true,
    }));
    return id;
  },

  removeTrack: (trackId) => {
    const track = get().tracks.find((t) => t.id === trackId);
    if (!track) return;

    // Remove all clips on this track
    const newClips = { ...get().clips };
    for (const clipId of track.clips) {
      delete newClips[clipId];
    }

    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== trackId),
      clips: newClips,
      selectedClipIds: s.selectedClipIds.filter((id) => !track.clips.includes(id)),
      isDirty: true,
    }));
    get().refreshDuration();
  },

  updateTrack: (trackId, updates) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t)),
      isDirty: true,
    })),

  reorderTracks: (trackIds) =>
    set((s) => {
      const trackMap = new Map(s.tracks.map((t) => [t.id, t]));
      return {
        tracks: trackIds.map((id) => trackMap.get(id)!).filter(Boolean),
        isDirty: true,
      };
    }),

  addClip: (clipData) => {
    const id = generateId("clip");
    const state = get();

    // Auto-place at end of track if startTime is 0 and track already has clips
    let startTime = clipData.startTime;
    if (startTime === 0) {
      const trackEnd = getTrackEndTime(clipData.trackId, state.tracks, state.clips);
      if (trackEnd > 0) startTime = trackEnd;
    }

    const clip: TimelineClip = { ...clipData, id, startTime };

    set((s) => {
      const newClips = { ...s.clips, [id]: clip };
      const newTracks = s.tracks.map((t) =>
        t.id === clip.trackId ? { ...t, clips: [...t.clips, id] } : t
      );
      return {
        clips: newClips,
        tracks: newTracks,
        timelineDuration: computeDuration(newClips),
        selectedClipIds: [id],
        isDirty: true,
      };
    });
    return id;
  },

  updateClip: (clipId, updates) =>
    set((s) => {
      if (!s.clips[clipId]) return s;
      const newClips = {
        ...s.clips,
        [clipId]: { ...s.clips[clipId], ...updates },
      };
      return {
        clips: newClips,
        timelineDuration: computeDuration(newClips),
        isDirty: true,
      };
    }),

  removeClip: (clipId) => {
    const clip = get().clips[clipId];
    if (!clip) return;

    set((s) => {
      const newClips = { ...s.clips };
      delete newClips[clipId];

      return {
        clips: newClips,
        tracks: s.tracks.map((t) =>
          t.id === clip.trackId
            ? { ...t, clips: t.clips.filter((c) => c !== clipId) }
            : t
        ),
        selectedClipIds: s.selectedClipIds.filter((id) => id !== clipId),
        timelineDuration: computeDuration(newClips),
        isDirty: true,
      };
    });
  },

  moveClip: (clipId, newTrackId, newStartTime) => {
    const clip = get().clips[clipId];
    if (!clip) return;

    set((s) => {
      // Remove from old track
      const tracks = s.tracks.map((t) => {
        if (t.id === clip.trackId) {
          return { ...t, clips: t.clips.filter((c) => c !== clipId) };
        }
        if (t.id === newTrackId && !t.clips.includes(clipId)) {
          return { ...t, clips: [...t.clips, clipId] };
        }
        return t;
      });

      const newClips = {
        ...s.clips,
        [clipId]: {
          ...clip,
          trackId: newTrackId,
          startTime: Math.max(0, newStartTime),
        },
      };

      return {
        clips: newClips,
        tracks,
        timelineDuration: computeDuration(newClips),
        isDirty: true,
      };
    });
  },

  splitClip: (clipId, atTime) => {
    const clip = get().clips[clipId];
    if (!clip) return null;

    const relativeTime = atTime - clip.startTime;
    if (relativeTime <= 0 || relativeTime >= clip.duration) return null;

    const id1 = clipId;
    const id2 = generateId("clip");

    set((s) => {
      const clip1: TimelineClip = {
        ...clip,
        id: id1,
        duration: relativeTime,
        trimEnd: clip.trimEnd + (clip.duration - relativeTime),
      };

      const clip2: TimelineClip = {
        ...clip,
        id: id2,
        startTime: atTime,
        duration: clip.duration - relativeTime,
        trimStart: clip.trimStart + relativeTime,
      };

      const newClips = { ...s.clips, [id1]: clip1, [id2]: clip2 };
      const newTracks = s.tracks.map((t) =>
        t.id === clip.trackId
          ? { ...t, clips: [...t.clips, id2] }
          : t
      );

      return {
        clips: newClips,
        tracks: newTracks,
        isDirty: true,
      };
    });

    return [id1, id2];
  },

  duplicateClip: (clipId) => {
    const clip = get().clips[clipId];
    if (!clip) return null;

    const newId = generateId("clip");
    const duplicated: TimelineClip = {
      ...clip,
      id: newId,
      startTime: clip.startTime + clip.duration + 0.1,
      name: `${clip.name} (copy)`,
    };

    set((s) => {
      const newClips = { ...s.clips, [newId]: duplicated };
      const newTracks = s.tracks.map((t) =>
        t.id === clip.trackId ? { ...t, clips: [...t.clips, newId] } : t
      );
      return {
        clips: newClips,
        tracks: newTracks,
        timelineDuration: computeDuration(newClips),
        isDirty: true,
      };
    });

    return newId;
  },

  // ─── Playback ──────────────────────────────────────────────
  playbackState: "stopped",
  currentTime: 0,
  setPlaybackState: (s) => set({ playbackState: s }),
  setCurrentTime: (t) => set({ currentTime: t }),

  // ─── Timeline computed ─────────────────────────────────────
  timelineDuration: 0,
  refreshDuration: () =>
    set((s) => ({ timelineDuration: computeDuration(s.clips) })),

  // ─── Timeline UI ───────────────────────────────────────────
  timelineZoom: 50, // 50px per second
  setTimelineZoom: (z) => set({ timelineZoom: Math.max(10, Math.min(200, z)) }),
  scrollOffset: 0,
  setScrollOffset: (s) => set({ scrollOffset: Math.max(0, s) }),
  selectedClipIds: [],
  setSelectedClipIds: (ids) =>
    set({ selectedClipIds: ids }),

  // ─── Playback speed & snap ───────────────────────────────
  playbackSpeed: 1,
  setPlaybackSpeed: (s) => set({ playbackSpeed: Math.max(0.25, Math.min(4, s)) }),
  snapEnabled: true,
  setSnapEnabled: (s) => set({ snapEnabled: s }),

  // ─── Canvas ────────────────────────────────────────────────
  canvas: null,
  setCanvas: (c) => set({ canvas: c }),
  canvasZoom: 1,
  setCanvasZoom: (z) => set({ canvasZoom: Math.max(0.1, Math.min(3, z)) }),

  // ─── Panels ────────────────────────────────────────────────
  activePanel: "media",
  setActivePanel: (p) => set({ activePanel: p }),
  isLeftPanelCollapsed: false,
  toggleLeftPanel: () => set((s) => ({ isLeftPanelCollapsed: !s.isLeftPanelCollapsed })),
  isRightPanelCollapsed: true,
  toggleRightPanel: () => set((s) => ({ isRightPanelCollapsed: !s.isRightPanelCollapsed })),

  // ─── Dirty / Save ──────────────────────────────────────────
  isDirty: false,
  setDirty: (d) => set({ isDirty: d }),
  projectId: null,
  setProjectId: (id) => set({ projectId: id }),

  // ─── Caption Settings ──────────────────────────────────────
  captionSettings: createDefaultCaptionSettings(),
  setCaptionSettings: (s) =>
    set((state) => ({
      captionSettings: { ...state.captionSettings, ...s },
      isDirty: true,
    })),

  // ─── AI Generation ─────────────────────────────────────────
  isGenerating: false,
  generationStatus: "",
  setGenerating: (g, status) =>
    set({ isGenerating: g, generationStatus: status || "" }),

  // ─── Export ────────────────────────────────────────────────
  isExporting: false,
  exportProgress: 0,
  setExporting: (e, progress) =>
    set({ isExporting: e, exportProgress: progress ?? 0 }),

  // ─── History ───────────────────────────────────────────────
  canUndo: false,
  canRedo: false,
  setHistoryState: (canUndo, canRedo) => set({ canUndo, canRedo }),

  // ─── Bulk operations ───────────────────────────────────────
  hydrate: (data) =>
    set({
      project: data.project,
      tracks: data.tracks,
      clips: data.clips,
      captionSettings: data.captionSettings || createDefaultCaptionSettings(),
      timelineDuration: computeDuration(data.clips),
      isDirty: false,
    }),

  reset: () =>
    set({
      project: createDefaultProject(),
      tracks: createDefaultTracks(),
      clips: {},
      playbackState: "stopped",
      currentTime: 0,
      timelineDuration: 0,
      timelineZoom: 50,
      scrollOffset: 0,
      selectedClipIds: [],
      playbackSpeed: 1,
      snapEnabled: true,
      canvas: null,
      canvasZoom: 1,
      activePanel: "media",
      isDirty: false,
      projectId: null,
      captionSettings: createDefaultCaptionSettings(),
      isGenerating: false,
      generationStatus: "",
      isExporting: false,
      exportProgress: 0,
      canUndo: false,
      canRedo: false,
    }),
}));
