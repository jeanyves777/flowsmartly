/**
 * Programmatic Canvas Background Generator
 *
 * Generates simple scene backgrounds using @napi-rs/canvas.
 * No AI, no API calls, no credits — instant generation.
 *
 * Parses keywords from scene visualDescription to select a scene renderer,
 * then draws a matching background with simple shapes, gradients, and colors.
 */

import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";

type Ctx = SKRSContext2D;

const WIDTH = 1536;
const HEIGHT = 1024;

type SceneType =
  | "park"
  | "forest"
  | "room"
  | "city"
  | "beach"
  | "school"
  | "space"
  | "underwater"
  | "mountain"
  | "night"
  | "default";

/**
 * Detect the scene type from a visual description string.
 */
function detectSceneType(description: string): SceneType {
  const lower = description.toLowerCase();

  if (lower.includes("beach") || lower.includes("ocean") || lower.includes("shore") || lower.includes("sand")) return "beach";
  if (lower.includes("forest") || lower.includes("jungle") || lower.includes("woods")) return "forest";
  if (lower.includes("park") || lower.includes("garden") || lower.includes("field") || lower.includes("meadow") || lower.includes("grass")) return "park";
  if (lower.includes("city") || lower.includes("street") || lower.includes("urban") || lower.includes("downtown")) return "city";
  if (lower.includes("room") || lower.includes("house") || lower.includes("kitchen") || lower.includes("bedroom") || lower.includes("living") || lower.includes("office") || lower.includes("indoor")) return "room";
  if (lower.includes("school") || lower.includes("classroom") || lower.includes("library")) return "school";
  if (lower.includes("space") || lower.includes("galaxy") || lower.includes("planet") || lower.includes("star")) return "space";
  if (lower.includes("underwater") || lower.includes("sea") || lower.includes("coral") || lower.includes("fish")) return "underwater";
  if (lower.includes("mountain") || lower.includes("hill") || lower.includes("cliff") || lower.includes("peak")) return "mountain";
  if (lower.includes("night") || lower.includes("dark") || lower.includes("moon") || lower.includes("evening")) return "night";

  return "default";
}

// --- Scene Renderers ---

function renderPark(ctx: Ctx): void {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.6);
  skyGrad.addColorStop(0, "#87CEEB");
  skyGrad.addColorStop(1, "#C3E8F7");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.6);

  // Sun
  ctx.fillStyle = "#FFE066";
  ctx.beginPath();
  ctx.arc(WIDTH * 0.8, HEIGHT * 0.15, 60, 0, Math.PI * 2);
  ctx.fill();

  // Clouds
  drawCloud(ctx, WIDTH * 0.2, HEIGHT * 0.12, 80);
  drawCloud(ctx, WIDTH * 0.55, HEIGHT * 0.08, 60);

  // Ground gradient
  const groundGrad = ctx.createLinearGradient(0, HEIGHT * 0.55, 0, HEIGHT);
  groundGrad.addColorStop(0, "#7BC67E");
  groundGrad.addColorStop(1, "#4A8B4F");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, HEIGHT * 0.55, WIDTH, HEIGHT * 0.45);

  // Path
  ctx.fillStyle = "#D4B896";
  ctx.beginPath();
  ctx.moveTo(WIDTH * 0.4, HEIGHT);
  ctx.quadraticCurveTo(WIDTH * 0.45, HEIGHT * 0.7, WIDTH * 0.5, HEIGHT * 0.55);
  ctx.quadraticCurveTo(WIDTH * 0.55, HEIGHT * 0.7, WIDTH * 0.6, HEIGHT);
  ctx.fill();

  // Trees
  drawTree(ctx, WIDTH * 0.1, HEIGHT * 0.55, 80);
  drawTree(ctx, WIDTH * 0.85, HEIGHT * 0.52, 90);
  drawTree(ctx, WIDTH * 0.15, HEIGHT * 0.57, 60);
}

