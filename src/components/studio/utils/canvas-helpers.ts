/* eslint-disable @typescript-eslint/no-explicit-any */

let objectIdCounter = 0;

function assignId(obj: any): any {
  obj.id = `obj-${Date.now()}-${objectIdCounter++}`;
  return obj;
}

/**
 * Strip viewportTransform from canvas JSON before loading.
 * Fabric.js loadFromJSON restores the saved viewportTransform, which can
 * re-introduce a shifted viewport from old saves. We handle zoom/pan via CSS,
 * so the Fabric.js viewport must always be identity [1,0,0,1,0,0].
 */
export function stripViewportFromJSON(json: string | object): string {
  try {
    const parsed = typeof json === "string" ? JSON.parse(json) : { ...json };
    delete parsed.viewportTransform;
    return JSON.stringify(parsed);
  } catch {
    return typeof json === "string" ? json : JSON.stringify(json);
  }
}

/**
 * Safe wrapper around canvas.loadFromJSON that strips viewport and resets it after load.
 */
export async function safeLoadFromJSON(canvas: any, json: string | object): Promise<void> {
  const cleanJSON = stripViewportFromJSON(json);
  await canvas.loadFromJSON(cleanJSON);
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.renderAll();
}

/**
 * Lock the canvas viewport to identity. Call this after creating the canvas.
 * Overrides setViewportTransform so nothing can shift the viewport.
 */
export function lockViewportTransform(canvas: any): void {
  const identity = [1, 0, 0, 1, 0, 0];
  canvas.setViewportTransform(identity);
  canvas.viewportTransform = identity;
  // Override so any future calls (including from loadFromJSON) are no-ops
  canvas.setViewportTransform = () => {
    canvas.viewportTransform = identity;
  };
}

export function createTextbox(
  fabric: any,
  options?: Record<string, any>
): any {
  // Fabric.js Textbox takes text content as first positional arg
  const textContent = options?.text || "Your text here";
  const { text: _text, ...restOptions } = options || {};
  const obj = new fabric.Textbox(textContent, {
    left: 100,
    top: 100,
    originX: "left",
    originY: "top",
    width: 300,
    fontSize: 32,
    fontFamily: "Inter",
    fill: "#000000",
    editable: true,
    ...restOptions,
  });
  return assignId(obj);
}

export function createHeading(
  fabric: any,
  options?: Record<string, any>
): any {
  return createTextbox(fabric, {
    fontSize: 48,
    fontWeight: "bold",
    text: "Heading",
    width: 400,
    ...options,
  });
}

export function createSubheading(
  fabric: any,
  options?: Record<string, any>
): any {
  return createTextbox(fabric, {
    fontSize: 32,
    fontWeight: "600",
    text: "Subheading",
    width: 350,
    ...options,
  });
}

export function createBody(
  fabric: any,
  options?: Record<string, any>
): any {
  return createTextbox(fabric, {
    fontSize: 18,
    fontWeight: "normal",
    text: "Body text goes here. Click to edit.",
    width: 300,
    ...options,
  });
}

export function createRect(
  fabric: any,
  options?: Record<string, any>
): any {
  const rect = new fabric.Rect({
    left: 100,
    top: 100,
    originX: "left",
    originY: "top",
    width: 200,
    height: 200,
    fill: "#3b82f6",
    rx: 8,
    ry: 8,
    ...options,
  });
  return assignId(rect);
}

export function createCircle(
  fabric: any,
  options?: Record<string, any>
): any {
  const circle = new fabric.Circle({
    left: 100,
    top: 100,
    originX: "left",
    originY: "top",
    radius: 100,
    fill: "#8b5cf6",
    ...options,
  });
  return assignId(circle);
}

export function createTriangle(
  fabric: any,
  options?: Record<string, any>
): any {
  const triangle = new fabric.Triangle({
    left: 100,
    top: 100,
    originX: "left",
    originY: "top",
    width: 200,
    height: 200,
    fill: "#f59e0b",
    ...options,
  });
  return assignId(triangle);
}

