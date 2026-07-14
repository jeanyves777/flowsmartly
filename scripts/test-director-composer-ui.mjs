import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env" });

const origin = process.env.DIRECTOR_UI_ORIGIN || "http://localhost:3011";
const screenshotPath = path.join(os.tmpdir(), "director-composer-ui.png");
const prisma = new PrismaClient();
const user = await prisma.user.findFirst({
  where: { deletedAt: null, onboardingComplete: true },
  select: { id: true },
});
await prisma.$disconnect();
assert(user, "A local test user is required for the Director UI check.");

const secret = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-in-production",
);
const accessToken = await new SignJWT({
  userId: user.id,
  sessionId: "director-composer-ui-check",
  type: "access",
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("15m")
  .sign(secret);

const previewUrl = `${origin}/agent-design-templates/images/agent-ecommerce-premium-showcase.png`;
const scenes = ["Opening", "Amara Arrives", "A Penny's Hope", "Market Day", "A Better Path"].map(
  (title, index) => ({
    id: `scene-${index}`,
    engine: "ai",
    title,
    order: index,
    x: 50 + index * 300,
    y: index % 2 ? 250 : 70,
    script: "Cinematic village market scene.",
    durationSec: 8,
    transitionIn: index ? "cut" : undefined,
    captionsOn: true,
    style: "cinematic",
    aiProvider: "grok",
    status: "ready",
    progress: 100,
    videoUrl: previewUrl,
    thumbnailUrl: previewUrl,
    cast: [{
      name: index % 2 ? "Amara Mensah" : "Marcus Okonkwo",
      dialogue: index % 2
        ? "The market opens soon. We should be ready."
        : "Today we build a better future.",
    }],
  }),
);

const film = {
  id: "director-ui-fixture",
  title: "Director Composer UI Verification",
  brief: "A village entrepreneur builds a thriving business.",
  filmType: "ai_film",
  aspect: "16:9",
  targetSeconds: 40,
  sceneCount: scenes.length,
  style: "cinematic",
  quality: "avatar_iv",
  sourceVideoUrl: null,
  scenes,
  edges: [],
  assets: [],
  characters: [],
  composer: {
    layers: [],
    captions: {
      enabled: true,
      style: "boxed",
      font: "sans",
      fontSize: 42,
      color: "#ffffff",
      backgroundColor: "#000000",
      position: "bottom",
    },
    musicVolume: 0.28,
  },
  music: null,
  brandLogo: true,
  captionsOn: true,
  finalVideoUrl: null,
  finalStatus: "draft",
  finalProgress: 0,
};
let serverFilm = structuredClone(film);
const savedProjects = [];

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || puppeteer.executablePath(),
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
});

