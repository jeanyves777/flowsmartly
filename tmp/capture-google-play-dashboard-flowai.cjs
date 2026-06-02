const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, execFile } = require("child_process");
const { PrismaClient } = require("@prisma/client");
const sharp = require("sharp");
const puppeteer = require("puppeteer");

const BASE_URL = process.env.PLAY_CAPTURE_BASE_URL || "http://localhost:3000";
const OUT_DIR = path.join("tmp", "play-assets");
const USER_EMAIL = process.env.PLAY_CAPTURE_USER_EMAIL || "test@flowsmartly.com";

const sizes = [
  { folder: "phone", width: 432, height: 768, dpr: 2.5, prefix: "phone" },
  { folder: "tablet-7", width: 720, height: 1280, dpr: 2, prefix: "tablet-7" },
  { folder: "tablet-10", width: 720, height: 1280, dpr: 2, prefix: "tablet-10" },
  { folder: "chromebook", width: 1280, height: 720, dpr: 1.5, prefix: "chromebook" },
  { folder: "android-xr", width: 1280, height: 720, dpr: 1.5, prefix: "android-xr" },
];

const shots = [
  { slug: "dashboard-local", path: "/dashboard", kind: "dashboard-local" },
  { slug: "dashboard-spotlight", path: "/dashboard", kind: "dashboard-spotlight" },
  { slug: "flowai-home", path: "/flow-ai", kind: "flowai-home" },
  { slug: "flowai-prompt", path: "/flow-ai", kind: "flowai-prompt" },
];

function requestStatus(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });
    req.on("error", () => resolve(0));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(0);
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await requestStatus(url);
    if (status >= 200 && status < 500) return true;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