export function createLine(
  fabric: any,
  points?: number[],
  options?: Record<string, any>
): any {
  const line = new fabric.Line(points || [50, 50, 300, 50], {
    stroke: "#000000",
    strokeWidth: 3,
    originX: "left",
    originY: "top",
    ...options,
  });
  return assignId(line);
}

export function createStar(
  fabric: any,
  options?: Record<string, any>
): any {
  const points = 5;
  const outerR = 100;
  const innerR = 45;
  const coords: { x: number; y: number }[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
  }
  const star = new fabric.Polygon(coords, {
    left: 100,
    top: 100,
    originX: "left",
    originY: "top",
    fill: "#ef4444",
    ...options,
  });
  return assignId(star);
}

export function createArrow(
  fabric: any,
  options?: Record<string, any>
): any {
  const line = new fabric.Line([0, 0, 200, 0], {
    stroke: "#000000",
    strokeWidth: 3,
    ...options,
  });
  // Arrow head as a triangle
  const head = new fabric.Triangle({
    width: 20,
    height: 20,
    fill: options?.stroke || "#000000",
    left: 200,
    top: -10,
    angle: 90,
  });
  const group = new fabric.Group([line, head], {
    left: 100,
    top: 100,
    originX: "left",
    originY: "top",
  });
  return assignId(group);
}

/** Build a regular polygon (pentagon, hexagon, octagon, etc.) of `sides` */
function regularPolygon(sides: number, radius = 80): { x: number; y: number }[] {
  const coords: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    coords.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  }
  return coords;
}

export function createPentagon(fabric: any, options?: Record<string, any>): any {
  const poly = new fabric.Polygon(regularPolygon(5), {
    left: 100,
    top: 100,
    fill: "#10b981",
    originX: "left",
    originY: "top",
    ...options,
  });
  return assignId(poly);
}

export function createHexagon(fabric: any, options?: Record<string, any>): any {
  const poly = new fabric.Polygon(regularPolygon(6), {
    left: 100,
    top: 100,
    fill: "#06b6d4",
    originX: "left",
    originY: "top",
    ...options,
  });
  return assignId(poly);
}

export function createOctagon(fabric: any, options?: Record<string, any>): any {
  const poly = new fabric.Polygon(regularPolygon(8), {
    left: 100,
    top: 100,
    fill: "#a855f7",
    originX: "left",
    originY: "top",
    ...options,
  });
  return assignId(poly);
}

export function createDiamond(fabric: any, options?: Record<string, any>): any {
  // 90° rotated square — looks correct as a polygon
  const poly = new fabric.Polygon(
    [
      { x: 0, y: -80 },
      { x: 80, y: 0 },
      { x: 0, y: 80 },
      { x: -80, y: 0 },
    ],
    {
      left: 100,
      top: 100,
      fill: "#f59e0b",
      originX: "left",
      originY: "top",
      ...options,
    },
  );
  return assignId(poly);
}

export function createHeart(fabric: any, options?: Record<string, any>): any {
  // Classic SVG heart path — scales naturally
  const path = new fabric.Path(
    "M 272.70141,238.71731 C 206.46141,238.71731 152.70146,292.4773 152.70146,358.71731 C 152.70146,493.47282 288.63461,528.80461 381.26391,662.02535 C 468.83815,529.62199 609.82641,489.17075 609.82641,358.71731 C 609.82641,292.47731 556.06651,238.7173 489.82641,238.71731 C 441.77851,238.71731 400.42481,267.08774 381.26391,307.90481 C 362.10311,267.08773 320.74941,238.7173 272.70141,238.71731 z",
    {
      left: 100,
      top: 100,
      fill: "#ec4899",
      originX: "left",
      originY: "top",
      scaleX: 0.25,
      scaleY: 0.25,
      ...options,
    },
  );
  return assignId(path);
}

export function createPlusIcon(fabric: any, options?: Record<string, any>): any {
  // Plus made of two crossed rectangles, grouped
  const horiz = new fabric.Rect({ left: 0, top: 60, width: 160, height: 40, fill: "#ef4444" });
  const vert = new fabric.Rect({ left: 60, top: 0, width: 40, height: 160, fill: "#ef4444" });
  const group = new fabric.Group([horiz, vert], {
    left: 100,
    top: 100,
    originX: "left",
    originY: "top",
    ...options,
  });
  return assignId(group);
}

