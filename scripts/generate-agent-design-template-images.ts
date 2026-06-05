import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { AGENT_DESIGN_TEMPLATES } from "../src/lib/ai/flow-agent/design-templates";
import type { AgentDesignTemplate } from "../src/lib/ai/flow-agent/design-templates";

const OUT_ROOT = path.join(process.cwd(), "public", "agent-design-templates");
const IMAGE_DIR = path.join(OUT_ROOT, "images");
const THUMB_DIR = path.join(OUT_ROOT, "thumbs");
const META_DIR = path.join(OUT_ROOT, "meta");

async function main() {
  await Promise.all([
    mkdir(IMAGE_DIR, { recursive: true }),
    mkdir(THUMB_DIR, { recursive: true }),
    mkdir(META_DIR, { recursive: true }),
  ]);

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: AGENT_DESIGN_TEMPLATES.length,
    templates: [] as Array<{
      id: string;
      name: string;
      industry: string;
      industryLabel: string;
      imageUrl: string;
      thumbnailUrl: string;
      metaUrl: string;
      metaTags: string[];
    }>,
  };

  for (const template of AGENT_DESIGN_TEMPLATES) {
    const svg = renderTemplateSvg(template);
    const imagePath = path.join(IMAGE_DIR, `${template.id}.png`);
    const thumbPath = path.join(THUMB_DIR, `${template.id}.png`);
    const metaPath = path.join(META_DIR, `${template.id}.json`);

    await sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(imagePath);
    await sharp(Buffer.from(svg))
      .resize({ width: 480, withoutEnlargement: true })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(thumbPath);

    const meta = {
      id: template.id,
      name: template.name,
      industry: template.industry,
      industryLabel: template.industryLabel,
      useCase: template.useCase,
      audience: template.audience,
      format: template.format,
      palette: template.palette,
      copySlots: template.copySlots,
      industryTags: template.industryTags,
      styleTags: template.styleTags,
      metaTags: template.metaTags,
      imageUrl: template.imageUrl,
      thumbnailUrl: template.thumbnailUrl,
      promptGuidance: template.promptGuidance,
    };
    await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");

    manifest.templates.push({
      id: template.id,
      name: template.name,
      industry: template.industry,
      industryLabel: template.industryLabel,
      imageUrl: template.imageUrl,
      thumbnailUrl: template.thumbnailUrl,
      metaUrl: template.metaUrl,
      metaTags: template.metaTags,
    });
  }

  await writeFile(path.join(OUT_ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Generated ${AGENT_DESIGN_TEMPLATES.length} agent design template images in ${OUT_ROOT}`);
}

function renderTemplateSvg(template: AgentDesignTemplate): string {
  const { width, height } = template.format;
  const p = template.palette;
  const variant = template.id.split("-").slice(-2).join("-");
  const patternId = `p-${template.id}`;
  const gradientId = `g-${template.id}`;
  const title = template.name.replace(template.industryLabel, "").trim();
  const headline = headlineFor(template);
  const subhead = subheadFor(template);
  const cta = ctaFor(template);
  const proof = proofFor(template);
  const isLandscape = width > height;
  const margin = Math.round(Math.min(width, height) * 0.07);
  const footerY = height - margin - 64;

  const body = variant === "launch-offer"
    ? launchOffer(template, { margin, footerY, headline, subhead, cta, proof })
    : variant === "trust-story"
      ? trustStory(template, { margin, footerY, headline, subhead, cta, proof })
      : variant === "event-invite"
        ? eventInvite(template, { margin, footerY, headline, subhead, cta, proof })
        : premiumShowcase(template, { margin, footerY, headline, subhead, cta, proof });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.background}"/>
      <stop offset="52%" stop-color="${p.primary}"/>
      <stop offset="100%" stop-color="${p.secondary}"/>
    </linearGradient>
    <pattern id="${patternId}" width="96" height="96" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
      <rect width="96" height="96" fill="transparent"/>
      <circle cx="10" cy="10" r="2" fill="${p.accent}" opacity="0.28"/>
      <path d="M0 76H96" stroke="${p.text}" stroke-width="1" opacity="0.06"/>
    </pattern>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000000" flood-opacity="0.24"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#${gradientId})"/>
  <rect width="${width}" height="${height}" fill="url(#${patternId})"/>
  <circle cx="${isLandscape ? width * 0.86 : width * 0.78}" cy="${height * 0.16}" r="${Math.min(width, height) * 0.25}" fill="${p.accent}" opacity="0.2"/>
  <circle cx="${isLandscape ? width * 0.75 : width * 0.14}" cy="${height * 0.88}" r="${Math.min(width, height) * 0.19}" fill="${p.secondary}" opacity="0.18"/>
  ${body}
  <text x="${margin}" y="${height - 28}" font-family="Inter, Arial, sans-serif" font-size="${Math.round(Math.min(width, height) * 0.017)}" font-weight="700" fill="${p.text}" opacity="0.55">${esc(template.metaTags.slice(0, 5).join("  /  "))}</text>
</svg>`;

  function launchOffer(t: AgentDesignTemplate, data: RenderData) {
    const heroX = isLandscape ? width * 0.62 : width * 0.57;
    const heroY = isLandscape ? height * 0.18 : height * 0.23;
    const heroW = isLandscape ? width * 0.28 : width * 0.34;
    const heroH = isLandscape ? height * 0.62 : height * 0.42;
    return `
      ${eyebrow(t.industryLabel.toUpperCase(), margin, margin + 24)}
      ${textBlock(data.headline, margin, isLandscape ? height * 0.24 : height * 0.22, isLandscape ? width * 0.44 : width * 0.78, isLandscape ? 86 : 74, 0.94, 900)}
      ${textBlock(data.subhead, margin, isLandscape ? height * 0.48 : height * 0.44, isLandscape ? width * 0.38 : width * 0.74, isLandscape ? 31 : 30, 1.24, 500, 0.82)}
      ${pill(margin, isLandscape ? height * 0.68 : height * 0.64, data.cta)}
      <rect x="${heroX}" y="${heroY}" width="${heroW}" height="${heroH}" rx="34" fill="${p.secondary}" opacity="0.24" filter="url(#softShadow)"/>
      <rect x="${heroX + 28}" y="${heroY + 36}" width="${heroW - 56}" height="${heroH - 72}" rx="28" fill="${p.background}" opacity="0.7"/>
      ${industryMark(t, heroX + heroW / 2, heroY + heroH / 2, Math.min(heroW, heroH) * 0.34)}
      ${badge(width - margin - 240, margin + 28, data.proof)}
      ${footer(data.footerY)}
    `;
  }

  function trustStory(t: AgentDesignTemplate, data: RenderData) {
    const photoX = margin;
    const photoY = height * 0.18;
    const photoW = width - margin * 2;
    const photoH = height * 0.34;
    return `
      ${eyebrow(`${t.industryLabel.toUpperCase()} / TRUST`, margin, margin + 14)}
      <rect x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" rx="38" fill="${p.secondary}" opacity="0.28" filter="url(#softShadow)"/>
      <path d="M${photoX} ${photoY + photoH} C${width * 0.3} ${photoY + photoH - 130}, ${width * 0.58} ${photoY + 80}, ${photoX + photoW} ${photoY + 32}" fill="none" stroke="${p.accent}" stroke-width="16" opacity="0.75"/>
      ${industryMark(t, width / 2, photoY + photoH / 2, Math.min(photoW, photoH) * 0.24)}
      ${textBlock(data.headline, margin, height * 0.59, width - margin * 2, 64, 1.02, 900)}
      ${textBlock(data.subhead, margin, height * 0.72, width - margin * 2, 28, 1.28, 500, 0.82)}
      ${proofRow(margin, height * 0.83, width - margin * 2, t.copySlots.slice(2, 5))}
      ${footer(data.footerY)}
    `;
  }

  function eventInvite(t: AgentDesignTemplate, data: RenderData) {
    const cardX = margin;
    const cardY = margin;
    const cardW = width - margin * 2;
    const cardH = height - margin * 2;
    return `
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="44" fill="${p.background}" opacity="0.56" stroke="${p.text}" stroke-opacity="0.18" stroke-width="2"/>
      ${eyebrow(`${t.industryLabel.toUpperCase()} EVENT`, width / 2 - 210, cardY + 84, "middle")}
      <text x="${width / 2}" y="${cardY + 216}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="108" font-weight="900" fill="${p.accent}">15</text>
      <text x="${width / 2}" y="${cardY + 260}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" letter-spacing="8" fill="${p.text}" opacity="0.78">THIS MONTH</text>
      ${textBlock(data.headline, cardX + 70, cardY + 350, cardW - 140, 68, 1.0, 900, 1, "middle")}
      ${textBlock(data.subhead, cardX + 110, cardY + 560, cardW - 220, 29, 1.28, 500, 0.84, "middle")}
      <path d="M${cardX + 80} ${cardY + cardH - 300} H${cardX + cardW - 80}" stroke="${p.text}" stroke-width="2" stroke-dasharray="12 18" opacity="0.28"/>
      ${pill(width / 2 - 170, cardY + cardH - 230, data.cta)}
      ${footer(data.footerY)}
    `;
  }

  function premiumShowcase(t: AgentDesignTemplate, data: RenderData) {
    const leftW = isLandscape ? width * 0.48 : width - margin * 2;
    const heroX = isLandscape ? width * 0.56 : margin;
    const heroY = isLandscape ? margin + 40 : height * 0.54;
    const heroW = isLandscape ? width * 0.34 : width - margin * 2;
    const heroH = isLandscape ? height - margin * 2 - 80 : height * 0.28;
    return `
      ${eyebrow(`${t.industryLabel.toUpperCase()} / PREMIUM`, margin, margin + 24)}
      ${textBlock(data.headline, margin, isLandscape ? height * 0.24 : height * 0.18, leftW, isLandscape ? 88 : 66, 0.96, 900)}
      ${textBlock(data.subhead, margin, isLandscape ? height * 0.53 : height * 0.38, leftW * 0.9, isLandscape ? 30 : 27, 1.28, 500, 0.84)}
      ${metricCard(margin, isLandscape ? height * 0.72 : height * 0.46, data.proof)}
      <rect x="${heroX}" y="${heroY}" width="${heroW}" height="${heroH}" rx="46" fill="${p.secondary}" opacity="0.22" filter="url(#softShadow)"/>
      <circle cx="${heroX + heroW * 0.34}" cy="${heroY + heroH * 0.42}" r="${Math.min(heroW, heroH) * 0.23}" fill="${p.accent}" opacity="0.62"/>
      <circle cx="${heroX + heroW * 0.67}" cy="${heroY + heroH * 0.58}" r="${Math.min(heroW, heroH) * 0.3}" fill="${p.primary}" opacity="0.52"/>
      ${industryMark(t, heroX + heroW / 2, heroY + heroH / 2, Math.min(heroW, heroH) * 0.2)}
      ${footer(data.footerY)}
    `;
  }

  function eyebrow(label: string, x: number, y: number, anchor: "start" | "middle" = "start") {
    return `<text x="${x}" y="${y}" ${anchor === "middle" ? `text-anchor="${anchor}"` : ""} font-family="Inter, Arial, sans-serif" font-size="${Math.round(Math.min(width, height) * 0.026)}" font-weight="800" letter-spacing="7" fill="${p.text}" opacity="0.76">${esc(label)}</text>`;
  }

  function textBlock(text: string, x: number, y: number, maxW: number, fontSize: number, lineHeight: number, weight: number, opacity = 1, anchor: "start" | "middle" = "start") {
    const lines = wrap(text, Math.max(8, Math.floor(maxW / (fontSize * 0.54))), 4);
    const tx = anchor === "middle" ? x + maxW / 2 : x;
    return `<text x="${tx}" y="${y}" ${anchor === "middle" ? `text-anchor="${anchor}"` : ""} font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${p.text}" opacity="${opacity}">
      ${lines.map((line, i) => `<tspan x="${tx}" dy="${i === 0 ? 0 : fontSize * lineHeight}">${esc(line)}</tspan>`).join("")}
    </text>`;
  }

  function pill(x: number, y: number, label: string) {
    return `<rect x="${x}" y="${y}" width="340" height="78" rx="39" fill="${p.accent}" filter="url(#softShadow)"/>
      <text x="${x + 170}" y="${y + 49}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="900" fill="${contrastText(p.accent)}" letter-spacing="2">${esc(label)}</text>`;
  }

  function badge(x: number, y: number, label: string) {
    return `<rect x="${x}" y="${y}" width="240" height="112" rx="30" fill="${p.text}" opacity="0.92"/>
      <text x="${x + 120}" y="${y + 47}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900" fill="${p.background}">${esc(label.split(" ")[0])}</text>
      <text x="${x + 120}" y="${y + 78}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="800" fill="${p.background}" opacity="0.72">${esc(label.split(" ").slice(1).join(" "))}</text>`;
  }

  function metricCard(x: number, y: number, label: string) {
    return `<rect x="${x}" y="${y}" width="390" height="126" rx="28" fill="${p.text}" opacity="0.9"/>
      <text x="${x + 34}" y="${y + 50}" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="900" fill="${p.background}">${esc(label)}</text>
      <text x="${x + 34}" y="${y + 86}" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="${p.background}" opacity="0.68">Proof point zone</text>`;
  }

  function proofRow(x: number, y: number, rowW: number, labels: string[]) {
    const gap = 18;
    const w = (rowW - gap * 2) / 3;
    return labels.slice(0, 3).map((label, i) => {
      const px = x + i * (w + gap);
      return `<rect x="${px}" y="${y}" width="${w}" height="98" rx="22" fill="${p.text}" opacity="0.14"/>
        <text x="${px + w / 2}" y="${y + 56}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="800" fill="${p.text}" opacity="0.82">${esc(titleCase(label))}</text>`;
    }).join("");
  }

  function footer(y: number) {
    return `<rect x="${margin}" y="${y}" width="${width - margin * 2}" height="64" rx="24" fill="${p.text}" opacity="0.12"/>
      <text x="${margin + 28}" y="${y + 40}" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="800" fill="${p.text}" opacity="0.72">Brand name / contact / web</text>`;
  }

  function industryMark(t: AgentDesignTemplate, cx: number, cy: number, r: number) {
    const initials = t.industryLabel.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.text}" opacity="0.16"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="${p.accent}" opacity="0.9"/>
      <text x="${cx}" y="${cy + r * 0.16}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${r * 0.62}" font-weight="900" fill="${contrastText(p.accent)}">${esc(initials)}</text>`;
  }
}

type RenderData = {
  margin: number;
  footerY: number;
  headline: string;
  subhead: string;
  cta: string;
  proof: string;
};

function headlineFor(template: AgentDesignTemplate): string {
  if (template.id.endsWith("launch-offer")) return `${template.industryLabel} offer made to move`;
  if (template.id.endsWith("trust-story")) return `Trusted ${template.industryLabel.toLowerCase()} experience`;
  if (template.id.endsWith("event-invite")) return `${template.industryLabel} event invite`;
  return `Premium ${template.industryLabel.toLowerCase()} growth`;
}

function subheadFor(template: AgentDesignTemplate): string {
  const audience = template.audience[0] || "customers";
  if (template.id.endsWith("launch-offer")) return `A polished conversion layout for ${audience} with a clear offer, proof, and action.`;
  if (template.id.endsWith("trust-story")) return `A warm credibility layout that helps ${audience} understand why this business is the right choice.`;
  if (template.id.endsWith("event-invite")) return `Date, details, and RSVP are arranged for fast scanning and confident attendance.`;
  return `A wide hero system for paid ads, website sections, and sales-ready brand creative.`;
}

function ctaFor(template: AgentDesignTemplate): string {
  if (template.id.endsWith("event-invite")) return "RSVP NOW";
  if (template.id.endsWith("trust-story")) return "BOOK A CALL";
  if (template.id.endsWith("premium-showcase")) return "GET STARTED";
  return "CLAIM OFFER";
}

function proofFor(template: AgentDesignTemplate): string {
  if (template.id.endsWith("launch-offer")) return "New offer";
  if (template.id.endsWith("trust-story")) return "3 proof points";
  if (template.id.endsWith("event-invite")) return "Seats open";
  return "Results ready";
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function contrastText(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#111827";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? "#111827" : "#ffffff";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