async function startServerIfNeeded() {
  if (await waitForServer(BASE_URL, 5000)) return null;

  const child = spawn("cmd.exe", ["/c", "npm", "run", "dev", "--", "-p", "3000"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout.on("data", (data) => process.stdout.write(`[next] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[next] ${data}`));

  const ready = await waitForServer(BASE_URL, 240000);
  if (!ready) throw new Error("Timed out waiting for Next dev server");
  return child;
}

function stopServer(child) {
  if (!child?.pid) return Promise.resolve();
  return new Promise((resolve) => {
    execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => resolve());
  });
}

async function createSession() {
  const prisma = new PrismaClient();
  const { SignJWT } = await import("jose");

  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, deletedAt: true },
  });
  if (!user || user.deletedAt) {
    await prisma.$disconnect();
    throw new Error(`Capture user not found: ${USER_EMAIL}`);
  }

  const sessionId = `play_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      token: `play_${Math.random().toString(36).slice(2)}_${Date.now()}`,
      userAgent: "FlowSmartly Google Play screenshot capture",
      ipAddress: "127.0.0.1",
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });
  await prisma.$disconnect();

  const accessSecret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-in-production");
  const refreshSecret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-in-production");
  const accessToken = await new SignJWT({ userId: user.id, sessionId, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .setJti(`play-${Date.now()}-access`)
    .sign(accessSecret);
  const refreshToken = await new SignJWT({ userId: user.id, sessionId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .setJti(`play-${Date.now()}-refresh`)
    .sign(refreshSecret);
  return { accessToken, refreshToken };
}

async function setAuthCookies(page, session) {
  await page.setCookie(
    {
      name: "access_token",
      value: session.accessToken,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
    },
    {
      name: "refresh_token",
      value: session.refreshToken,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
    },
  );
}

function prepareFolders() {
  for (const size of sizes) {
    const dir = path.join(OUT_DIR, size.folder);
    fs.mkdirSync(dir, { recursive: true });
    for (const file of fs.readdirSync(dir)) {
      if (file.toLowerCase().endsWith(".png")) {
        fs.unlinkSync(path.join(dir, file));
      }
    }
  }
}

async function waitForDashboardContent(page) {
  await page.waitForFunction(
    () => {
      const text = document.body.innerText || "";
      return (
        !text.includes("Loading your dashboard") &&
        (text.includes("Welcome back") || text.includes("Total Views") || text.includes("Set Up Your Brand Identity"))
      );
    },
    { timeout: 180000 },
  );
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function waitForFlowAIContent(page) {
  await page.waitForSelector("textarea", { timeout: 180000 });
  await page.waitForFunction(
    () => {
      const text = document.body.innerText || "";
      return !text.includes("Loading") && (text.includes("No conversations yet") || text.includes("Ask FlowAI") || document.querySelector("textarea"));
    },
    { timeout: 180000 },
  );
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

async function collapseDashboardSidebar(page) {
  await page.evaluate(() => {
    const aside = document.querySelector("aside");
    if (!aside) return;
    const button = aside.querySelector("button");
    if (button instanceof HTMLButtonElement && aside.getBoundingClientRect().width > 120) {
      button.click();
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
}

async function hideFlowAISidebar(page) {
  await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="Hide sidebar"]');
    if (button instanceof HTMLButtonElement) button.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 700));
}

async function readyPage(page, shot) {
  await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForNetworkIdle({ idleTime: 1200, timeout: 180000 }).catch(() => {});

  if (shot.kind.startsWith("dashboard")) {
    await waitForDashboardContent(page);
    await collapseDashboardSidebar(page);
    await page.evaluate((kind) => {
      if (kind === "dashboard-spotlight") {
        window.scrollTo(0, Math.max(window.innerHeight * 1.75, 1350));
      } else {
        window.scrollTo(0, Math.max(window.innerHeight * 0.78, 620));
      }
    }, shot.kind);
  } else {
    await waitForFlowAIContent(page);
    await hideFlowAISidebar(page);
    if (shot.kind === "flowai-prompt") {
      await page.click("textarea");
      await page.type("textarea", "Create a weekly marketing plan for my business with social posts, email, and SMS follow-up.", { delay: 4 });
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function capture(browser, session, size, shot, index) {
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({
    width: size.width,
    height: size.height,
    deviceScaleFactor: size.dpr,
    isMobile: size.folder.includes("phone") || size.folder.includes("tablet"),
    hasTouch: size.folder.includes("phone") || size.folder.includes("tablet"),
  });
  await setAuthCookies(page, session);
  await readyPage(page, shot);

  const finalUrl = page.url();
  if (finalUrl.includes("/login") || finalUrl.includes("/select-plan") || finalUrl.includes("/studio")) {
    throw new Error(`${shot.path} redirected to ${finalUrl}`);
  }

  const out = path.join(OUT_DIR, size.folder, `${size.prefix}-${String(index + 1).padStart(2, "0")}-${shot.slug}.png`);
  await page.screenshot({ path: out, fullPage: false, captureBeyondViewport: false });
  await page.close();

  const meta = await sharp(out).metadata();
  const expectedW = Math.round(size.width * size.dpr);
  const expectedH = Math.round(size.height * size.dpr);
  if (meta.width !== expectedW || meta.height !== expectedH) {
    const fixed = `${out}.fixed.png`;
    await sharp(out).resize(expectedW, expectedH, { fit: "cover" }).png().toFile(fixed);
    fs.renameSync(fixed, out);
  }
  return out;
}

function writeReadme() {
  const lines = [
    "# Google Play Graphics",
    "",
    "Upload-ready FlowSmartly graphics generated from real rendered app pages.",
    "",
    "- app-icon-512.png: 512x512 PNG, under 1 MB",
    "- feature-graphic.png: 1024x500 PNG, generated with the image model and finished with the real FlowSmartly logo",
    "- phone/: four real screenshots captured at 1080x1920, 9:16",
    "- tablet-7/: four real screenshots captured at 1440x2560, 9:16",
    "- tablet-10/: four real screenshots captured at 1440x2560, 9:16",
    "- chromebook/: four real screenshots captured at 1920x1080, 16:9",
    "- android-xr/: four real screenshots captured at 1920x1080, 16:9",
    "",
    "Captured surfaces only: /dashboard and /flow-ai.",
    "No Image Studio screenshots are included.",
    "",
  ];
  fs.writeFileSync(path.join(OUT_DIR, "README.md"), lines.join("\n"));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  prepareFolders();

  const server = await startServerIfNeeded();
  const session = await createSession();
  const browser = await puppeteer.launch({
    headless: "new",
    protocolTimeout: 240000,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    for (const size of sizes) {
      for (const [index, shot] of shots.entries()) {
        const out = await capture(browser, session, size, shot, index);
        console.log(out);
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await stopServer(server);
  }

  writeReadme();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