export function createSpeechBubble(fabric: any, options?: Record<string, any>): any {
  // Rounded rect body + small triangle tail, grouped
  const body = new fabric.Rect({
    left: 0,
    top: 0,
    width: 220,
    height: 130,
    rx: 18,
    ry: 18,
    fill: "#3b82f6",
  });
  const tail = new fabric.Polygon(
    [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 6, y: 32 },
    ],
    { left: 40, top: 130, fill: "#3b82f6" },
  );
  const group = new fabric.Group([body, tail], {
    left: 100,
    top: 100,
    originX: "left",
    originY: "top",
    ...options,
  });
  return assignId(group);
}

export function createBurst(fabric: any, options?: Record<string, any>): any {
  // 12-point starburst — great for "SALE" / promo callouts
  const points = 12;
  const outerR = 100;
  const innerR = 72;
  const coords: { x: number; y: number }[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
  }
  const burst = new fabric.Polygon(coords, {
    left: 100,
    top: 100,
    fill: "#f59e0b",
    originX: "left",
    originY: "top",
    ...options,
  });
  return assignId(burst);
}

export function createDoubleArrow(fabric: any, options?: Record<string, any>): any {
  const line = new fabric.Line([20, 0, 200, 0], {
    stroke: "#000000",
    strokeWidth: 3,
    ...options,
  });
  const headRight = new fabric.Triangle({
    width: 22,
    height: 22,
    fill: options?.stroke || "#000000",
    left: 200,
    top: -11,
    angle: 90,
  });
  const headLeft = new fabric.Triangle({
    width: 22,
    height: 22,
    fill: options?.stroke || "#000000",
    left: 20,
    top: -11,
    angle: -90,
  });
  const group = new fabric.Group([line, headLeft, headRight], {
    left: 100,
    top: 100,
    originX: "left",
    originY: "top",
  });
  return assignId(group);
}

export async function addImageToCanvas(
  canvas: any,
  url: string,
  fabric: any,
  options?: Record<string, any>
): Promise<any> {
  try {
    // Proxy external URLs through our image proxy to avoid CORS issues
    // with presigned S3 URLs and other cross-origin sources
    let safeUrl = url;
    if (typeof window !== "undefined" && url.startsWith("http") && !url.startsWith(window.location.origin)) {
      safeUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }

    const fabricImg = await fabric.FabricImage.fromURL(safeUrl, { crossOrigin: "anonymous" });
    if (!fabricImg || !fabricImg.width || !fabricImg.height) {
      throw new Error("Image loaded but has no dimensions — likely a CORS or network failure");
    }

    fabricImg.set({
      left: 50,
      top: 50,
      originX: "left",
      originY: "top",
      ...options,
    });

    // Scale to fit within 80% of canvas bounds
    const maxW = canvas.width * 0.8;
    const maxH = canvas.height * 0.8;
    const imgW = fabricImg.width || 1;
    const imgH = fabricImg.height || 1;
    if (imgW > maxW || imgH > maxH) {
      const scale = Math.min(maxW / imgW, maxH / imgH);
      fabricImg.scale(scale);
    }

    assignId(fabricImg);
    (fabricImg as any).customName = "Image";
    canvas.add(fabricImg);
    canvas.setActiveObject(fabricImg);
    canvas.renderAll();
    return fabricImg;
  } catch (err) {
    console.error("addImageToCanvas failed:", url, err);
    throw err;
  }
}

// Center an object on the canvas (handles both 'left' and 'center' origin)
export function centerObject(canvas: any, obj: any) {
  const w = obj.width * (obj.scaleX || 1);
  const h = obj.height * (obj.scaleY || 1);
  if (obj.originX === "center") {
    obj.set({ left: canvas.width / 2 });
  } else {
    obj.set({ left: (canvas.width - w) / 2 });
  }
  if (obj.originY === "center") {
    obj.set({ top: canvas.height / 2 });
  } else {
    obj.set({ top: (canvas.height - h) / 2 });
  }
  obj.setCoords();
}
