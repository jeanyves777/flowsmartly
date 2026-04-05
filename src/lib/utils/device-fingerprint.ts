/**
 * Client-side browser fingerprint generator.
 * Creates a stable hash from device characteristics — no external libraries.
 * Not a MAC address (browsers can't access that), but a reliable device ID.
 */

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";

    // Draw text with specific styling
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("FlowSmartly.fp", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("FlowSmartly.fp", 4, 17);

    return canvas.toDataURL();
  } catch {
    return "canvas-error";
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "no-webgl";

    const glCtx = gl as WebGLRenderingContext;
    const debugInfo = glCtx.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "no-debug-info";

    const vendor = glCtx.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "";
    const renderer = glCtx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
    return `${vendor}~${renderer}`;
  } catch {
    return "webgl-error";
  }
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  let os = "Unknown";

  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "Mac";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} on ${os}`;
}

export async function generateFingerprint(): Promise<{ hash: string; deviceLabel: string }> {
  const components = [
    // Screen
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    // Timezone
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    // Language
    navigator.language,
    // Platform
    navigator.platform,
    // Hardware concurrency
    String(navigator.hardwareConcurrency || 0),
    // Touch support
    String("ontouchstart" in window),
    String(navigator.maxTouchPoints || 0),
    // Canvas
    getCanvasFingerprint(),
    // WebGL
    getWebGLFingerprint(),
    // Device memory (if available)
    String((navigator as unknown as Record<string, unknown>).deviceMemory || "unknown"),
  ];

  const raw = components.join("|");
  const hash = await sha256(raw);
  const deviceLabel = getDeviceLabel();

  return { hash, deviceLabel };
}