try {
  const page = await browser.newPage();
  await page.setCookie({
    name: "access_token",
    value: accessToken,
    domain: new URL(origin).hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    const method = request.method();
    if (pathname === "/api/ai/video-director" && method === "GET") {
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { films: [{ id: film.id, title: film.title }] } }),
      });
    }
    if (pathname === `/api/ai/video-director/${film.id}` && method === "GET") {
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { film: serverFilm } }),
      });
    }
    if (pathname === `/api/ai/video-director/${film.id}` && method === "PATCH") {
      const payload = JSON.parse(request.postData() || "{}");
      if (payload.project) { serverFilm = payload.project; savedProjects.push(payload.project); }
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { film: serverFilm } }),
      });
    }
    if (pathname === "/api/media/generate-image" && method === "POST") {
      return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { url: previewUrl, creditCost: 12 } }) });
    }
    if (pathname === "/api/ai/voice-studio/generate" && method === "POST") {
      return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { audioUrl: "https://example.com/director-voice.mp3", durationMs: 4200, creditsUsed: 10 } }) });
    }
    if (pathname === `/api/ai/video-director/${film.id}/composer/music` && method === "POST") {
      return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { url: "https://example.com/director-music.mp3", durationSec: 30, creditCost: 40 } }) });
    }
    if (
      method === "GET" &&
      (pathname === "/api/ai/avatar-studio/avatars" || pathname === "/api/ai/avatar-studio/voices")
    ) {
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { avatars: [], voices: [] } }),
      });
    }
    request.continue();
  });

  await page.goto(`${origin}/home/director`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => document.body.innerText.includes("Compose"), { timeout: 60_000 });
  assert.equal(page.url(), `${origin}/home/director`, "The Director deep link must remain open.");

  const before = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const findButton = (text) => buttons.find((button) => button.textContent?.includes(text));
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
    };
    const play = [...document.querySelectorAll('button[title="Play"]')].at(-1);
    const timeline = findButton("Timeline");
    const compose = findButton("Compose");
    return {
      timeline: rect(timeline),
      play: rect(play),
      compose: rect(compose),
    };
  });
  assert(before.play.left > before.timeline.left, "Play must sit beside the Timeline label.");
  assert(before.compose.left > before.play.left, "Compose must sit in the left transport group.");
  assert(before.compose.left - before.timeline.left < 380, "Compose drifted out of the left control group.");

  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Compose"))
      ?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes("Film composer"), { timeout: 10_000 });

  const inspectComposer = () => page.evaluate(() => {
    const title = [...document.querySelectorAll("*")]
      .find((element) => element.textContent?.trim() === "Film composer");
    const panel = title?.closest(".fixed");
    const timeline = [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "Timeline")
      ?.closest(".absolute");
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: Math.round(bounds.left),
        right: Math.round(bounds.right),
        top: Math.round(bounds.top),
        bottom: Math.round(bounds.bottom),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      panel: rect(panel),
      timeline: rect(timeline),
      bodyPortal: panel?.parentElement === document.body,
      tools: ["Layers", "Text", "Image", "Logo", "Video", "Captions", "Music", "Audio"]
        .filter((label) => [...document.querySelectorAll("button")]
          .some((button) => button.textContent?.trim() === label)),
    };
  });

  let composer = await inspectComposer();
  assert(composer.bodyPortal, "Composer must render through a body portal.");
  assert.equal(composer.panel.left, composer.timeline.left, "Composer must align with the timeline left edge.");
  assert.equal(composer.panel.right, composer.timeline.right, "Composer must align with the timeline right edge.");
  assert.equal(composer.panel.bottom, composer.timeline.top, "Composer must connect directly above the timeline.");
  assert.equal(composer.tools.length, 8, "Every composer tool must be visible.");

  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "Text")
      ?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes("Your text"), { timeout: 5_000 });
  assert(await page.$('input[value="Text"]'), "Adding text must open its inline layer inspector.");

  let canvasLayers = await page.$$('[data-composer-layer]');
  assert.equal(canvasLayers.length, 1, "Adding text must create a selectable canvas object.");
  await canvasLayers[0].click({ button: "right" });
  await page.waitForSelector("[data-director-context-menu]");
  assert(await page.evaluate(() => document.querySelector("[data-director-context-menu]")?.textContent?.includes("Bring to front")), "Right-click must open object stacking actions.");
  await page.evaluate(() => [...document.querySelectorAll("[data-director-context-menu] button")].find((button) => button.textContent?.includes("Duplicate"))?.click());
  await page.waitForFunction(() => document.querySelectorAll("[data-composer-layer]").length === 2);

  canvasLayers = await page.$$('[data-composer-layer]');
  const movingLayer = canvasLayers.at(-1);
  const moveBefore = await movingLayer.evaluate((element) => ({ left: element.style.left, top: element.style.top }));
  const movingBox = await movingLayer.boundingBox();
  assert(movingBox, "Selected canvas object needs a mouse target.");
  await page.mouse.move(movingBox.x + movingBox.width / 2, movingBox.y + movingBox.height / 2);
  await page.mouse.down(); await page.mouse.move(movingBox.x + movingBox.width / 2 + 50, movingBox.y + movingBox.height / 2 + 25, { steps: 5 }); await page.mouse.up();
  const moveAfter = await movingLayer.evaluate((element) => ({ left: element.style.left, top: element.style.top }));
  assert.notDeepEqual(moveAfter, moveBefore, "Canvas objects must move freely with the mouse.");

  const resizeHandle = await page.$('[data-composer-resize-handle]');
  const resizeBefore = await movingLayer.evaluate((element) => element.style.width);
  const handleBox = await resizeHandle.boundingBox();
  assert(handleBox, "Selected canvas object needs resize handles.");
  await page.mouse.move(handleBox.x + 4, handleBox.y + 4); await page.mouse.down(); await page.mouse.move(handleBox.x - 45, handleBox.y + 4, { steps: 5 }); await page.mouse.up();
  const resizeAfter = await movingLayer.evaluate((element) => element.style.width);
  assert.notEqual(resizeAfter, resizeBefore, "Canvas objects must resize with mouse handles.");

  const keyLeftBefore = await movingLayer.evaluate((element) => element.style.left);
  await page.keyboard.press("ArrowRight");
  const keyLeftAfter = await movingLayer.evaluate((element) => element.style.left);
  assert.notEqual(keyLeftAfter, keyLeftBefore, "Arrow keys must nudge the selected object.");

  await page.click('button[title="Image"]');
  await page.type("[data-composer-image-prompt]", "A glowing market sign");
  await page.click("[data-composer-generate-image]");
  await page.waitForFunction(() => document.querySelectorAll("[data-composer-layer]").length === 3);

  await page.click('button[title="Audio"]');
  await page.type("[data-composer-voice-script]", "Welcome to the market today.");
  await page.click("[data-composer-generate-voice]");
  await page.waitForFunction(() => document.body.innerText.includes("The generated narration is now on the audio track."), { timeout: 5_000 });

  await page.click('button[title="Music"]');
  await page.type("[data-composer-music-prompt]", "Warm cinematic African strings and hand percussion");
  await page.click("[data-composer-generate-music]");
  await page.waitForFunction(() => document.body.innerText.includes("The generated music bed spans the film."), { timeout: 5_000 });

  await page.click('button[aria-label="Close composer"]');
  await page.waitForFunction(() => !document.body.innerText.includes("Film composer"), { timeout: 5_000 });

  let timelineLayers = await page.$$('[data-timeline-layer]');
  let timelineLayer = timelineLayers.at(-1);
  assert(timelineLayer, "Composer objects must appear on the editable timeline.");
  const timelineMoveBefore = await timelineLayer.evaluate((element) => element.style.left);
  const timelineBox = await timelineLayer.boundingBox();
  assert(timelineBox, "Timeline object needs a mouse target.");
  await page.mouse.move(timelineBox.x + timelineBox.width / 2, timelineBox.y + timelineBox.height / 2); await page.mouse.down(); await page.mouse.move(timelineBox.x + timelineBox.width / 2 + 35, timelineBox.y + timelineBox.height / 2 - 20, { steps: 5 }); await page.mouse.up();
  timelineLayers = await page.$$('[data-timeline-layer]');
  timelineLayer = timelineLayers.at(-1);
  const timelineMoveAfter = await timelineLayer.evaluate((element) => element.style.left);
  assert.notEqual(timelineMoveAfter, timelineMoveBefore, "Timeline objects must move horizontally and change stacking with vertical drag.");

  const trimHandle = await timelineLayer.$('[data-layer-trim="right"]');
  const trimBefore = await timelineLayer.evaluate((element) => element.style.width);
  const trimBox = await trimHandle.boundingBox();
  assert(trimBox, "Timeline object needs trim handles.");
  await page.mouse.move(trimBox.x + 2, trimBox.y + 2); await page.mouse.down(); await page.mouse.move(trimBox.x - 25, trimBox.y + 2, { steps: 4 }); await page.mouse.up();
  const trimAfter = await timelineLayer.evaluate((element) => element.style.width);
  assert.notEqual(trimAfter, trimBefore, "Timeline object edges must trim with the mouse.");

  await timelineLayer.click({ button: "right" });
  await page.waitForSelector("[data-director-context-menu]");
  assert(await page.evaluate(() => document.querySelector("[data-director-context-menu]")?.textContent?.includes("Split at playhead")), "Timeline right-click must expose split and timing actions.");
  await page.keyboard.press("Escape");
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert(savedProjects.some((project) => project.composer?.layers?.length >= 4 && project.music), "Composer manipulations and generated assets must autosave into the film project.");

  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Compose"))
      ?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes("Film composer"), { timeout: 5_000 });
  composer = await inspectComposer();
  assert(composer.panel.width >= 700, "Composer preview became too narrow at desktop size.");
  assert(composer.panel.height >= 350, "Composer preview became too short at desktop size.");
  assert.equal(composer.panel.bottom, composer.timeline.top, "Resized composer must stay connected to the timeline.");

  await page.screenshot({ path: screenshotPath });
  console.log(`Director composer UI passed. Screenshot: ${screenshotPath}`);
} finally {
  await browser.close();
}
