import { create } from "zustand";

export interface LayerInfo {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
}

export type ActiveTool = "select" | "text" | "shape" | "draw" | "pan";
export type ActiveShape = "rect" | "circle" | "triangle" | "line" | "arrow" | "star";
export type ActivePanel =
  | "templates"
  | "elements"
  | "text"
  | "uploads"
  | "ai"
  | "backgrounds";

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
}));
