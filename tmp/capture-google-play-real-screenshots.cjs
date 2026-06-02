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

const routes = [
  { slug: "dashboard", path: "/dashboard" },
  { slug: "studio", path: "/studio" },
  { slug: "listsmartly", path: "/listsmartly/dashboard" },
  { slug: "flowshop", path: "/ecommerce/dashboard" },
];

const sizes = [
  { folder: "phone", width: 432, height: 768, dpr: 2.5, prefix: "phone" },
  { folder: "tablet-7", width: 720, height: 1280, dpr: 2, prefix: "tablet-7" },
  { folder: "tablet-10", width: 720, height: 1280, dpr: 2, prefix: "tablet-10" },
  { folder: "chromebook", width: 1280, height: 720, dpr: 1.5, prefix: "chromebook" },
  { folder: "android-xr", width: 1280, height: 720, dpr: 1.5, prefix: "android-xr" },
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

async function waitForServer(url, timeoutMs = 180000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const status = await requestStatus(url);
    if (status >= 200 && status < 500) return true;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

function startServerIfNeeded() {
  return new Promise(async (resolve, reject) => {
    if (await waitForServer(BASE_URL, 5000)) {
      resolve(null);
      return;
    }

    const child = spawn("cmd.exe", ["/c", "npm", "run", "dev", "--", "-p", "3000"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    child.stdout.on("data", (data) => process.stdout.write(`[next] ${data}`));
    child.stderr.on("data", (data) => process.stderr.write(`[next] ${data}`));
    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`Next dev server exited early with code ${code}`));
      }
    });

    const ready = await waitForServer(BASE_URL, 180000);
    if (!ready) {
      reject(new Error("Timed out waiting for Next dev server"));
      return;
    }
    resolve(child);
  });
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
    select: { id: true, email: true, onboardingComplete: true, deletedAt: true },
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

  return { sessionId, accessToken, refreshToken };
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

async function prepareFolders() {
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

async function waitForUsablePage(page) {
  await page.waitForLoadState?.("networkidle").catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 3500));
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  });
  await new Promise((resolve) => setTimeout(resolve, 800));
}

async function capture(browser, session, size, route, index) {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  await page.setViewport({
    width: size.width,
    height: size.height,
    deviceScaleFactor: size.dpr,
    isMobile: size.folder.includes("phone") || size.folder.includes("tablet"),
    hasTouch: size.folder.includes("phone") || size.folder.includes("tablet"),
  });
  await setAuthCookies(page, session);

  const url = `${BASE_URL}${route.path}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
  await waitForUsablePage(page);

  const finalUrl = page.url();
  if (finalUrl.includes("/login") || finalUrl.includes("/select-plan")) {
    throw new Error(`${route.path} redirected to ${finalUrl}`);
  }

  const out = path.join(OUT_DIR, size.folder, `${size.prefix}-${String(index + 1).padStart(2, "0")}-${route.slug}.png`);
  await page.screenshot({ path: out, fullPage: false, captureBeyondViewport: false });
  await page.close();

  const meta = await sharp(out).metadata();
  const expectedW = Math.round(size.width * size.dpr);
  const expectedH = Math.round(size.height * size.dpr);
  if (meta.width !== expectedW || meta.height !== expectedH) {
    await sharp(out).resize(expectedW, expectedH, { fit: "cover" }).png().toFile(`${out}.fixed`);
    fs.renameSync(`${out}.fixed`, out);
  }
  return out;
}

async function writeReadme() {
  const lines = [
    "# Google Play Graphics",
    "",
    "Upload-ready FlowSmartly graphics.",
    "",
    "- app-icon-512.png: 512x512 PNG, under 1 MB",
    "- feature-graphic.png: 1024x500 PNG, generated with the image model and finished with the real FlowSmartly logo",
    "- phone/: four real app screenshots captured at 1080x1920, 9:16",
    "- tablet-7/: four real app screenshots captured at 1440x2560, 9:16",
    "- tablet-10/: four real app screenshots captured at 1440x2560, 9:16",
    "- chromebook/: four real app screenshots captured at 1920x1080, 16:9",
    "- android-xr/: four real app screenshots captured at 1920x1080, 16:9",
    "",
    "Captured routes: /dashboard, /studio, /listsmartly/dashboard, /ecommerce/dashboard.",
    "Video fields can stay empty unless a public or unlisted YouTube demo is available.",
    "",
  ];
  fs.writeFileSync(path.join(OUT_DIR, "README.md"), lines.join("\n"));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await prepareFolders();

  const server = await startServerIfNeeded();
  const session = await createSession();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    for (const size of sizes) {
      for (const [index, route] of routes.entries()) {
        const out = await capture(browser, session, size, route, index);
        console.log(out);
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await stopServer(server);
  }

  await writeReadme();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
