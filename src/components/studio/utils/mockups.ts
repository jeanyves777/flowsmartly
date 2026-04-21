"use client";

/**
 * Mockup renderers — composite the user's design into a polished device/
 * frame mockup using HTML canvas. Each renderer returns a PNG dataURL the
 * caller can show in a preview or trigger a download for.
 *
 * All renderers are programmatic (no asset images) so they degrade
 * gracefully and stay in sync with the brand palette without us having to
 * ship megabytes of mockup PNGs.
 */

export type MockupId =
  | "iphone"
  | "browser"
  | "billboard"
  | "framed-poster"
  | "instagram-post"
  | "tshirt"
  | "mug"
  | "business-card";

export interface MockupOption {
  id: MockupId;
  label: string;
  description: string;
  /** Output canvas size for this mockup. */
  outputSize: { width: number; height: number };
  /** Aspect ratio the user's design should be in for best fit (informational). */
  designRatio: string;
}

export const MOCKUPS: MockupOption[] = [
  {
    id: "iphone",
    label: "iPhone",
    description: "Vertical phone with notch — for stories / portrait designs",
    outputSize: { width: 800, height: 1400 },
    designRatio: "9:16",
  },
  {
    id: "browser",
    label: "Browser",
    description: "Desktop browser window — for landscape banners / hero shots",
    outputSize: { width: 1600, height: 1000 },
    designRatio: "16:10",
  },
  {
    id: "billboard",
    label: "Billboard",
    description: "Outdoor billboard on a city wall — for ads",
    outputSize: { width: 1600, height: 900 },
    designRatio: "16:9",
  },
  {
    id: "framed-poster",
    label: "Framed Poster",
    description: "Framed print on a wall — for posters / portrait posts",
    outputSize: { width: 1000, height: 1300 },
    designRatio: "2:3",
  },
  {
    id: "instagram-post",
    label: "Instagram Post",
    description: "1:1 feed post with IG-style chrome — for social mockups",
    outputSize: { width: 1080, height: 1500 },
    designRatio: "1:1",
  },
  {
    id: "tshirt",
    label: "T-Shirt",
    description: "Centered design on a folded tee — for merch previews",
    outputSize: { width: 1200, height: 1400 },
    designRatio: "1:1",
  },
  {
    id: "mug",
    label: "Coffee Mug",
    description: "Logo wrapped on a ceramic mug — for swag mockups",
    outputSize: { width: 1400, height: 1200 },
    designRatio: "1:1 or wide",
  },
  {
    id: "business-card",
    label: "Business Card",
    description: "Card on a desk with a soft shadow — for brand-id mockups",
    outputSize: { width: 1400, height: 1000 },
    designRatio: "5:3 or wide",
  },
];

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

