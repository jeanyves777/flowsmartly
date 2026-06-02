const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const outDir = path.join("tmp", "play-assets");
const logoPath = path.join("public", "logo.png");
const iconPath = path.join("public", "icon-512.png");

const themes = [
  {
    key: "studio-create",
    title: "Create campaigns",
    subtitle: "Posts, images, videos, email, and SMS in one workspace.",
    screenTitle: "Studio",
    accent: "#0ea5e9",
    accent2: "#14b8a6",
    warm: "#f97316",
    metrics: ["4 drafts", "2 videos", "Ready"],
    rows: ["Social post", "Promo image", "Video script", "Email copy"],
  },
  {
    key: "local-listings",
    title: "Grow local",
    subtitle: "Listings, reviews, maps, and local SEO in one flow.",
    screenTitle: "Listings",
    accent: "#16a34a",
    accent2: "#0ea5e9",
    warm: "#f59e0b",
    metrics: ["92% sync", "18 reviews", "Live"],
    rows: ["Google profile", "Local SEO tasks", "Review follow-up", "Map visibility"],
  },
  {
    key: "flowshop",
    title: "Sell online",
    subtitle: "Build product pages, promotions, and checkout-ready stores.",
    screenTitle: "FlowShop",
    accent: "#db2777",
    accent2: "#0ea5e9",
    warm: "#f97316",
    metrics: ["12 items", "$1.2k", "Open"],
    rows: ["Product cards", "Offer banner", "Cart preview", "Store link"],
  },
  {
    key: "automation",
    title: "Automate follow-up",
    subtitle: "Coordinate social, email, SMS, and customer touchpoints.",
    screenTitle: "Campaigns",
    accent: "#2563eb",
    accent2: "#14b8a6",
    warm: "#eab308",
    metrics: ["7 queued", "3 channels", "Today"],
    rows: ["Content calendar", "Email automation", "SMS campaign", "Performance report"],
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function dataUri(file) {
  const ext = path.extname(file).slice(1).toLowerCase() || "png";
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

function xml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textLines(lines, x, y, size, fill, weight = 500, gap = 1.24) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * size * gap}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${xml(line)}</text>`,
    )
    .join("");
}

function metricPills(theme, x, y, gap = 18, pillW = 156) {
  let cursor = x;
  return theme.metrics
    .map((metric, index) => {
      const w = Math.max(pillW, metric.length * 12 + 76);
      const left = cursor;
      cursor += w + gap;
      return `
        <rect x="${left}" y="${y}" width="${w}" height="54" rx="18" fill="#ffffff" opacity="0.95"/>
        <circle cx="${left + 26}" cy="${y + 27}" r="9" fill="${index === 0 ? theme.accent : index === 1 ? theme.accent2 : theme.warm}"/>
        <text x="${left + 46}" y="${y + 35}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#111827">${xml(metric)}</text>`;
    })
    .join("");
}

function screenMockup(theme, x, y, w, h, compact = false) {
  const pad = compact ? 28 : 38;
  const top = y + pad;
  const contentX = x + pad;
  const contentY = y + pad + 78;
  const contentW = w - pad * 2;
  const rowH = compact ? 86 : 112;
  const rowGap = compact ? 18 : 24;
  const sidebarW = compact ? 0 : Math.min(190, Math.floor(w * 0.22));
  const mainX = contentX + sidebarW + (sidebarW ? 24 : 0);
  const mainW = contentW - sidebarW - (sidebarW ? 24 : 0);
  const rows = theme.rows
    .slice(0, 4)
    .map((row, index) => {
      const ry = contentY + 154 + index * (rowH + rowGap);
      const color = index === 0 ? theme.accent : index === 1 ? theme.accent2 : index === 2 ? theme.warm : "#64748b";
      return `
        <rect x="${mainX}" y="${ry}" width="${mainW}" height="${rowH}" rx="24" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
        <circle cx="${mainX + 42}" cy="${ry + rowH / 2}" r="18" fill="${color}" opacity="0.18"/>
        <circle cx="${mainX + 42}" cy="${ry + rowH / 2}" r="8" fill="${color}"/>
        <text x="${mainX + 78}" y="${ry + rowH / 2 + 8}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${compact ? 24 : 30}" font-weight="800" fill="#111827">${xml(row)}</text>
        <rect x="${mainX + mainW - 180}" y="${ry + rowH / 2 - 15}" width="132" height="30" rx="15" fill="${color}" opacity="0.12"/>
        <text x="${mainX + mainW - 154}" y="${ry + rowH / 2 + 7}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${compact ? 15 : 18}" font-weight="800" fill="${color}">READY</text>`;
    })
    .join("");

  const sidebar =
    sidebarW > 0
      ? `
      <rect x="${contentX}" y="${contentY}" width="${sidebarW}" height="${h - pad * 2 - 78}" rx="28" fill="#f8fafc"/>
      <rect x="${contentX + 28}" y="${contentY + 34}" width="${sidebarW - 56}" height="20" rx="10" fill="${theme.accent}" opacity="0.35"/>
      <rect x="${contentX + 28}" y="${contentY + 82}" width="${sidebarW - 76}" height="18" rx="9" fill="#cbd5e1"/>
      <rect x="${contentX + 28}" y="${contentY + 128}" width="${sidebarW - 52}" height="52" rx="17" fill="${theme.accent}" opacity="0.14"/>
      <rect x="${contentX + 28}" y="${contentY + 210}" width="${sidebarW - 72}" height="18" rx="9" fill="#cbd5e1"/>
      <rect x="${contentX + 28}" y="${contentY + 256}" width="${sidebarW - 50}" height="18" rx="9" fill="#cbd5e1"/>
      <rect x="${contentX + 28}" y="${contentY + 302}" width="${sidebarW - 80}" height="18" rx="9" fill="#cbd5e1"/>`
      : "";

  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${compact ? 42 : 48}" fill="#ffffff" stroke="#dbe3ef" stroke-width="4"/>
    <rect x="${x + 14}" y="${y + 14}" width="${w - 28}" height="${h - 28}" rx="${compact ? 32 : 38}" fill="#f1f5f9"/>
    <rect x="${x + pad}" y="${top}" width="${w - pad * 2}" height="62" rx="22" fill="#ffffff"/>
    <circle cx="${x + pad + 34}" cy="${top + 31}" r="12" fill="${theme.accent}"/>
    <text x="${x + pad + 58}" y="${top + 40}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${compact ? 23 : 29}" font-weight="900" fill="#111827">${xml(theme.screenTitle)}</text>
    <rect x="${x + w - pad - 128}" y="${top + 16}" width="88" height="30" rx="15" fill="${theme.accent}" opacity="0.14"/>
    <text x="${x + w - pad - 108}" y="${top + 38}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${compact ? 14 : 16}" font-weight="900" fill="${theme.accent}">LIVE</text>
    ${sidebar}
    <rect x="${mainX}" y="${contentY}" width="${Math.floor(mainW * 0.52)}" height="${compact ? 114 : 132}" rx="30" fill="${theme.accent}"/>
    <rect x="${mainX + 30}" y="${contentY + 32}" width="${Math.floor(mainW * 0.28)}" height="18" rx="9" fill="#ffffff" opacity="0.85"/>
    <text x="${mainX + 30}" y="${contentY + (compact ? 88 : 100)}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${compact ? 35 : 46}" font-weight="900" fill="#ffffff">${xml(theme.metrics[0])}</text>
    <rect x="${mainX + Math.floor(mainW * 0.55)}" y="${contentY}" width="${Math.floor(mainW * 0.45)}" height="${compact ? 114 : 132}" rx="30" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
    <text x="${mainX + Math.floor(mainW * 0.55) + 28}" y="${contentY + 50}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${compact ? 22 : 27}" font-weight="900" fill="#111827">Today</text>
    <text x="${mainX + Math.floor(mainW * 0.55) + 28}" y="${contentY + (compact ? 90 : 102)}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${compact ? 24 : 30}" font-weight="900" fill="${theme.accent2}">${xml(theme.metrics[1])}</text>
    ${rows}`;
}

function backgroundDefs(theme) {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="55%" stop-color="#eff6ff"/>
        <stop offset="100%" stop-color="#ecfdf5"/>
      </linearGradient>
      <radialGradient id="wash1" cx="12%" cy="10%" r="48%">
        <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="wash2" cx="86%" cy="26%" r="42%">
        <stop offset="0%" stop-color="${theme.warm}" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="${theme.warm}" stop-opacity="0"/>
      </radialGradient>
    </defs>`;
}

function shellSvg(theme, w, h, content) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    ${backgroundDefs(theme)}
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#wash1)"/>
    <rect width="${w}" height="${h}" fill="url(#wash2)"/>
    ${content}
  </svg>`;
}

async function writeSvg(svg, file) {
  ensureDir(path.dirname(file));
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
}

async function createFeatureGraphic() {
  const modelSource = path.join(outDir, "feature-graphic-model-source.png");
  const output = path.join(outDir, "feature-graphic.png");

  if (fs.existsSync(modelSource)) {
    const logo = await sharp(logoPath)
      .resize(330, null, { fit: "contain" })
      .png()
      .toBuffer();
    const overlay = Buffer.from(`
      <svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.96"/>
            <stop offset="55%" stop-color="#ffffff" stop-opacity="0.78"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect width="600" height="500" fill="url(#scrim)"/>
        <text x="72" y="236" font-family="Inter, Arial, Helvetica, sans-serif" font-size="38" font-weight="950" fill="#0f172a">AI marketing that moves</text>
        <text x="72" y="282" font-family="Inter, Arial, Helvetica, sans-serif" font-size="38" font-weight="950" fill="#0f172a">your business forward</text>
        <text x="74" y="332" font-family="Inter, Arial, Helvetica, sans-serif" font-size="22" font-weight="750" fill="#334155">Create content, listings, stores, and automations.</text>
        <rect x="72" y="374" width="104" height="38" rx="19" fill="#0ea5e9"/>
        <text x="101" y="399" font-family="Inter, Arial, Helvetica, sans-serif" font-size="15" font-weight="950" fill="#ffffff">CREATE</text>
        <rect x="190" y="374" width="122" height="38" rx="19" fill="#14b8a6"/>
        <text x="219" y="399" font-family="Inter, Arial, Helvetica, sans-serif" font-size="15" font-weight="950" fill="#ffffff">SCHEDULE</text>
        <rect x="326" y="374" width="92" height="38" rx="19" fill="#f97316"/>
        <text x="357" y="399" font-family="Inter, Arial, Helvetica, sans-serif" font-size="15" font-weight="950" fill="#ffffff">GROW</text>
      </svg>`);

    await sharp(modelSource)
      .resize(1024, 500, { fit: "cover", position: "center" })
      .composite([
        { input: overlay, left: 0, top: 0 },
        { input: logo, left: 68, top: 76 },
      ])
      .png({ compressionLevel: 9 })
      .toFile(output);
    return;
  }

  const theme = themes[0];
  const logo = dataUri(logoPath);
  const icon = dataUri(iconPath);
  const content = `
    <rect x="0" y="0" width="1024" height="500" fill="#f8fafc"/>
    <rect x="-80" y="-130" width="640" height="620" rx="110" fill="${theme.accent}" opacity="0.12"/>
    <rect x="640" y="-80" width="360" height="360" rx="96" fill="${theme.warm}" opacity="0.12"/>
    <image href="${icon}" x="74" y="98" width="224" height="224"/>
    <image href="${logo}" x="356" y="106" width="440" height="102"/>
    <text x="360" y="262" font-family="Inter, Arial, Helvetica, sans-serif" font-size="44" font-weight="900" fill="#0f172a">AI marketing, content, and growth in one app</text>
    <text x="362" y="312" font-family="Inter, Arial, Helvetica, sans-serif" font-size="25" font-weight="700" fill="#334155">Create campaigns, local listings, stores, and automations.</text>
    <rect x="360" y="352" width="152" height="48" rx="24" fill="${theme.accent}"/>
    <text x="386" y="384" font-family="Inter, Arial, Helvetica, sans-serif" font-size="19" font-weight="900" fill="#ffffff">CREATE</text>
    <rect x="530" y="352" width="152" height="48" rx="24" fill="${theme.accent2}"/>
    <text x="557" y="384" font-family="Inter, Arial, Helvetica, sans-serif" font-size="19" font-weight="900" fill="#ffffff">SCHEDULE</text>
    <rect x="700" y="352" width="152" height="48" rx="24" fill="${theme.warm}"/>
    <text x="733" y="384" font-family="Inter, Arial, Helvetica, sans-serif" font-size="19" font-weight="900" fill="#ffffff">GROW</text>`;
  await writeSvg(`<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">${content}</svg>`, output);
}

async function createPhone(theme, index) {
  const w = 1080;
  const h = 1920;
  const logo = dataUri(logoPath);
  const titleLines = wrap(theme.title, 22);
  const subtitleLines = wrap(theme.subtitle, 34);
  const content = `
    <image href="${logo}" x="80" y="76" width="360" height="84"/>
    ${textLines(titleLines, 80, 278, 86, "#0f172a", 950, 1.02)}
    ${textLines(subtitleLines, 82, 500, 34, "#475569", 700, 1.34)}
    ${metricPills(theme, 82, 650, 16)}
    ${screenMockup(theme, 86, 780, 908, 1010, true)}
    <text x="80" y="1842" font-family="Inter, Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="${theme.accent}">FlowSmartly for Android</text>`;
  await writeSvg(shellSvg(theme, w, h, content), path.join(outDir, "phone", `phone-${String(index + 1).padStart(2, "0")}-${theme.key}.png`));
}

async function createTablet(theme, index, folder, w, h) {
  const logo = dataUri(logoPath);
  const titleLines = wrap(theme.title, 28);
  const subtitleLines = wrap(theme.subtitle, 46);
  const content = `
    <image href="${logo}" x="116" y="110" width="500" height="116"/>
    ${textLines(titleLines, 116, 390, 106, "#0f172a", 950, 1.04)}
    ${textLines(subtitleLines, 120, 670, 42, "#475569", 700, 1.32)}
    ${metricPills(theme, 120, 845, 22)}
    ${screenMockup(theme, 120, 1010, w - 240, h - 1190, false)}
    <text x="120" y="${h - 90}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="34" font-weight="900" fill="${theme.accent}">FlowSmartly for Android</text>`;
  await writeSvg(shellSvg(theme, w, h, content), path.join(outDir, folder, `${folder}-${String(index + 1).padStart(2, "0")}-${theme.key}.png`));
}

async function createLandscape(theme, index, folder, w = 1920, h = 1080) {
  const logo = dataUri(logoPath);
  const titleLines = wrap(theme.title, 16);
  const subtitleLines = wrap(theme.subtitle, 38);
  const content = `
    <image href="${logo}" x="96" y="84" width="430" height="100"/>
    ${textLines(titleLines, 98, 300, 60, "#0f172a", 950, 1.08)}
    ${textLines(subtitleLines, 102, 520, 31, "#475569", 700, 1.34)}
    ${metricPills(theme, 102, 700, 18)}
    <rect x="92" y="872" width="348" height="58" rx="29" fill="${theme.accent}"/>
    <text x="135" y="910" font-family="Inter, Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="#ffffff">FlowSmartly for Android</text>
    ${screenMockup(theme, 650, 110, 1200, 860, false)}`;
  await writeSvg(shellSvg(theme, w, h, content), path.join(outDir, folder, `${folder}-${String(index + 1).padStart(2, "0")}-${theme.key}.png`));
}

async function writeReadme() {
  const lines = [
    "# Google Play Graphics",
    "",
    "Upload-ready FlowSmartly graphics generated from the real app icon/logo.",
    "",
    "- app-icon-512.png: 512x512 PNG, under 1 MB",
    "- feature-graphic.png: 1024x500 PNG, under 15 MB",
    "- phone/: four 1080x1920 PNG screenshots, 9:16, each side at least 1080 px",
    "- tablet-7/: four 1440x2560 PNG screenshots, 9:16",
    "- tablet-10/: four 1440x2560 PNG screenshots, 9:16, each side at least 1080 px",
    "- chromebook/: four 1920x1080 PNG screenshots, 16:9",
    "- android-xr/: four 1920x1080 PNG screenshots, 16:9",
    "",
    "Video fields can stay empty unless a public or unlisted YouTube demo is available.",
    "",
  ];
  fs.writeFileSync(path.join(outDir, "README.md"), lines.join("\n"));
}

async function main() {
  ensureDir(outDir);
  fs.copyFileSync(iconPath, path.join(outDir, "app-icon-512.png"));
  await createFeatureGraphic();

  for (const [index, theme] of themes.entries()) {
    await createPhone(theme, index);
    await createTablet(theme, index, "tablet-7", 1440, 2560);
    await createTablet(theme, index, "tablet-10", 1440, 2560);
    await createLandscape(theme, index, "chromebook");
    await createLandscape(theme, index, "android-xr");
  }

  await writeReadme();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
