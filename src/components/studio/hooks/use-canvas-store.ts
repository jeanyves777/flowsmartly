import { create } from "zustand";

export interface LayerInfo {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
}

export interface PageData {
  id: string;
  canvasJSON: string;
  thumbnailDataUrl: string | null;
  width: number;
  height: number;
}

export type ActiveTool = "select" | "text" | "shape" | "draw" | "pan";
export type ActiveShape = "rect" | "circle" | "triangle" | "line" | "arrow" | "star";
export type ActivePanel =
  | "templates"
  | "elements"
  | "text"
  | "uploads"
  | "ai"
  | "backgrounds"
  | "eraser";

interface CanvasState {
  // Fabric.js canvas reference (set once on mount)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canvas: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setCanvas: (c: any | null) => void;

  // Canvas dimensions
  canvasWidth: number;
  canvasHeight: number;
  setCanvasDimensions: (w: number, h: number) => void;

  // Zoom
  zoom: number;
  setZoom: (z: number) => void;

  // Selection state (updated from canvas events)
  selectedObjectIds: string[];
  selectedObjectType: string | null;
  setSelection: (ids: string[], type: string | null) => void;

  // Active tool
  activeTool: ActiveTool;
  setActiveTool: (t: ActiveTool) => void;

  // Active shape sub-tool
  activeShape: ActiveShape;
  setActiveShape: (s: ActiveShape) => void;

  // Left panel state
  activePanel: ActivePanel;
  setActivePanel: (p: ActivePanel) => void;

  // History
  canUndo: boolean;
  canRedo: boolean;
  setHistoryState: (canUndo: boolean, canRedo: boolean) => void;

  // Layers (derived from canvas objects)
  layers: LayerInfo[];
  refreshLayers: () => void;

  // Design metadata
  designId: string | null;
  designName: string;
  setDesignId: (id: string | null) => void;
  setDesignName: (name: string) => void;

  // Dirty flag
  isDirty: boolean;
  setDirty: (d: boolean) => void;

  // Text editing state
  isEditingText: boolean;
  setIsEditingText: (editing: boolean) => void;

  // Collaboration
  collaborationRole: "OWNER" | "EDITOR" | "VIEWER" | null;
  isReadOnly: boolean;
  shareToken: string | null;
  setCollaborationRole: (role: "OWNER" | "EDITOR" | "VIEWER" | null) => void;
  setShareToken: (token: string | null) => void;

  // Panel collapse state
  isLeftPanelCollapsed: boolean;
  isRightPanelCollapsed: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // Multi-page support
  pages: PageData[];
  activePageIndex: number;
  setPages: (pages: PageData[]) => void;
  setActivePageIndex: (index: number) => void;
  addPage: (afterIndex?: number) => void;
  deletePage: (index: number) => void;
  duplicatePage: (index: number) => void;
  updateCurrentPageSnapshot: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  canvas: null,
  setCanvas: (c) => set({ canvas: c }),

  canvasWidth: 1080,
  canvasHeight: 1080,
  setCanvasDimensions: (w, h) => set({ canvasWidth: w, canvasHeight: h }),

  zoom: 1,
  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(5, z)) }),

  selectedObjectIds: [],
  selectedObjectType: null,
  setSelection: (ids, type) =>
    set({ selectedObjectIds: ids, selectedObjectType: type }),

  activeTool: "select",
  setActiveTool: (t) => set({ activeTool: t }),

  activeShape: "rect",
  setActiveShape: (s) => set({ activeShape: s }),

  activePanel: "templates",
  setActivePanel: (p) => set({ activePanel: p }),

  canUndo: false,
  canRedo: false,
  setHistoryState: (canUndo, canRedo) => set({ canUndo, canRedo }),

  layers: [],
  refreshLayers: () => {
    const { canvas } = get();
    if (!canvas) return;
    const objects = canvas.getObjects();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layers: LayerInfo[] = objects.map((obj: any, i: number) => ({
      id: obj.id || `layer-${i}`,
      name: obj.customName || `${obj.type || "object"} ${i + 1}`,
      type: obj.type || "object",
      visible: obj.visible !== false,
      locked: !obj.selectable,
    })).reverse(); // top-most first
    set({ layers });
  },

  designId: null,
  designName: "Untitled Design",
  setDesignId: (id) => set({ designId: id }),
  setDesignName: (name) => set({ designName: name }),

  isDirty: false,
  setDirty: (d) => set({ isDirty: d }),

  isEditingText: false,
  setIsEditingText: (editing) => set({ isEditingText: editing }),

  // Collaboration
  collaborationRole: null,
  isReadOnly: false,
  shareToken: null,
  setCollaborationRole: (role) =>
    set({ collaborationRole: role, isReadOnly: role === "VIEWER" }),
  setShareToken: (token) => set({ shareToken: token }),

  // Panel collapse
  isLeftPanelCollapsed: false,
  isRightPanelCollapsed: false,
  toggleLeftPanel: () => set((s) => ({ isLeftPanelCollapsed: !s.isLeftPanelCollapsed })),
  toggleRightPanel: () => set((s) => ({ isRightPanelCollapsed: !s.isRightPanelCollapsed })),

  // Multi-page
  pages: [],
  activePageIndex: 0,
  setPages: (pages) => set({ pages }),
  setActivePageIndex: (index) => set({ activePageIndex: index }),

  addPage: (afterIndex) => {
    const { pages, canvasWidth, canvasHeight } = get();
    const newPage: PageData = {
      id: `page-${Date.now()}`,
      canvasJSON: JSON.stringify({ version: "6.0.0", objects: [], background: "#ffffff" }),
      thumbnailDataUrl: null,
      width: canvasWidth,
      height: canvasHeight,
    };
    const idx = afterIndex !== undefined ? afterIndex + 1 : pages.length;
    const newPages = [...pages];
    newPages.splice(idx, 0, newPage);
    set({ pages: newPages, activePageIndex: idx });
  },

  deletePage: (index) => {
    const { pages, activePageIndex } = get();
    if (pages.length <= 1) return;
    const newPages = pages.filter((_, i) => i !== index);
    const newActive = activePageIndex >= newPages.length
      ? newPages.length - 1
      : activePageIndex > index
        ? activePageIndex - 1
        : activePageIndex;
    set({ pages: newPages, activePageIndex: newActive });
  },

  duplicatePage: (index) => {
    const { pages } = get();
    const source = pages[index];
    if (!source) return;
    const newPage: PageData = { ...source, id: `page-${Date.now()}`, thumbnailDataUrl: source.thumbnailDataUrl };
    const newPages = [...pages];
    newPages.splice(index + 1, 0, newPage);
    set({ pages: newPages, activePageIndex: index + 1 });
  },

  updateCurrentPageSnapshot: () => {
    const { canvas, pages, activePageIndex } = get();
    if (!canvas || pages.length === 0) return;
    try {
      const json = JSON.stringify(canvas.toJSON(["id", "customName", "selectable", "visible"]));
      const thumbnail = canvas.toDataURL({ format: "png", multiplier: 0.15, quality: 0.5 });
      const newPages = [...pages];
      newPages[activePageIndex] = { ...newPages[activePageIndex], canvasJSON: json, thumbnailDataUrl: thumbnail };
      set({ pages: newPages });
    } catch {
      // silently fail for snapshot
    }
  },
}));
