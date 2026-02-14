/**
 * Template-based HTML generator for quick ad pages.
 * Generates responsive pages with embedded media + CTA redirect links.
 * No AI involved — instant generation from campaign data.
 */

export interface AdPageData {
  headline: string;
  description?: string;
  mediaUrl?: string;
  videoUrl?: string;
  destinationUrl: string;
  ctaText: string;
  slug: string;
  templateStyle: "minimal" | "hero" | "split" | "video";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateMetaTags(data: AdPageData): string {
  const desc = data.description
    ? escapeHtml(data.description.slice(0, 160))
    : escapeHtml(data.headline);
  return `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(data.headline)}</title>
    <meta name="description" content="${desc}">
    <meta property="og:title" content="${escapeHtml(data.headline)}">
    <meta property="og:description" content="${desc}">
    ${data.mediaUrl ? `<meta property="og:image" content="${escapeHtml(data.mediaUrl)}">` : ""}
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
  `;
}

function generateStyles(template: string): string {
  const common = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: #f8fafc;
      color: #1e293b;
    }
    .ad-container { flex: 1; display: flex; flex-direction: column; }
    .cta-btn {
      display: inline-block;
      padding: 14px 36px;
      background: #7c3aed;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      transition: background 0.2s, transform 0.1s;
      cursor: pointer;
      border: none;
    }
    .cta-btn:hover { background: #6d28d9; transform: translateY(-1px); }
    .cta-btn:active { transform: translateY(0); }
    .footer {
      text-align: center;
      padding: 16px;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    .footer a { color: #7c3aed; text-decoration: none; }
    img.ad-media, video.ad-media {
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      object-fit: cover;
    }
    h1 { font-size: 2rem; font-weight: 700; line-height: 1.2; }
    .description { font-size: 1.1rem; color: #475569; line-height: 1.6; }
  `;

  const templates: Record<string, string> = {
    minimal: `
      ${common}
      .ad-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 24px;
        text-align: center;
        max-width: 640px;
        margin: 0 auto;
        gap: 24px;
      }
      img.ad-media, video.ad-media { max-width: 480px; }
    `,
    hero: `
      ${common}
      .ad-content {
        flex: 1;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 60px 24px;
        gap: 24px;
      }
      .hero-bg {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        filter: brightness(0.35);
      }
      .hero-overlay {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        max-width: 700px;
      }
      .hero-overlay h1 { color: #fff; font-size: 2.5rem; text-shadow: 0 2px 8px rgba(0,0,0,0.4); }
      .hero-overlay .description { color: #e2e8f0; }
      img.ad-media, video.ad-media { max-width: 560px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    `,
    split: `
      ${common}
      .ad-content {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 48px;
        padding: 40px;
        max-width: 1100px;
        margin: 0 auto;
      }
      .split-media { flex: 1; min-width: 0; }
      .split-text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      img.ad-media, video.ad-media { width: 100%; max-height: 500px; }
      @media (max-width: 768px) {
        .ad-content { flex-direction: column; padding: 24px; gap: 24px; }
        .split-text { text-align: center; align-items: center; }
      }
    `,
    video: `
      ${common}
      .ad-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 24px;
        text-align: center;
        gap: 24px;
        max-width: 800px;
        margin: 0 auto;
      }
      video.ad-media {
        width: 100%;
        max-height: 450px;
        border-radius: 16px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      }
    `,
  };

  return templates[template] || templates.hero;
}

function generateMediaHtml(data: AdPageData): string {
  if (data.videoUrl) {
    return `<video class="ad-media" controls playsinline poster="${data.mediaUrl ? escapeHtml(data.mediaUrl) : ""}">
      <source src="${escapeHtml(data.videoUrl)}" type="video/mp4">
    </video>`;
  }
  if (data.mediaUrl) {
    return `<img class="ad-media" src="${escapeHtml(data.mediaUrl)}" alt="${escapeHtml(data.headline)}" loading="eager">`;
  }
  return "";
}

function generateClickScript(slug: string, destinationUrl: string): string {
  return `
    <script>
      document.getElementById('cta-button').addEventListener('click', function(e) {
        e.preventDefault();
        var dest = '${destinationUrl.replace(/'/g, "\\'")}';
        fetch('/api/ads/ad-pages/${slug}/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timestamp: Date.now() })
        }).finally(function() {
          window.location.href = dest;
        });
      });
    </script>
  `;
}

function generateMinimalTemplate(data: AdPageData): string {
  return `
    <div class="ad-content">
      ${generateMediaHtml(data)}
      <h1>${escapeHtml(data.headline)}</h1>
      ${data.description ? `<p class="description">${escapeHtml(data.description)}</p>` : ""}
      <a id="cta-button" href="${escapeHtml(data.destinationUrl)}" class="cta-btn">${escapeHtml(data.ctaText)}</a>
    </div>
  `;
}

function generateHeroTemplate(data: AdPageData): string {
  const bgStyle = data.mediaUrl
    ? `background-image: url('${escapeHtml(data.mediaUrl)}')`
    : "background: linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #7c3aed 100%)";

  return `
    <div class="ad-content">
      <div class="hero-bg" style="${bgStyle}"></div>
      <div class="hero-overlay">
        <h1>${escapeHtml(data.headline)}</h1>
        ${data.description ? `<p class="description">${escapeHtml(data.description)}</p>` : ""}
        ${data.videoUrl ? generateMediaHtml(data) : ""}
        <a id="cta-button" href="${escapeHtml(data.destinationUrl)}" class="cta-btn">${escapeHtml(data.ctaText)}</a>
      </div>
    </div>
  `;
}

function generateSplitTemplate(data: AdPageData): string {
  return `
    <div class="ad-content">
      <div class="split-media">
        ${generateMediaHtml(data)}
      </div>
      <div class="split-text">
        <h1>${escapeHtml(data.headline)}</h1>
        ${data.description ? `<p class="description">${escapeHtml(data.description)}</p>` : ""}
        <a id="cta-button" href="${escapeHtml(data.destinationUrl)}" class="cta-btn">${escapeHtml(data.ctaText)}</a>
      </div>
    </div>
  `;
}

function generateVideoTemplate(data: AdPageData): string {
  return `
    <div class="ad-content">
      <h1>${escapeHtml(data.headline)}</h1>
      ${generateMediaHtml(data)}
      ${data.description ? `<p class="description">${escapeHtml(data.description)}</p>` : ""}
      <a id="cta-button" href="${escapeHtml(data.destinationUrl)}" class="cta-btn">${escapeHtml(data.ctaText)}</a>
    </div>
  `;
}

export function generateAdPageHtml(data: AdPageData): string {
  const templateRenderers: Record<string, (d: AdPageData) => string> = {
    minimal: generateMinimalTemplate,
    hero: generateHeroTemplate,
    split: generateSplitTemplate,
    video: generateVideoTemplate,
  };

  const render = templateRenderers[data.templateStyle] || generateHeroTemplate;
  const body = render(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${generateMetaTags(data)}
  <style>${generateStyles(data.templateStyle)}</style>
</head>
<body>
  <div class="ad-container">
    ${body}
    <div class="footer">
      Powered by <a href="https://flowsmartly.com" target="_blank" rel="noopener">FlowSmartly</a>
    </div>
  </div>
  ${generateClickScript(data.slug, data.destinationUrl)}
</body>
</html>`;
}

export function generateAdPageSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "ad-";
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}
