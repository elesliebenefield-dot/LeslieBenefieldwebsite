import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#FDFCFA"/>
      <stop offset="50%"  stop-color="#F4F8F8"/>
      <stop offset="100%" stop-color="#EEF5F5"/>
    </linearGradient>

    <radialGradient id="gtr" cx="1100" cy="60" r="450" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#4DA3A8" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#4DA3A8" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="gbl" cx="100" cy="570" r="400" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#E4BDC6" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#E4BDC6" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#gtr)"/>
  <rect width="1200" height="630" fill="url(#gbl)"/>

  <!-- Blush accent bar at top -->
  <rect x="0" y="0" width="1200" height="4" fill="#E4BDC6"/>

  <!-- Decorative dots -->
  <circle cx="86"  cy="48" r="3.5" fill="#4DA3A8" opacity="0.20"/>
  <circle cx="104" cy="48" r="3.5" fill="#4DA3A8" opacity="0.12"/>
  <circle cx="122" cy="48" r="3.5" fill="#4DA3A8" opacity="0.06"/>
  <circle cx="1078" cy="582" r="3.5" fill="#E4BDC6" opacity="0.20"/>
  <circle cx="1096" cy="582" r="3.5" fill="#E4BDC6" opacity="0.12"/>
  <circle cx="1114" cy="582" r="3.5" fill="#E4BDC6" opacity="0.06"/>

  <!-- Name -->
  <text x="600" y="115" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-style="italic" font-size="48" fill="#E4BDC6" opacity="0.80">
    Leslie Benefield
  </text>

  <!-- Thin divider -->
  <rect x="545" y="130" width="110" height="1.5" rx="0.75" fill="#4DA3A8" opacity="0.30"/>

  <!-- Eyebrow -->
  <text x="600" y="165" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="13" font-weight="600" letter-spacing="5" fill="#4DA3A8">
    INDEPENDENT WEB DEVELOPER
  </text>

  <!-- Main headline -->
  <text x="600" y="275" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="72" font-weight="700" fill="#1F3347">
    Helping small businesses
  </text>
  <text x="600" y="360" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="72" font-weight="700" fill="#1F3347">
    get online.
  </text>

  <!-- Blush accent underline -->
  <rect x="465" y="378" width="270" height="3.5" rx="1.75" fill="#E4BDC6" opacity="0.50"/>

  <!-- Tagline -->
  <text x="600" y="440" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="22" fill="#5D7385">
    Clean, affordable websites — without the DIY headache.
  </text>

  <!-- Sub-tagline -->
  <text x="600" y="475" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="18" fill="#5D7385" opacity="0.70">
    Built for real businesses, not enterprise budgets.
  </text>

  <!-- Sea glass bar at bottom -->
  <rect x="0" y="626" width="1200" height="4" fill="#4DA3A8"/>
</svg>
`;

const resvg = new Resvg(svg.trim(), {
  fitTo: { mode: 'width', value: 1200 },
  font:  { loadSystemFonts: true },
});

const pngBuffer = resvg.render().asPng();

const jpgBuffer = await sharp(pngBuffer)
  .jpeg({ quality: 93, progressive: true, mozjpeg: true })
  .toBuffer();

const outputPath = join(__dirname, '..', 'public', 'social-preview-v2.jpg');
writeFileSync(outputPath, jpgBuffer);

console.log(`✓  Saved: public/social-preview-v2.jpg`);
console.log(`   Size:  ${(jpgBuffer.length / 1024).toFixed(1)} KB`);
