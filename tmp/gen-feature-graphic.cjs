const sharp = require('sharp');
const fs = require('fs');

const W = 1024, H = 500;
const logoBuf = fs.readFileSync('public/icon-512.png');

function pill(x, y, w, label) {
  const h = 46, r = 23;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#ffffff" fill-opacity="0.08" stroke="#7dd3fc" stroke-opacity="0.35" stroke-width="1.5"/>
    <text x="${x + w/2}" y="${y + 30}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" fill="#e2f4ff">${label}</text>`;
}

(async () => {
  const logo = await sharp(logoBuf).resize(300, 300, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).png().toBuffer();

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1326"/>
      <stop offset="50%" stop-color="#0c2547"/>
      <stop offset="100%" stop-color="#0a1832"/>
    </linearGradient>
    <radialGradient id="glow1" cx="22%" cy="50%" r="42%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.50"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="82%" cy="18%" r="55%">
      <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow1)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>

  <circle cx="860" cy="110" r="190" fill="none" stroke="#7dd3fc" stroke-opacity="0.08" stroke-width="2"/>
  <circle cx="940" cy="440" r="130" fill="none" stroke="#7dd3fc" stroke-opacity="0.06" stroke-width="2"/>

  <circle cx="220" cy="250" r="165" fill="url(#glow1)"/>

  <text x="430" y="178" font-family="Arial, Helvetica, sans-serif" font-size="82" font-weight="800" fill="#ffffff" letter-spacing="-1">FlowSmartly</text>
  <text x="433" y="228" font-family="Arial, Helvetica, sans-serif" font-size="33" font-weight="700" fill="#7dd3fc">AI Marketing Assistant</text>
  <text x="433" y="284" font-family="Arial, Helvetica, sans-serif" font-size="25" fill="#cbd5e1">Create, schedule &amp; grow — all powered by AI.</text>

  ${pill(433, 322, 150, 'AI Content')}
  ${pill(597, 322, 160, 'Scheduling')}
  ${pill(771, 322, 140, 'Analytics')}

  <rect x="0" y="${H-6}" width="${W}" height="6" fill="url(#accent)"/>
</svg>`;

  await sharp(Buffer.from(svg))
    .composite([{ input: logo, left: 70, top: 100 }])
    .png()
    .toFile('tmp/play-assets/feature-graphic.png');

  const stat = fs.statSync('tmp/play-assets/feature-graphic.png');
  console.log('feature-graphic: 1024x500 png', Math.round(stat.size/1024)+'KB');
})();
