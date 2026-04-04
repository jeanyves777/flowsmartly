import { create } from "zustand";
import type {
  WebsiteBlock,
  WebsiteTheme,
  WebsiteNavigation,
  WebsiteBlockType,
  DevicePreview,
  BlockContent,
  BlockStyle,
  BlockAnimation,
} from "@/types/website-builder";
import { createBlock } from "@/lib/website/block-defaults";
import { DEFAULT_THEME } from "@/lib/website/theme-resolver";

interface WebsitePage {
  id: string;
  title: string;
  slug: string;
  isHomePage: boolean;
  status: string;
  sortOrder: number;
}

interface WebsiteEditorState {
  // Core
  websiteId: string;
  websiteName: string;
  websiteSlug: string;
  currentPageId: string;
  pages: WebsitePage[];
  blocks: WebsiteBlock[];
  theme: WebsiteTheme;
  navigation: WebsiteNavigation | null;

  // Editor state
  selectedBlockId: string | null;
  hoveredBlockId: string | null;
  devicePreview: DevicePreview;
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  leftPanel: "blocks" | "pages" | "layers";
  rightPanel: "content" | "style" | "animation" | "seo" | "responsive";

  // Undo/redo
  history: WebsiteBlock[][];
  historyIndex: number;

  // Init
  init: (data: {
    websiteId: string;
    websiteName: string;
    websiteSlug: string;
    pages: WebsitePage[];
    currentPageId: string;
    blocks: WebsiteBlock[];
    theme: WebsiteTheme;
    navigation: WebsiteNavigation | null;
  }) => void;

  // Block actions
  selectBlock: (id: string | null) => void;
  hoverBlock: (id: string | null) => void;
  addBlock: (type: WebsiteBlockType, afterId?: string) => void;
  updateBlock: (id: string, updates: Partial<WebsiteBlock>) => void;
  updateBlockContent: (id: string, content: Partial<BlockContent>) => void;
  updateBlockStyle: (id: string, style: Partial<BlockStyle>) => void;
  updateBlockAnimation: (id: string, animation: Partial<BlockAnimation>) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  moveBlock: (id: string, direction: "up" | "down") => void;
  reorderBlocks: (activeId: string, overId: string) => void;

  // Page actions
  switchPage: (pageId: string, blocks: WebsiteBlock[]) => void;
  addPage: (page: WebsitePage) => void;
  updatePage: (pageId: string, updates: Partial<WebsitePage>) => void;
  deletePage: (pageId: string) => void;

  // Theme/nav
  updateTheme: (theme: Partial<WebsiteTheme>) => void;
  updateNavigation: (nav: Partial<WebsiteNavigation>) => void;

  // Editor UI
  setDevicePreview: (device: DevicePreview) => void;
  setLeftPanel: (panel: "blocks" | "pages" | "layers") => void;
  setRightPanel: (panel: "content" | "style" | "animation" | "seo" | "responsive") => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Persistence
  save: () => Promise<void>;
  publish: () => Promise<void>;
  setDirty: (dirty: boolean) => void;
}

const MAX_HISTORY = 50;

function pushHistory(state: WebsiteEditorState): Partial<WebsiteEditorState> {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(state.blocks)));
  if (newHistory.length > MAX_HISTORY) newHistory.shift();
  return { history: newHistory, historyIndex: newHistory.length - 1, isDirty: true };
}

