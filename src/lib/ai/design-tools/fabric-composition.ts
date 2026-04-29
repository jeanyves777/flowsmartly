/**
 * Composition graph for the Editable Design Agent.
 *
 * Why this exists: previously the editable engine ran reproduceTemplate
 * (Claude vision) over the agent's flat composite to extract Fabric
 * layers. This was lossy — vision routinely missed photo placeholders,
 * decorative shapes, color panels, sun-rays. The user opened the editor
 * and saw a stripped-down version of the design.
 *
 * Fix: track every layer the agent CONSTRUCTS as it builds the design.
 * Each composition tool (background, photo, text, shape, decorative
 * accent) appends a FabricLayer descriptor to a CompositionGraph. At
 * finalize time the graph IS the canvas spec — lossless.
 *
 * The agent's intent is preserved exactly: nothing has to be inferred
 * from rendered pixels.
 */

export interface FabricCanvasSpec {
  width: number;
  height: number;
  backgroundColor: string;
  objects: Record<string, unknown>[];
}

export type FabricLayer =
  | {
      kind: "background_image";
      /** Data URL or HTTP URL of the bg image. */
      src: string;
    }
  | {
      kind: "background_color";
      color: string;
    }
  | {
      kind: "background_gradient";
      angle: number;
      stops: Array<{ offset: number; color: string }>;
    }
  | {
      kind: "image";
      /** Data URL or HTTP URL. */
      src: string;
      /** Top-left X in canvas px. */
      left: number;
      /** Top-left Y in canvas px. */
      top: number;
      width: number;
      height: number;
      angle?: number;
      opacity?: number;
      /** "user_photo" | "logo" | "qr" | "decorative" — for layer-panel labels. */
      role?: string;
    }
  | {
      kind: "text";
      text: string;
      left: number;
      top: number;
      width: number;
      fontSize: number;
      fontFamily: string;
      fontWeight?: string;
      fontStyle?: string;
      textAlign?: "left" | "center" | "right";
      fill: string;
      lineHeight?: number;
      charSpacing?: number;
      role?: "headline" | "subheadline" | "body" | "cta" | "caption" | "contact" | "brand";
    }
  | {
      kind: "rect";
      left: number;
      top: number;
      width: number;
      height: number;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
      rx?: number;
      ry?: number;
      angle?: number;
      opacity?: number;
    }
  | {
      kind: "circle";
      left: number;
      top: number;
      radius: number;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
    }
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      strokeWidth?: number;
    };

export class CompositionGraph {
  private layers: FabricLayer[] = [];
  private bgColor: string = "#ffffff";

  constructor(public readonly width: number, public readonly height: number) {}

  setBackgroundColor(color: string): void {
    this.bgColor = color;
    // Remove any prior background_* layers; the canvas-level bg replaces them.
    this.layers = this.layers.filter((l) => !l.kind.startsWith("background_"));
  }

  addLayer(layer: FabricLayer): void {
    this.layers.push(layer);
  }

  /** Replace the most recent layer of a given kind. Useful when the
   *  agent regenerates the background — drops the prior bg before
   *  adding the new one. */
  replaceLast(kind: FabricLayer["kind"], layer: FabricLayer): void {
    const idx = this.layers.findIndex((l) => l.kind === kind);
    if (idx >= 0) this.layers.splice(idx, 1);
    this.layers.push(layer);
  }

  size(): number {
    return this.layers.length;
  }

  inventory(): string {
    return this.layers
      .map((l, i) => `${i + 1}. ${l.kind}${"role" in l && l.role ? ` (${l.role})` : ""}`)
      .join(", ");
  }