/** Letterbox-fit the user image inside (sx, sy, sw, sh) preserving aspect ratio. */
function drawFitted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
) {
  const ratio = img.width / img.height;
  const slotRatio = sw / sh;
  let dw = sw;
  let dh = sh;
  if (ratio > slotRatio) {
    // Image is wider — fit to width
    dh = sw / ratio;
  } else {
    dw = sh * ratio;
  }
  const dx = sx + (sw - dw) / 2;
  const dy = sy + (sh - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ─── iPhone (9:16 portrait) ──────────────────────────────────────
async function renderIphone(designUrl: string): Promise<string> {
  const W = 800;
  const H = 1400;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Soft gradient background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#f3f4f6");
  bg.addColorStop(1, "#e5e7eb");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Phone outline — outer body
  const phoneX = 80;
  const phoneY = 80;
  const phoneW = W - 160;
  const phoneH = H - 160;
  const phoneRadius = 70;

  // Drop shadow under phone
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = "#1f2937";
  roundedRect(ctx, phoneX, phoneY, phoneW, phoneH, phoneRadius);
  ctx.fill();
  ctx.restore();

  // Inner bezel frame (subtle inner border)
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 4;
  roundedRect(ctx, phoneX + 8, phoneY + 8, phoneW - 16, phoneH - 16, phoneRadius - 6);
  ctx.stroke();

  // Screen area (clipped)
  const screenInset = 24;
  const screenX = phoneX + screenInset;
  const screenY = phoneY + screenInset;
  const screenW = phoneW - screenInset * 2;
  const screenH = phoneH - screenInset * 2;
  ctx.save();
  roundedRect(ctx, screenX, screenY, screenW, screenH, phoneRadius - 18);
  ctx.clip();

  // Fill screen with white before drawing user image (in case design is transparent)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(screenX, screenY, screenW, screenH);

  const img = await loadImage(designUrl);
  // Fill the screen — crop to the screen aspect to look like a real screenshot
  const imgRatio = img.width / img.height;
  const screenRatio = screenW / screenH;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > screenRatio) {
    // Image wider than screen — crop horizontally
    sw = img.height * screenRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / screenRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, screenX, screenY, screenW, screenH);
  ctx.restore();

  // Notch (modern iPhone "Dynamic Island" style)
  const notchW = 220;
  const notchH = 36;
  const notchX = (W - notchW) / 2;
  const notchY = phoneY + 50;
  ctx.fillStyle = "#000000";
  roundedRect(ctx, notchX, notchY, notchW, notchH, 18);
  ctx.fill();

  return canvas.toDataURL("image/png");
}

// ─── Browser window (16:10 landscape) ────────────────────────────
async function renderBrowser(designUrl: string): Promise<string> {
  const W = 1600;
  const H = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#e0e7ff");
  bg.addColorStop(1, "#c7d2fe");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Browser window frame
  const windowX = 80;
  const windowY = 80;
  const windowW = W - 160;
  const windowH = H - 160;
  const windowRadius = 16;

  // Shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.2)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = "#ffffff";
  roundedRect(ctx, windowX, windowY, windowW, windowH, windowRadius);
  ctx.fill();
  ctx.restore();

  // Title bar
  const tbH = 60;
  ctx.fillStyle = "#f3f4f6";
  ctx.beginPath();
  ctx.moveTo(windowX + windowRadius, windowY);
  ctx.lineTo(windowX + windowW - windowRadius, windowY);
  ctx.arcTo(windowX + windowW, windowY, windowX + windowW, windowY + windowRadius, windowRadius);
  ctx.lineTo(windowX + windowW, windowY + tbH);
  ctx.lineTo(windowX, windowY + tbH);
  ctx.lineTo(windowX, windowY + windowRadius);
  ctx.arcTo(windowX, windowY, windowX + windowRadius, windowY, windowRadius);
  ctx.closePath();
  ctx.fill();

  // Traffic light buttons
  const dotY = windowY + tbH / 2;
  const dotR = 7;
  const colors = ["#ef4444", "#f59e0b", "#10b981"];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(windowX + 24 + i * 24, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // URL bar
  const urlX = windowX + 130;
  const urlY = windowY + 14;
  const urlW = windowW - 260;
  const urlH = tbH - 28;
  ctx.fillStyle = "#ffffff";
  roundedRect(ctx, urlX, urlY, urlW, urlH, 8);
  ctx.fill();
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  roundedRect(ctx, urlX, urlY, urlW, urlH, 8);
  ctx.stroke();
  ctx.fillStyle = "#9ca3af";
  ctx.font = "16px -apple-system, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("https://yourbrand.com", urlX + 16, urlY + urlH / 2);

  // Divider under title bar
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(windowX, windowY + tbH);
  ctx.lineTo(windowX + windowW, windowY + tbH);
  ctx.stroke();

  // Viewport — clipped to bottom-rounded rect
  const vpX = windowX;
  const vpY = windowY + tbH;
  const vpW = windowW;
  const vpH = windowH - tbH;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(vpX, vpY);
  ctx.lineTo(vpX + vpW, vpY);
  ctx.lineTo(vpX + vpW, vpY + vpH - windowRadius);
  ctx.arcTo(vpX + vpW, vpY + vpH, vpX + vpW - windowRadius, vpY + vpH, windowRadius);
  ctx.lineTo(vpX + windowRadius, vpY + vpH);
  ctx.arcTo(vpX, vpY + vpH, vpX, vpY + vpH - windowRadius, windowRadius);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(vpX, vpY, vpW, vpH);

  const img = await loadImage(designUrl);
  // Crop to viewport aspect for a real "screenshot" feel
  const imgRatio = img.width / img.height;
  const vpRatio = vpW / vpH;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > vpRatio) {
    sw = img.height * vpRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / vpRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, vpX, vpY, vpW, vpH);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

// ─── Billboard (16:9) ────────────────────────────────────────────
async function renderBillboard(designUrl: string): Promise<string> {
  const W = 1600;
  const H = 900;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Sky background — dawn / dusk gradient (universally flattering for ads)
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#f59e0b");
  sky.addColorStop(0.5, "#ef4444");
  sky.addColorStop(1, "#1f2937");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Building silhouettes (jagged baseline)
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.moveTo(0, H);
  let x = 0;
  let y = H * 0.65;
  while (x < W) {
    const stepW = 80 + Math.random() * 60;
    const stepH = (H * 0.5) + (Math.random() - 0.5) * 80;
    ctx.lineTo(x, stepH);
    ctx.lineTo(x + stepW, stepH);
    x += stepW;
    y = stepH;
  }
  ctx.lineTo(W, y);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Billboard panel — large rectangle with frame
  const bbW = W * 0.78;
  const bbH = H * 0.55;
  const bbX = (W - bbW) / 2;
  const bbY = H * 0.06;
  // Posts
  ctx.fillStyle = "#374151";
  ctx.fillRect(bbX + bbW * 0.18, bbY + bbH, 16, H - bbY - bbH);
  ctx.fillRect(bbX + bbW * 0.82 - 16, bbY + bbH, 16, H - bbY - bbH);

  // Outer frame
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#111827";
  ctx.fillRect(bbX - 16, bbY - 16, bbW + 32, bbH + 32);
  ctx.restore();

  // Display surface
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bbX, bbY, bbW, bbH);

  // Composite design — fill billboard, crop to its aspect
  ctx.save();
  ctx.beginPath();
  ctx.rect(bbX, bbY, bbW, bbH);
  ctx.clip();
  const img = await loadImage(designUrl);
  const imgRatio = img.width / img.height;
  const bbRatio = bbW / bbH;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > bbRatio) {
    sw = img.height * bbRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / bbRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, bbX, bbY, bbW, bbH);
  ctx.restore();

  // Subtle highlight strip across top of billboard for "lit" look
  const litGrad = ctx.createLinearGradient(0, bbY, 0, bbY + 60);
  litGrad.addColorStop(0, "rgba(255,255,255,0.18)");
  litGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = litGrad;
  ctx.fillRect(bbX, bbY, bbW, 60);

  return canvas.toDataURL("image/png");
}

