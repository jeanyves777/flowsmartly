/* eslint-disable @typescript-eslint/no-explicit-any */

let objectIdCounter = 0;

function assignId(obj: any): any {
  obj.id = `obj-${Date.now()}-${objectIdCounter++}`;
  return obj;
}

export function createTextbox(
  fabric: any,
  options?: Record<string, any>
): any {
  const text = new fabric.Textbox("Your text here", {
    left: 100,
    top: 100,
    width: 300,
    fontSize: 32,
    fontFamily: "Inter",
    fill: "#000000",
    editable: true,
    ...options,
  });
  return assignId(text);
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

// Center an object on the canvas
export function centerObject(canvas: any, obj: any) {
  obj.set({
    left: (canvas.width - (obj.width * (obj.scaleX || 1))) / 2,
    top: (canvas.height - (obj.height * (obj.scaleY || 1))) / 2,
  });
  obj.setCoords();
}