  /** Build the Fabric canvas spec the editor expects. Mirrors the shape
   *  reproduceTemplate emitted, so downstream save/load works unchanged. */
  toCanvasSpec(): FabricCanvasSpec {
    const objects: Record<string, unknown>[] = [];

    // Render order: backgrounds first (back), then everything in
    // insertion order on top. background_image / background_color /
    // background_gradient apply to the canvas itself or as a full-bleed
    // bottom layer.
    for (const layer of this.layers) {
      switch (layer.kind) {
        case "background_color":
        case "background_gradient":
        case "background_image":
          // handled below as a full-bleed first object
          break;
        case "image":
          objects.push({
            type: "image",
            left: layer.left,
            top: layer.top,
            originX: "left",
            originY: "top",
            width: layer.width,
            height: layer.height,
            scaleX: 1,
            scaleY: 1,
            angle: layer.angle ?? 0,
            opacity: layer.opacity ?? 1,
            src: layer.src,
            customName: layer.role || "image",
          });
          break;
        case "text":
          objects.push({
            type: "textbox",
            text: layer.text,
            left: layer.left,
            top: layer.top,
            width: layer.width,
            originX: "left",
            originY: "top",
            fontSize: layer.fontSize,
            fontFamily: layer.fontFamily,
            fontWeight: layer.fontWeight || "normal",
            fontStyle: layer.fontStyle || "normal",
            textAlign: layer.textAlign || "left",
            fill: layer.fill,
            lineHeight: layer.lineHeight ?? 1.16,
            charSpacing: layer.charSpacing ?? 0,
            editable: true,
            customName: layer.role ? layer.role.charAt(0).toUpperCase() + layer.role.slice(1) : "Text",
          });
          break;
        case "rect":
          objects.push({
            type: "rect",
            left: layer.left,
            top: layer.top,
            width: layer.width,
            height: layer.height,
            originX: "left",
            originY: "top",
            fill: layer.fill,
            stroke: layer.stroke,
            strokeWidth: layer.strokeWidth ?? 0,
            rx: layer.rx ?? 0,
            ry: layer.ry ?? 0,
            angle: layer.angle ?? 0,
            opacity: layer.opacity ?? 1,
          });
          break;
        case "circle":
          objects.push({
            type: "circle",
            left: layer.left,
            top: layer.top,
            radius: layer.radius,
            originX: "left",
            originY: "top",
            fill: layer.fill,
            stroke: layer.stroke,
            strokeWidth: layer.strokeWidth ?? 0,
            opacity: layer.opacity ?? 1,
          });
          break;
        case "line":
          objects.push({
            type: "line",
            x1: layer.x1,
            y1: layer.y1,
            x2: layer.x2,
            y2: layer.y2,
            stroke: layer.stroke,
            strokeWidth: layer.strokeWidth ?? 1,
          });
          break;
      }
    }

    // Backgrounds — emit a full-bleed bottom layer if image/gradient,
    // otherwise the bgColor goes on the canvas itself.
    const bgLayer = this.layers.find((l) =>
      l.kind === "background_image" || l.kind === "background_gradient" || l.kind === "background_color"
    );
    let backgroundColor = this.bgColor;
    const bottomObjects: Record<string, unknown>[] = [];
    if (bgLayer?.kind === "background_image") {
      bottomObjects.push({
        type: "image",
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        width: this.width,
        height: this.height,
        scaleX: 1,
        scaleY: 1,
        selectable: false,
        evented: false,
        src: bgLayer.src,
        customName: "Background",
      });
    } else if (bgLayer?.kind === "background_gradient") {
      bottomObjects.push({
        type: "rect",
        left: 0,
        top: 0,
        width: this.width,
        height: this.height,
        originX: "left",
        originY: "top",
        selectable: false,
        evented: false,
        fill: {
          type: "linear",
          coords: gradientCoords(bgLayer.angle, this.width, this.height),
          colorStops: bgLayer.stops,
        },
      });
    } else if (bgLayer?.kind === "background_color") {
      backgroundColor = bgLayer.color;
    }

    return {
      width: this.width,
      height: this.height,
      backgroundColor,
      objects: [...bottomObjects, ...objects],
    };
  }
}

function gradientCoords(angle: number, w: number, h: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.max(w, h);
  return {
    x1: cx - (Math.cos(rad) * r) / 2,
    y1: cy - (Math.sin(rad) * r) / 2,
    x2: cx + (Math.cos(rad) * r) / 2,
    y2: cy + (Math.sin(rad) * r) / 2,
  };
}