function renderForest(ctx: Ctx): void {
  // Dark sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.5);
  skyGrad.addColorStop(0, "#5B8A72");
  skyGrad.addColorStop(1, "#3D6B52");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Ground
  const groundGrad = ctx.createLinearGradient(0, HEIGHT * 0.6, 0, HEIGHT);
  groundGrad.addColorStop(0, "#2D5A3D");
  groundGrad.addColorStop(1, "#1A3A25");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, HEIGHT * 0.6, WIDTH, HEIGHT * 0.4);

  // Background trees (far)
  for (let i = 0; i < 8; i++) {
    const x = (i / 8) * WIDTH + WIDTH * 0.05;
    drawPineTree(ctx, x, HEIGHT * 0.35, 120, "#2D6B45");
  }

  // Foreground trees (near, larger)
  drawPineTree(ctx, WIDTH * 0.05, HEIGHT * 0.45, 180, "#1F5733");
  drawPineTree(ctx, WIDTH * 0.9, HEIGHT * 0.42, 200, "#1F5733");

  // Light rays
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#FFE066";
  ctx.beginPath();
  ctx.moveTo(WIDTH * 0.4, 0);
  ctx.lineTo(WIDTH * 0.35, HEIGHT);
  ctx.lineTo(WIDTH * 0.5, HEIGHT);
  ctx.lineTo(WIDTH * 0.45, 0);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function renderRoom(ctx: Ctx): void {
  // Wall
  ctx.fillStyle = "#F5E6D3";
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.65);

  // Floor
  const floorGrad = ctx.createLinearGradient(0, HEIGHT * 0.65, 0, HEIGHT);
  floorGrad.addColorStop(0, "#C4A882");
  floorGrad.addColorStop(1, "#A08060");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, HEIGHT * 0.65, WIDTH, HEIGHT * 0.35);

  // Baseboard
  ctx.fillStyle = "#8B7355";
  ctx.fillRect(0, HEIGHT * 0.63, WIDTH, HEIGHT * 0.04);

  // Window
  ctx.fillStyle = "#87CEEB";
  ctx.fillRect(WIDTH * 0.35, HEIGHT * 0.1, WIDTH * 0.3, HEIGHT * 0.35);
  // Window frame
  ctx.strokeStyle = "#8B7355";
  ctx.lineWidth = 6;
  ctx.strokeRect(WIDTH * 0.35, HEIGHT * 0.1, WIDTH * 0.3, HEIGHT * 0.35);
  // Window cross
  ctx.beginPath();
  ctx.moveTo(WIDTH * 0.5, HEIGHT * 0.1);
  ctx.lineTo(WIDTH * 0.5, HEIGHT * 0.45);
  ctx.moveTo(WIDTH * 0.35, HEIGHT * 0.275);
  ctx.lineTo(WIDTH * 0.65, HEIGHT * 0.275);
  ctx.stroke();

  // Curtains
  ctx.fillStyle = "#E8B4B8";
  ctx.fillRect(WIDTH * 0.3, HEIGHT * 0.07, WIDTH * 0.06, HEIGHT * 0.42);
  ctx.fillRect(WIDTH * 0.64, HEIGHT * 0.07, WIDTH * 0.06, HEIGHT * 0.42);

  // Picture frame on wall
  ctx.fillStyle = "#C4A882";
  ctx.fillRect(WIDTH * 0.75, HEIGHT * 0.15, WIDTH * 0.12, HEIGHT * 0.18);
  ctx.strokeStyle = "#8B7355";
  ctx.lineWidth = 4;
  ctx.strokeRect(WIDTH * 0.75, HEIGHT * 0.15, WIDTH * 0.12, HEIGHT * 0.18);
}

