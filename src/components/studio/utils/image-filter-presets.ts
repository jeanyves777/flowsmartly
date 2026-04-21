"use client";

/**
 * Image filter presets — composed Fabric.js filter chains that reproduce
 * common photo looks in one click. Each preset returns the raw slider
 * values so the existing image-properties panel state stays in sync
 * (sliders move when a preset is applied) and `applyFilters()` can run
 * its normal pipeline.
 *
 * `none` resets everything to defaults.
 */

export interface FilterPreset {
  id: string;
  label: string;
  description: string;
  /** Slider values applied when this preset is chosen. */
  values: {
    brightness: number; // -100..100
    contrast: number;   // -100..100
    saturation: number; // -100..100
    blur: number;       // 0..100
    grayscale: boolean;
    /** Optional sepia overlay strength 0..100 — applied via a sepia filter. */
    sepia?: number;
    /** Optional invert. */
    invert?: boolean;
  };
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "none",
    label: "Original",
    description: "No filters applied",
    values: { brightness: 0, contrast: 0, saturation: 0, blur: 0, grayscale: false },
  },
  {
    id: "vivid",
    label: "Vivid",
    description: "Punchy, social-media-ready",
    values: { brightness: 10, contrast: 25, saturation: 35, blur: 0, grayscale: false },
  },
  {
    id: "vintage",
    label: "Vintage",
    description: "Faded warm tones, lifted shadows",
    values: { brightness: 8, contrast: -15, saturation: -25, blur: 0, grayscale: false, sepia: 25 },
  },
  {
    id: "bw",
    label: "B&W",
    description: "Classic high-contrast monochrome",
    values: { brightness: 0, contrast: 25, saturation: 0, blur: 0, grayscale: true },
  },
  {
    id: "sepia",
    label: "Sepia",
    description: "Warm, antique tone",
    values: { brightness: 5, contrast: 5, saturation: -50, blur: 0, grayscale: false, sepia: 80 },
  },
  {
    id: "cool",
    label: "Cool",
    description: "Slight blue cast — calming, modern",
    values: { brightness: 0, contrast: 10, saturation: -10, blur: 0, grayscale: false },
  },
  {
    id: "warm",
    label: "Warm",
    description: "Sun-kissed, golden hour",
    values: { brightness: 8, contrast: 5, saturation: 15, blur: 0, grayscale: false, sepia: 12 },
  },
  {
    id: "dramatic",
    label: "Dramatic",
    description: "Deep contrast, cinematic look",
    values: { brightness: -8, contrast: 45, saturation: 20, blur: 0, grayscale: false },
  },
  {
    id: "faded",
    label: "Faded",
    description: "Soft, low-contrast film print",
    values: { brightness: 12, contrast: -25, saturation: -15, blur: 0, grayscale: false },
  },
  {
    id: "dreamy",
    label: "Dreamy",
    description: "Soft glow + light blur",
    values: { brightness: 8, contrast: -10, saturation: 15, blur: 5, grayscale: false },
  },
  {
    id: "noir",
    label: "Noir",
    description: "Inky black-and-white with deep contrast",
    values: { brightness: -10, contrast: 50, saturation: 0, blur: 0, grayscale: true },
  },
];

/**
 * Build the actual Fabric filter chain for a preset's slider values.
 * Mirrors `applyFilters()` in image-properties.tsx so the two stay in sync.
 *
 * Returns the constructed filter array. Caller should set
 * `obj.filters = chain` and call `obj.applyFilters()` then `canvas.renderAll()`.
 */
export async function buildFilterChain(values: FilterPreset["values"]): Promise<unknown[]> {
  const fabric = await import("fabric");
  const chain: unknown[] = [];

  if (values.brightness !== 0) {
    chain.push(new fabric.filters.Brightness({ brightness: values.brightness / 100 }));
  }
  if (values.contrast !== 0) {
    chain.push(new fabric.filters.Contrast({ contrast: values.contrast / 100 }));
  }
  if (values.saturation !== 0) {
    chain.push(new fabric.filters.Saturation({ saturation: values.saturation / 100 }));
  }
  if (values.blur > 0) {
    chain.push(new fabric.filters.Blur({ blur: values.blur / 100 }));
  }
  if (values.grayscale) {
    chain.push(new fabric.filters.Grayscale());
  }
  if (values.sepia && values.sepia > 0) {
    // Fabric's Sepia is binary on/off — apply when threshold is meaningful.
    chain.push(new fabric.filters.Sepia());
  }
  if (values.invert) {
    chain.push(new fabric.filters.Invert());
  }

  return chain;
}