// ─── Framed poster on a wall ─────────────────────────────────────
async function renderFramedPoster(designUrl: string): Promise<string> {
  const W = 1000;
  const H = 1300;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Wall texture — soft warm gradient
  const wall = ctx.createLinearGradient(0, 0, W, H);
  wall.addColorStop(0, "#e7e5e4");
  wall.addColorStop(1, "#d6d3d1");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);

  // Floor strip at bottom (slight darker tone)
  ctx.fillStyle = "#a8a29e";
  ctx.fillRect(0, H * 0.85, W, H * 0.15);
  // Floor highlight line
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.85);
  ctx.lineTo(W, H * 0.85);
  ctx.stroke();

  // Frame
  const frameW = W * 0.7;
  const frameH = H * 0.65;
  const frameX = (W - frameW) / 2;
  const frameY = H * 0.1;
  const frameThickness = 28;

  // Frame shadow on wall
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#1c1917"; // dark wood frame
  ctx.fillRect(frameX, frameY, frameW, frameH);
  ctx.restore();

  // Inner mat (light cream)
  const matInset = 6;
  ctx.fillStyle = "#fafaf9";
  ctx.fillRect(
    frameX + frameThickness - matInset / 2,
    frameY + frameThickness - matInset / 2,
    frameW - frameThickness * 2 + matInset,
    frameH - frameThickness * 2 + matInset,
  );

  // Print area
  const printX = frameX + frameThickness + 24;
  const printY = frameY + frameThickness + 24;
  const printW = frameW - frameThickness * 2 - 48;
  const printH = frameH - frameThickness * 2 - 48;
  ctx.save();
  ctx.beginPath();
  ctx.rect(printX, printY, printW, printH);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(printX, printY, printW, printH);
  const img = await loadImage(designUrl);
  drawFitted(ctx, img, printX, printY, printW, printH);
  ctx.restore();

  // Subtle inner shadow on print to feel framed (not floating)
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 2;
  ctx.strokeRect(printX, printY, printW, printH);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