function renderCity(ctx: Ctx): void {
  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.6);
  skyGrad.addColorStop(0, "#6CA6CD");
  skyGrad.addColorStop(1, "#B0D4F1");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Clouds
  drawCloud(ctx, WIDTH * 0.15, HEIGHT * 0.1, 70);
  drawCloud(ctx, WIDTH * 0.7, HEIGHT * 0.05, 50);

  // Buildings (background)
  const buildings = [
    { x: 0.02, w: 0.1, h: 0.4, color: "#8899AA" },
    { x: 0.13, w: 0.08, h: 0.55, color: "#7788A0" },
    { x: 0.22, w: 0.12, h: 0.35, color: "#99AAB8" },
    { x: 0.36, w: 0.06, h: 0.6, color: "#6677AA" },
    { x: 0.44, w: 0.1, h: 0.45, color: "#8899BB" },
    { x: 0.56, w: 0.08, h: 0.5, color: "#7788AA" },
    { x: 0.66, w: 0.12, h: 0.38, color: "#99AABB" },
    { x: 0.8, w: 0.07, h: 0.58, color: "#6688AA" },
    { x: 0.88, w: 0.12, h: 0.42, color: "#8899AA" },
  ];

  for (const b of buildings) {
    const bx = b.x * WIDTH;
    const bw = b.w * WIDTH;
    const bh = b.h * HEIGHT;
    const by = HEIGHT * 0.65 - bh;

    ctx.fillStyle = b.color;
    ctx.fillRect(bx, by, bw, bh);

    // Windows
    ctx.fillStyle = "#FFE066";
    const winSize = 8;
    const winGap = 16;
    for (let wy = by + 15; wy < by + bh - 15; wy += winGap) {
      for (let wx = bx + 10; wx < bx + bw - 10; wx += winGap) {
        if (Math.random() > 0.3) {
          ctx.fillRect(wx, wy, winSize, winSize);
        }
      }
    }
  }

  // Road
  ctx.fillStyle = "#555555";
  ctx.fillRect(0, HEIGHT * 0.65, WIDTH, HEIGHT * 0.35);
  // Road markings
  ctx.fillStyle = "#FFFF00";
  for (let i = 0; i < WIDTH; i += 60) {
    ctx.fillRect(i, HEIGHT * 0.82, 30, 4);
  }
  // Sidewalk
  ctx.fillStyle = "#999999";
  ctx.fillRect(0, HEIGHT * 0.65, WIDTH, HEIGHT * 0.05);
}

function renderBeach(ctx: Ctx): void {
  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.45);
  skyGrad.addColorStop(0, "#4FC3F7");
  skyGrad.addColorStop(1, "#81D4FA");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.45);

  // Sun
  ctx.fillStyle = "#FFE082";
  ctx.beginPath();
  ctx.arc(WIDTH * 0.75, HEIGHT * 0.12, 50, 0, Math.PI * 2);
  ctx.fill();

  // Ocean
  const oceanGrad = ctx.createLinearGradient(0, HEIGHT * 0.35, 0, HEIGHT * 0.55);
  oceanGrad.addColorStop(0, "#1E88E5");
  oceanGrad.addColorStop(1, "#42A5F5");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, HEIGHT * 0.35, WIDTH, HEIGHT * 0.2);

  // Waves
  ctx.strokeStyle = "#BBDEFB";
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const y = HEIGHT * 0.4 + i * 25;
    for (let x = 0; x < WIDTH; x += 20) {
      ctx.lineTo(x, y + Math.sin(x / 40 + i) * 5);
    }
    ctx.stroke();
  }

  // Sand
  const sandGrad = ctx.createLinearGradient(0, HEIGHT * 0.55, 0, HEIGHT);
  sandGrad.addColorStop(0, "#FFE0B2");
  sandGrad.addColorStop(1, "#FFCC80");
  ctx.fillStyle = sandGrad;
  ctx.fillRect(0, HEIGHT * 0.55, WIDTH, HEIGHT * 0.45);

  // Palm tree
  drawPalmTree(ctx, WIDTH * 0.12, HEIGHT * 0.55);

  // Clouds
  drawCloud(ctx, WIDTH * 0.3, HEIGHT * 0.08, 60);
  drawCloud(ctx, WIDTH * 0.6, HEIGHT * 0.12, 45);
}