export const useWebsiteEditorStore = create<WebsiteEditorState>((set, get) => ({
  websiteId: "",
  websiteName: "",
  websiteSlug: "",
  currentPageId: "",
  pages: [],
  blocks: [],
  theme: DEFAULT_THEME,
  navigation: null,
  selectedBlockId: null,
  hoveredBlockId: null,
  devicePreview: "desktop",
  isDirty: false,
  isSaving: false,
  isPublishing: false,
  leftPanel: "blocks",
  rightPanel: "content",
  history: [],
  historyIndex: -1,

  init: (data) => set({
    ...data,
    selectedBlockId: null,
    hoveredBlockId: null,
    isDirty: false,
    history: [JSON.parse(JSON.stringify(data.blocks))],
    historyIndex: 0,
  }),

  selectBlock: (id) => set({ selectedBlockId: id, rightPanel: id ? "content" : get().rightPanel }),
  hoverBlock: (id) => set({ hoveredBlockId: id }),

  addBlock: (type, afterId) => set((state) => {
    const hist = pushHistory(state);
    const newBlock = createBlock(type, 0);
    let blocks: WebsiteBlock[];
    if (afterId) {
      const idx = state.blocks.findIndex((b) => b.id === afterId);
      blocks = [...state.blocks];
      blocks.splice(idx + 1, 0, newBlock);
    } else {
      blocks = [...state.blocks, newBlock];
    }
    blocks = blocks.map((b, i) => ({ ...b, sortOrder: i }));
    return { ...hist, blocks, selectedBlockId: newBlock.id };
  }),

  updateBlock: (id, updates) => set((state) => {
    const hist = pushHistory(state);
    return { ...hist, blocks: state.blocks.map((b) => b.id === id ? { ...b, ...updates } : b) };
  }),

  updateBlockContent: (id, content) => set((state) => {
    const hist = pushHistory(state);
    return {
      ...hist,
      blocks: state.blocks.map((b) =>
        b.id === id ? { ...b, content: { ...b.content, ...content } as BlockContent } : b
      ),
    };
  }),

  updateBlockStyle: (id, style) => set((state) => {
    const hist = pushHistory(state);
    return {
      ...hist,
      blocks: state.blocks.map((b) =>
        b.id === id ? { ...b, style: { ...b.style, ...style } } : b
      ),
    };
  }),

  updateBlockAnimation: (id, animation) => set((state) => {
    const hist = pushHistory(state);
    return {
      ...hist,
      blocks: state.blocks.map((b) =>
        b.id === id ? { ...b, animation: { ...b.animation, ...animation } } : b
      ),
    };
  }),

  deleteBlock: (id) => set((state) => {
    const hist = pushHistory(state);
    const blocks = state.blocks.filter((b) => b.id !== id).map((b, i) => ({ ...b, sortOrder: i }));
    return { ...hist, blocks, selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId };
  }),

  duplicateBlock: (id) => set((state) => {
    const hist = pushHistory(state);
    const idx = state.blocks.findIndex((b) => b.id === id);
    if (idx === -1) return {};
    const original = state.blocks[idx];
    const clone: WebsiteBlock = {
      ...JSON.parse(JSON.stringify(original)),
      id: Math.random().toString(36).substring(2, 11),
    };
    const blocks = [...state.blocks];
    blocks.splice(idx + 1, 0, clone);
    return { ...hist, blocks: blocks.map((b, i) => ({ ...b, sortOrder: i })), selectedBlockId: clone.id };
  }),

  moveBlock: (id, direction) => set((state) => {
    const hist = pushHistory(state);
    const idx = state.blocks.findIndex((b) => b.id === id);
    if (idx === -1) return {};
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= state.blocks.length) return {};
    const blocks = [...state.blocks];
    [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
    return { ...hist, blocks: blocks.map((b, i) => ({ ...b, sortOrder: i })) };
  }),

  reorderBlocks: (activeId, overId) => set((state) => {
    const hist = pushHistory(state);
    const oldIdx = state.blocks.findIndex((b) => b.id === activeId);
    const newIdx = state.blocks.findIndex((b) => b.id === overId);
    if (oldIdx === -1 || newIdx === -1) return {};
    const blocks = [...state.blocks];
    const [moved] = blocks.splice(oldIdx, 1);
    blocks.splice(newIdx, 0, moved);
    return { ...hist, blocks: blocks.map((b, i) => ({ ...b, sortOrder: i })) };
  }),

  switchPage: (pageId, blocks) => set({
    currentPageId: pageId,
    blocks,
    selectedBlockId: null,
    history: [JSON.parse(JSON.stringify(blocks))],
    historyIndex: 0,
    isDirty: false,
  }),

  addPage: (page) => set((state) => ({ pages: [...state.pages, page] })),

  updatePage: (pageId, updates) => set((state) => ({
    pages: state.pages.map((p) => p.id === pageId ? { ...p, ...updates } : p),
  })),

  deletePage: (pageId) => set((state) => ({
    pages: state.pages.filter((p) => p.id !== pageId),
  })),

  updateTheme: (theme) => set((state) => ({
    theme: { ...state.theme, ...theme, colors: { ...state.theme.colors, ...(theme.colors || {}) }, fonts: { ...state.theme.fonts, ...(theme.fonts || {}) } },
    isDirty: true,
  })),

  updateNavigation: (nav) => set((state) => ({
    navigation: state.navigation ? { ...state.navigation, ...nav } : nav as WebsiteNavigation,
    isDirty: true,
  })),

  setDevicePreview: (device) => set({ devicePreview: device }),
  setLeftPanel: (panel) => set({ leftPanel: panel }),
  setRightPanel: (panel) => set({ rightPanel: panel }),

  undo: () => set((state) => {
    if (state.historyIndex <= 0) return {};
    const newIndex = state.historyIndex - 1;
    return {
      blocks: JSON.parse(JSON.stringify(state.history[newIndex])),
      historyIndex: newIndex,
      isDirty: true,
      selectedBlockId: null,
    };
  }),

  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return {};
    const newIndex = state.historyIndex + 1;
    return {
      blocks: JSON.parse(JSON.stringify(state.history[newIndex])),
      historyIndex: newIndex,
      isDirty: true,
      selectedBlockId: null,
    };
  }),

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  save: async () => {
    const state = get();
    if (state.isSaving) return;
    set({ isSaving: true });
    try {
      // Save current page blocks
      await fetch(`/api/websites/${state.websiteId}/pages/${state.currentPageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: JSON.stringify(state.blocks) }),
      });
      // Save website theme + navigation
      await fetch(`/api/websites/${state.websiteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: JSON.stringify(state.theme),
          navigation: JSON.stringify(state.navigation),
        }),
      });
      set({ isDirty: false });
    } catch (err) {
      console.error("Save failed:", err);
    }
    set({ isSaving: false });
  },

  publish: async () => {
    const state = get();
    set({ isPublishing: true });
    try {
      await state.save();
      await fetch(`/api/websites/${state.websiteId}/publish`, { method: "POST" });
    } catch (err) {
      console.error("Publish failed:", err);
    }
    set({ isPublishing: false });
  },

  setDirty: (dirty) => set({ isDirty: dirty }),
}));