// ─── Instagram Post (1:1 image + IG header/footer chrome) ────────
async function renderInstagramPost(designUrl: string): Promise<string> {
  const W = 1080;
  const H = 1500;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Page background
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, W, H);

  // ─── Header bar (avatar + username + ⋯ icon) ───────────────────
  const headerH = 110;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, headerH);

  // Avatar — gradient ring around a white circle
  const avatarCX = 70;
  const avatarCY = headerH / 2;
  const ringR = 32;
  const grad = ctx.createLinearGradient(
    avatarCX - ringR,
    avatarCY - ringR,
    avatarCX + ringR,
    avatarCY + ringR,
  );
  grad.addColorStop(0, "#feda77");
  grad.addColorStop(0.5, "#f58529");
  grad.addColorStop(1, "#dd2a7b");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, ringR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, ringR - 4, 0, Math.PI * 2);
  ctx.fill();
  // Inner gray placeholder
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, ringR - 8, 0, Math.PI * 2);
  ctx.fill();

  // Username
  ctx.fillStyle = "#111827";
  ctx.font = "600 28px -apple-system, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("yourbrand", avatarCX + ringR + 22, avatarCY);

  // ⋯ menu (three dots)
  const dotR = 4;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.arc(W - 50 - i * 20, avatarCY, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Image area (1:1 square) ───────────────────────────────────
  const imageY = headerH;
  const imageSize = W; // 1:1 ratio = full page width
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, imageY, W, imageSize);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, imageY, W, imageSize);

  const img = await loadImage(designUrl);
  // Crop to square — center-fill
  const imgRatio = img.width / img.height;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > 1) {
    sw = img.height;
    sx = (img.width - sw) / 2;
  } else if (imgRatio < 1) {
    sh = img.width;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, imageY, W, imageSize);
  ctx.restore();

  // ─── Action bar (heart, comment, share, bookmark) ──────────────
  const actionY = imageY + imageSize + 36;
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Heart
  const heartX = 40;
  ctx.beginPath();
  ctx.moveTo(heartX, actionY + 10);
  ctx.bezierCurveTo(heartX - 16, actionY - 10, heartX - 16, actionY - 30, heartX, actionY - 16);
  ctx.bezierCurveTo(heartX + 16, actionY - 30, heartX + 16, actionY - 10, heartX, actionY + 10);
  ctx.stroke();

  // Speech bubble (comment) — rounded rect outline
  const cmtX = 110;
  ctx.beginPath();
  ctx.moveTo(cmtX - 18, actionY - 14);
  ctx.lineTo(cmtX + 18, actionY - 14);
  ctx.arcTo(cmtX + 22, actionY - 14, cmtX + 22, actionY - 10, 4);
  ctx.lineTo(cmtX + 22, actionY + 4);
  ctx.arcTo(cmtX + 22, actionY + 8, cmtX + 18, actionY + 8, 4);
  ctx.lineTo(cmtX, actionY + 8);
  ctx.lineTo(cmtX - 8, actionY + 16);
  ctx.lineTo(cmtX - 8, actionY + 8);
  ctx.lineTo(cmtX - 18, actionY + 8);
  ctx.arcTo(cmtX - 22, actionY + 8, cmtX - 22, actionY + 4, 4);
  ctx.lineTo(cmtX - 22, actionY - 10);
  ctx.arcTo(cmtX - 22, actionY - 14, cmtX - 18, actionY - 14, 4);
  ctx.stroke();

  // Share (paper-airplane triangle)
  const shrX = 180;
  ctx.beginPath();
  ctx.moveTo(shrX - 22, actionY - 6);
  ctx.lineTo(shrX + 22, actionY - 14);
  ctx.lineTo(shrX - 4, actionY + 14);
  ctx.lineTo(shrX - 8, actionY - 2);
  ctx.closePath();
  ctx.stroke();

  // Bookmark (right-aligned)
  const bmkX = W - 40;
  ctx.beginPath();
  ctx.moveTo(bmkX - 12, actionY - 14);
  ctx.lineTo(bmkX + 12, actionY - 14);
  ctx.lineTo(bmkX + 12, actionY + 16);
  ctx.lineTo(bmkX, actionY + 4);
  ctx.lineTo(bmkX - 12, actionY + 16);
  ctx.closePath();
  ctx.stroke();

  // Likes count
  ctx.fillStyle = "#111827";
  ctx.font = "600 24px -apple-system, system-ui, sans-serif";
  ctx.fillText("1,247 likes", 40, actionY + 60);

  return canvas.toDataURL("image/png");
}