function renderSchool(ctx: Ctx): void {
  // Chalkboard green wall
  ctx.fillStyle = "#2E7D32";
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.65);

  // Chalkboard frame
  ctx.fillStyle = "#5D4037";
  ctx.fillRect(WIDTH * 0.1, HEIGHT * 0.05, WIDTH * 0.8, HEIGHT * 0.5);
  ctx.fillStyle = "#1B5E20";
  ctx.fillRect(WIDTH * 0.12, HEIGHT * 0.07, WIDTH * 0.76, HEIGHT * 0.46);

  // Chalk text/marks
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fillRect(WIDTH * 0.2, HEIGHT * 0.15, WIDTH * 0.15, 3);
  ctx.fillRect(WIDTH * 0.2, HEIGHT * 0.22, WIDTH * 0.25, 3);
  ctx.fillRect(WIDTH * 0.2, HEIGHT * 0.29, WIDTH * 0.2, 3);

  // Floor
  ctx.fillStyle = "#BCAAA4";
  ctx.fillRect(0, HEIGHT * 0.65, WIDTH, HEIGHT * 0.35);

  // Desk hint
  ctx.fillStyle = "#795548";
  ctx.fillRect(WIDTH * 0.25, HEIGHT * 0.75, WIDTH * 0.5, HEIGHT * 0.05);
  ctx.fillRect(WIDTH * 0.3, HEIGHT * 0.8, WIDTH * 0.02, HEIGHT * 0.15);
  ctx.fillRect(WIDTH * 0.68, HEIGHT * 0.8, WIDTH * 0.02, HEIGHT * 0.15);
}

function renderSpace(ctx: Ctx): void {
  // Dark space background
  const spaceGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  spaceGrad.addColorStop(0, "#0D0D2B");
  spaceGrad.addColorStop(0.5, "#1A1A4E");
  spaceGrad.addColorStop(1, "#0D0D2B");
  ctx.fillStyle = spaceGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Stars
  ctx.fillStyle = "#FFFFFF";
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * WIDTH;
    const y = Math.random() * HEIGHT;
    const size = Math.random() * 2 + 0.5;
    ctx.globalAlpha = Math.random() * 0.5 + 0.5;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;

  // Planet
  const planetGrad = ctx.createRadialGradient(
    WIDTH * 0.7, HEIGHT * 0.3, 10,
    WIDTH * 0.7, HEIGHT * 0.3, 80
  );
  planetGrad.addColorStop(0, "#FF7043");
  planetGrad.addColorStop(1, "#BF360C");
  ctx.fillStyle = planetGrad;
  ctx.beginPath();
  ctx.arc(WIDTH * 0.7, HEIGHT * 0.3, 80, 0, Math.PI * 2);
  ctx.fill();

  // Nebula glow
  ctx.globalAlpha = 0.15;
  const nebulaGrad = ctx.createRadialGradient(
    WIDTH * 0.3, HEIGHT * 0.5, 50,
    WIDTH * 0.3, HEIGHT * 0.5, 300
  );
  nebulaGrad.addColorStop(0, "#CE93D8");
  nebulaGrad.addColorStop(1, "transparent");
  ctx.fillStyle = nebulaGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalAlpha = 1;

  // Platform/ground
  ctx.fillStyle = "#37474F";
  ctx.fillRect(0, HEIGHT * 0.8, WIDTH, HEIGHT * 0.2);
}

