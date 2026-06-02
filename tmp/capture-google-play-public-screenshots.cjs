const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, execFile } = require("child_process");
const sharp = require("sharp");
const puppeteer = require("puppeteer");

const BASE_URL = process.env.PLAY_CAPTURE_BASE_URL || "http://localhost:3000";
const OUT_DIR = path.join("tmp", "play-assets");

const routes = [
  { slug: "home", path: "/" },
  { slug: "flowshop", path: "/flowshop" },
  { slug: "listsmartly", path: "/listsmartly-details" },
  { slug: "marketplace", path: "/marketplace" },
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

async function waitForServer(url, timeoutMs) {
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

    const ready = await waitForServer(BASE_URL, 240000);
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

async function waitForStablePage(page) {
  await page.waitForNetworkIdle({ idleTime: 1500, timeout: 120000 }).catch(() => {});
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      }),
    );
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

async function capture(browser, size, route, index) {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({
    width: size.width,
    height: size.height,
    deviceScaleFactor: size.dpr,
    isMobile: size.folder.includes("phone") || size.folder.includes("tablet"),
    hasTouch: size.folder.includes("phone") || size.folder.includes("tablet"),
  });

  await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle2", timeout: 180000 });
  await waitForStablePage(page);

  const out = path.join(OUT_DIR, size.folder, `${size.prefix}-${String(index + 1).padStart(2, "0")}-${route.slug}.png`);
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
    "Captured routes: /, /flowshop, /listsmartly-details, /marketplace.",
    "Video fields can stay empty unless a public or unlisted YouTube demo is available.",
    "",
  ];
  fs.writeFileSync(path.join(OUT_DIR, "README.md"), lines.join("\n"));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  prepareFolders();

  const server = await startServerIfNeeded();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    for (const size of sizes) {
      for (const [index, route] of routes.entries()) {
        const out = await capture(browser, size, route, index);
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