// ─── T-Shirt mockup ──────────────────────────────────────────────
async function renderTshirt(designUrl: string): Promise<string> {
  const W = 1200;
  const H = 1400;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background (soft photographer's seamless gray)
  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W);
  bg.addColorStop(0, "#f5f5f4");
  bg.addColorStop(1, "#d6d3d1");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Shirt body — outline of a simple folded tee
  // Coordinates relative to center of shirt
  const cx = W / 2;
  const shirtTop = 220;
  const shirtBottom = H - 100;
  const shoulderHalfW = 470;
  const collarHalfW = 95;
  const collarBottomY = shirtTop + 110;
  const sleeveBottomY = shirtTop + 280;
  const sleeveOutHalfW = 540;
  const torsoHalfW = 360;
  const hemHalfW = 380;

  // Shirt color — neutral white tee (most common merch base)
  const shirtFill = "#fafafa";

  // Drop shadow under shirt
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = shirtFill;
  ctx.beginPath();
  // Start at left collar
  ctx.moveTo(cx - collarHalfW, shirtTop);
  // Up to left shoulder
  ctx.lineTo(cx - shoulderHalfW, shirtTop + 30);
  // Down to left sleeve outer corner
  ctx.lineTo(cx - sleeveOutHalfW, sleeveBottomY - 60);
  // Sleeve hem
  ctx.lineTo(cx - sleeveOutHalfW + 30, sleeveBottomY);
  // In to torso left side
  ctx.lineTo(cx - torsoHalfW, sleeveBottomY + 20);
  // Down to left hem
  ctx.lineTo(cx - hemHalfW, shirtBottom);
  // Across hem
  ctx.lineTo(cx + hemHalfW, shirtBottom);
  // Up to right torso
  ctx.lineTo(cx + torsoHalfW, sleeveBottomY + 20);
  // Out to right sleeve
  ctx.lineTo(cx + sleeveOutHalfW - 30, sleeveBottomY);
  // Up to right sleeve outer corner
  ctx.lineTo(cx + sleeveOutHalfW, sleeveBottomY - 60);
  // Up to right shoulder
  ctx.lineTo(cx + shoulderHalfW, shirtTop + 30);
  // To right collar
  ctx.lineTo(cx + collarHalfW, shirtTop);
  // Collar dip (curved)
  ctx.bezierCurveTo(
    cx + collarHalfW - 20, collarBottomY,
    cx - collarHalfW + 20, collarBottomY,
    cx - collarHalfW, shirtTop,
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Shirt outline (subtle stroke for definition)
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Subtle shading on the sides for fold/curvature
  const sideShade = ctx.createLinearGradient(cx - hemHalfW, 0, cx + hemHalfW, 0);
  sideShade.addColorStop(0, "rgba(0,0,0,0.07)");
  sideShade.addColorStop(0.15, "rgba(0,0,0,0)");
  sideShade.addColorStop(0.85, "rgba(0,0,0,0)");
  sideShade.addColorStop(1, "rgba(0,0,0,0.07)");
  ctx.fillStyle = sideShade;
  ctx.fill(); // re-uses the open shirt path

  // Print area — large square in upper torso. Designs are letterboxed
  // (no crop) so logos and centered marks aren't chopped off.
  const printSize = 480;
  const printX = cx - printSize / 2;
  const printY = collarBottomY + 40;
  const img = await loadImage(designUrl);
  drawFitted(ctx, img, printX, printY, printSize, printSize);

  return canvas.toDataURL("image/png");
}

// ─── Coffee mug ──────────────────────────────────────────────────
async function renderMug(designUrl: string): Promise<string> {
  const W = 1400;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Wood / desk surface gradient — warm beige top to deeper bottom
  const desk = ctx.createLinearGradient(0, 0, 0, H);
  desk.addColorStop(0, "#fef3c7");
  desk.addColorStop(0.55, "#fde68a");
  desk.addColorStop(1, "#d97706");
  ctx.fillStyle = desk;
  ctx.fillRect(0, 0, W, H);

  // Mug body — rounded rectangle with subtle vertical curvature shading
  const mugW = 580;
  const mugH = 660;
  const mugX = (W - mugW) / 2 - 60; // shift left so handle on right looks balanced
  const mugY = (H - mugH) / 2;
  const mugRadius = 24;

  // Mug shadow on desk
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 24;

  // Handle (drawn first behind the body)
  const handleCX = mugX + mugW + 70;
  const handleCY = mugY + mugH * 0.5;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(handleCX, handleCY, 130, -Math.PI * 0.65, Math.PI * 0.65);
  ctx.lineTo(handleCX - 60, handleCY + 90);
  ctx.arc(handleCX, handleCY, 70, Math.PI * 0.65, -Math.PI * 0.65, true);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.fillStyle = "#ffffff";
  roundedRect(ctx, mugX, mugY, mugW, mugH, mugRadius);
  ctx.fill();
  ctx.restore();

  // Vertical curvature shading on body — left edge dark, right edge dark, center bright
  const curve = ctx.createLinearGradient(mugX, 0, mugX + mugW, 0);
  curve.addColorStop(0, "rgba(0,0,0,0.18)");
  curve.addColorStop(0.18, "rgba(0,0,0,0)");
  curve.addColorStop(0.82, "rgba(0,0,0,0)");
  curve.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.save();
  roundedRect(ctx, mugX, mugY, mugW, mugH, mugRadius);
  ctx.clip();
  ctx.fillStyle = curve;
  ctx.fillRect(mugX, mugY, mugW, mugH);
  ctx.restore();

  // Top opening — dark elliptical band hint of the inside
  ctx.fillStyle = "#3c2415";
  ctx.beginPath();
  ctx.ellipse(mugX + mugW / 2, mugY + 14, mugW / 2 - 8, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Lip highlight
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(mugX + mugW / 2, mugY + 14, mugW / 2 - 8, 18, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Print area — center the design in the visible front of the mug
  const printW = mugW * 0.66;
  const printH = mugH * 0.55;
  const printX = mugX + (mugW - printW) / 2;
  const printY = mugY + (mugH - printH) / 2 + 20;

  ctx.save();
  // Clip to body so design doesn't bleed past edges
  roundedRect(ctx, mugX, mugY, mugW, mugH, mugRadius);
  ctx.clip();
  const img = await loadImage(designUrl);
  drawFitted(ctx, img, printX, printY, printW, printH);
  // Re-apply curvature shading on top of the design too so it feels wrapped
  ctx.fillStyle = curve;
  ctx.fillRect(mugX, mugY, mugW, mugH);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

// ─── Business card on a desk ─────────────────────────────────────
async function renderBusinessCard(designUrl: string): Promise<string> {
  const W = 1400;
  const H = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Desk surface — warm gray paper texture gradient
  const desk = ctx.createLinearGradient(0, 0, W, H);
  desk.addColorStop(0, "#f5f5f4");
  desk.addColorStop(1, "#a8a29e");
  ctx.fillStyle = desk;
  ctx.fillRect(0, 0, W, H);

  // Two cards — front (foreground, slight tilt right) + back (behind, tilt left)
  const cardW = 720; // standard 3.5" * scale (proportions match a real business card)
  const cardH = 420;
  const radius = 14;

  // ─── Back card (behind, slight left tilt) ───
  ctx.save();
  ctx.translate(W * 0.32, H * 0.4);
  ctx.rotate(-0.08);
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  // Solid back face — dark neutral
  ctx.fillStyle = "#1f2937";
  roundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, radius);
  ctx.fill();
  ctx.restore();

  // Subtle back-card detail (tiny logo dot in center) — re-paint without shadow
  ctx.save();
  ctx.translate(W * 0.32, H * 0.4);
  ctx.rotate(-0.08);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ─── Front card (foreground, slight right tilt, with the user's design) ───
  ctx.save();
  ctx.translate(W * 0.6, H * 0.55);
  ctx.rotate(0.06);
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#ffffff";
  roundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, radius);
  ctx.fill();
  ctx.restore();

  // Composite design onto front card — re-do the same transform without shadow,
  // clip to the rounded rect so the design respects the corner radius.
  ctx.save();
  ctx.translate(W * 0.6, H * 0.55);
  ctx.rotate(0.06);
  roundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, radius);
  ctx.clip();
  // White inner background in case design has transparency
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
  const img = await loadImage(designUrl);
  // Letterbox-fit the design — business cards are landscape, often a logo + text
  drawFitted(ctx, img, -cardW / 2, -cardH / 2, cardW, cardH);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

export async function renderMockup(mockupId: MockupId, designUrl: string): Promise<string> {
  switch (mockupId) {
    case "iphone":
      return renderIphone(designUrl);
    case "browser":
      return renderBrowser(designUrl);
    case "billboard":
      return renderBillboard(designUrl);
    case "framed-poster":
      return renderFramedPoster(designUrl);
    case "instagram-post":
      return renderInstagramPost(designUrl);
    case "tshirt":
      return renderTshirt(designUrl);
    case "mug":
      return renderMug(designUrl);
    case "business-card":
      return renderBusinessCard(designUrl);
  }
}