function renderUnderwater(ctx: Ctx): void {
  // Water gradient
  const waterGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  waterGrad.addColorStop(0, "#1565C0");
  waterGrad.addColorStop(0.5, "#0D47A1");
  waterGrad.addColorStop(1, "#0A2E6E");
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Light rays from surface
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#81D4FA";
  for (let i = 0; i < 5; i++) {
    const x = WIDTH * 0.2 + i * WIDTH * 0.15;
    ctx.beginPath();
    ctx.moveTo(x - 20, 0);
    ctx.lineTo(x - 60, HEIGHT);
    ctx.lineTo(x + 60, HEIGHT);
    ctx.lineTo(x + 20, 0);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Sandy bottom
  const sandGrad = ctx.createLinearGradient(0, HEIGHT * 0.8, 0, HEIGHT);
  sandGrad.addColorStop(0, "#5D4037");
  sandGrad.addColorStop(1, "#3E2723");
  ctx.fillStyle = sandGrad;
  ctx.fillRect(0, HEIGHT * 0.8, WIDTH, HEIGHT * 0.2);

  // Seaweed
  ctx.fillStyle = "#2E7D32";
  for (let i = 0; i < 6; i++) {
    const x = WIDTH * 0.1 + i * WIDTH * 0.15;
    ctx.beginPath();
    for (let y = HEIGHT * 0.8; y > HEIGHT * 0.5; y -= 5) {
      ctx.lineTo(x + Math.sin((HEIGHT * 0.8 - y) / 20 + i) * 15, y);
    }
    ctx.lineTo(x + 5, HEIGHT * 0.8);
    ctx.fill();
  }

  // Bubbles
  ctx.strokeStyle = "rgba(129, 212, 250, 0.4)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * WIDTH;
    const y = Math.random() * HEIGHT * 0.7;
    const r = Math.random() * 10 + 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function renderMountain(ctx: Ctx): void {
  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.5);
  skyGrad.addColorStop(0, "#64B5F6");
  skyGrad.addColorStop(1, "#E3F2FD");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Sun
  ctx.fillStyle = "#FFE082";
  ctx.beginPath();
  ctx.arc(WIDTH * 0.8, HEIGHT * 0.12, 45, 0, Math.PI * 2);
  ctx.fill();

  // Far mountains
  ctx.fillStyle = "#90A4AE";
  drawMountainShape(ctx, WIDTH * 0.0, HEIGHT * 0.35, WIDTH * 0.4, HEIGHT * 0.35);
  drawMountainShape(ctx, WIDTH * 0.3, HEIGHT * 0.3, WIDTH * 0.5, HEIGHT * 0.4);
  drawMountainShape(ctx, WIDTH * 0.65, HEIGHT * 0.32, WIDTH * 0.4, HEIGHT * 0.38);

  // Near mountains
  ctx.fillStyle = "#607D8B";
  drawMountainShape(ctx, WIDTH * 0.1, HEIGHT * 0.4, WIDTH * 0.35, HEIGHT * 0.3);
  drawMountainShape(ctx, WIDTH * 0.5, HEIGHT * 0.38, WIDTH * 0.45, HEIGHT * 0.32);

  // Snow caps
  ctx.fillStyle = "#ECEFF1";
  ctx.beginPath();
  ctx.moveTo(WIDTH * 0.55, HEIGHT * 0.3);
  ctx.lineTo(WIDTH * 0.52, HEIGHT * 0.36);
  ctx.lineTo(WIDTH * 0.58, HEIGHT * 0.36);
  ctx.fill();

  // Green valley
  const valleyGrad = ctx.createLinearGradient(0, HEIGHT * 0.65, 0, HEIGHT);
  valleyGrad.addColorStop(0, "#66BB6A");
  valleyGrad.addColorStop(1, "#388E3C");
  ctx.fillStyle = valleyGrad;
  ctx.fillRect(0, HEIGHT * 0.65, WIDTH, HEIGHT * 0.35);
}

function renderNight(ctx: Ctx): void {
  // Dark sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.6);
  skyGrad.addColorStop(0, "#0D1B2A");
  skyGrad.addColorStop(1, "#1B2838");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Stars
  ctx.fillStyle = "#FFFFFF";
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * WIDTH;
    const y = Math.random() * HEIGHT * 0.55;
    ctx.globalAlpha = Math.random() * 0.6 + 0.3;
    ctx.fillRect(x, y, Math.random() * 2 + 0.5, Math.random() * 2 + 0.5);
  }
  ctx.globalAlpha = 1;

  // Moon
  ctx.fillStyle = "#ECEFF1";
  ctx.beginPath();
  ctx.arc(WIDTH * 0.75, HEIGHT * 0.15, 40, 0, Math.PI * 2);
  ctx.fill();
  // Moon shadow
  ctx.fillStyle = "#1B2838";
  ctx.beginPath();
  ctx.arc(WIDTH * 0.75 + 12, HEIGHT * 0.15 - 5, 35, 0, Math.PI * 2);
  ctx.fill();

  // Moon glow
  ctx.globalAlpha = 0.1;
  const moonGlow = ctx.createRadialGradient(WIDTH * 0.75, HEIGHT * 0.15, 40, WIDTH * 0.75, HEIGHT * 0.15, 150);
  moonGlow.addColorStop(0, "#ECEFF1");
  moonGlow.addColorStop(1, "transparent");
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(WIDTH * 0.75, HEIGHT * 0.15, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Ground
  ctx.fillStyle = "#1A3A1A";
  ctx.fillRect(0, HEIGHT * 0.6, WIDTH, HEIGHT * 0.4);

  // Trees silhouettes
  ctx.fillStyle = "#0D1F0D";
  drawPineTree(ctx, WIDTH * 0.1, HEIGHT * 0.5, 120, "#0D1F0D");
  drawPineTree(ctx, WIDTH * 0.85, HEIGHT * 0.48, 140, "#0D1F0D");
}

function renderDefault(ctx: Ctx): void {
  // Simple gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, "#E8EAF6");
  grad.addColorStop(0.5, "#C5CAE9");
  grad.addColorStop(1, "#9FA8DA");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Simple floor/stage
  ctx.fillStyle = "#7986CB";
  ctx.fillRect(0, HEIGHT * 0.7, WIDTH, HEIGHT * 0.3);

  // Subtle horizon line
  ctx.strokeStyle = "#5C6BC0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT * 0.7);
  ctx.lineTo(WIDTH, HEIGHT * 0.7);
  ctx.stroke();
}

// --- Helper drawing functions ---

function drawCloud(ctx: Ctx, x: number, y: number, size: number): void {
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
  ctx.arc(x + size * 0.8, y, size * 0.45, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y + size * 0.1, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawTree(ctx: Ctx, x: number, y: number, height: number): void {
  // Trunk
  ctx.fillStyle = "#795548";
  ctx.fillRect(x - height * 0.08, y, height * 0.16, height * 0.4);

  // Foliage (circles)
  ctx.fillStyle = "#4CAF50";
  ctx.beginPath();
  ctx.arc(x, y - height * 0.15, height * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#388E3C";
  ctx.beginPath();
  ctx.arc(x - height * 0.15, y + height * 0.05, height * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + height * 0.15, y + height * 0.05, height * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawPineTree(ctx: Ctx, x: number, y: number, height: number, color: string): void {
  ctx.fillStyle = color;
  // Three triangles
  for (let i = 0; i < 3; i++) {
    const layerY = y - height * 0.3 * i;
    const layerW = height * 0.4 * (1 - i * 0.15);
    ctx.beginPath();
    ctx.moveTo(x, layerY - height * 0.35);
    ctx.lineTo(x - layerW, layerY);
    ctx.lineTo(x + layerW, layerY);
    ctx.fill();
  }

  // Trunk
  ctx.fillStyle = "#5D4037";
  ctx.fillRect(x - height * 0.05, y, height * 0.1, height * 0.15);
}

function drawPalmTree(ctx: Ctx, x: number, y: number): void {
  // Trunk (curved)
  ctx.strokeStyle = "#8D6E63";
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 30, y - 100, x + 20, y - 200);
  ctx.stroke();

  // Leaves
  const topX = x + 20;
  const topY = y - 200;
  ctx.fillStyle = "#2E7D32";
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
    ctx.beginPath();
    ctx.ellipse(
      topX + Math.cos(angle) * 50,
      topY + Math.sin(angle) * 20,
      60, 12,
      angle, 0, Math.PI * 2
    );
    ctx.fill();
  }
}

function drawMountainShape(ctx: Ctx, x: number, peakY: number, width: number, height: number): void {
  ctx.beginPath();
  ctx.moveTo(x, peakY + height);
  ctx.lineTo(x + width / 2, peakY);
  ctx.lineTo(x + width, peakY + height);
  ctx.fill();
}

// --- Main API ---

const RENDERERS: Record<SceneType, (ctx: Ctx) => void> = {
  park: renderPark,
  forest: renderForest,
  room: renderRoom,
  city: renderCity,
  beach: renderBeach,
  school: renderSchool,
  space: renderSpace,
  underwater: renderUnderwater,
  mountain: renderMountain,
  night: renderNight,
  default: renderDefault,
};

/**
 * Generate a scene background as a PNG buffer.
 * Returns a base64-encoded PNG string (no data:image prefix).
 */
export async function renderBackground(visualDescription: string): Promise<string> {
  const sceneType = detectSceneType(visualDescription);
  console.log(`Canvas background: detected scene type "${sceneType}" from description`);

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Render the scene
  const renderer = RENDERERS[sceneType] || RENDERERS.default;
  renderer(ctx);

  // Convert to PNG buffer
  const pngBuffer = canvas.toBuffer("image/png");
  return pngBuffer.toString("base64");
}

/**
 * Get the detected scene type for a description (useful for debugging).
 */
export function getSceneType(visualDescription: string): SceneType {
  return detectSceneType(visualDescription);
}
