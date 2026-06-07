import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <!-- Background gradient: top-left seafoam → bottom-right deeper aqua -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#DFF0EC"/>
      <stop offset="55%"  stop-color="#C8DCDA"/>
      <stop offset="100%" stop-color="#A8CFCA"/>
    </linearGradient>

    <!-- Teal glow top-right -->
    <radialGradient id="glow-tr" cx="1140" cy="32" r="540" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#2D8A79" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#2D8A79" stop-opacity="0"/>
    </radialGradient>

    <!-- Seafoam glow bottom-left -->
    <radialGradient id="glow-bl" cx="60" cy="598" r="480" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#88B8B4" stop-opacity="0.68"/>
      <stop offset="100%" stop-color="#88B8B4" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- ── Backgrounds ───────────────────────────────────── -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow-tr)"/>
  <rect width="1200" height="630" fill="url(#glow-bl)"/>

  <!-- ── Decorative ring top-right ─────────────────────── -->
  <circle cx="1148" cy="58"  r="235" fill="none" stroke="#2D8A79" stroke-width="1.5" opacity="0.15"/>
  <circle cx="1148" cy="58"  r="168" fill="none" stroke="#2D8A79" stroke-width="1"   opacity="0.10"/>
  <circle cx="1148" cy="58"  r="100" fill="none" stroke="#2D8A79" stroke-width="0.8" opacity="0.07"/>

  <!-- ── Decorative ring bottom-left ───────────────────── -->
  <circle cx="52"   cy="592" r="210" fill="none" stroke="#1D6A5A" stroke-width="1.5" opacity="0.13"/>
  <circle cx="52"   cy="592" r="145" fill="none" stroke="#1D6A5A" stroke-width="1"   opacity="0.09"/>

  <!-- ── Dot accents top-left ───────────────────────────── -->
  <circle cx="88"  cy="55" r="4" fill="#2D8A79" opacity="0.28"/>
  <circle cx="108" cy="55" r="4" fill="#2D8A79" opacity="0.20"/>
  <circle cx="128" cy="55" r="4" fill="#2D8A79" opacity="0.13"/>

  <!-- ── Dot accents bottom-right ──────────────────────── -->
  <circle cx="1072" cy="576" r="4" fill="#2D8A79" opacity="0.28"/>
  <circle cx="1092" cy="576" r="4" fill="#2D8A79" opacity="0.20"/>
  <circle cx="1112" cy="576" r="4" fill="#2D8A79" opacity="0.13"/>

  <!-- ── Brand name (script/italic, softly visible) ────── -->
  <text x="600" y="150" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-style="italic" font-size="40" fill="#192B38" opacity="0.58">
    Websites by Leslie
  </text>

  <!-- ── Thin teal rule ────────────────────────────────── -->
  <rect x="550" y="165" width="100" height="2" rx="1" fill="#2D8A79" opacity="0.55"/>

  <!-- ── Eyebrow ────────────────────────────────────────── -->
  <text x="600" y="202" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="14" font-weight="600" letter-spacing="4" fill="#2D8A79">
    WEBSITE DESIGNER &amp; DEVELOPER
  </text>

  <!-- ── Main headline ─────────────────────────────────── -->
  <text x="600" y="322" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="86" font-weight="bold" fill="#192B38">
    Websites with
  </text>
  <text x="600" y="420" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="86" font-weight="bold" fill="#192B38">
    personality.
  </text>

  <!-- ── Tagline ────────────────────────────────────────── -->
  <text x="600" y="483" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="21" fill="#3A5264">
    Custom websites for small businesses, creators,
  </text>
  <text x="600" y="509" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="21" fill="#3A5264">
    and service providers.
  </text>

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

const outputPath = join(__dirname, '..', 'public', 'social-preview.jpg');
writeFileSync(outputPath, jpgBuffer);

console.log(`✓  Saved: public/social-preview.jpg`);
console.log(`   Size:  ${(jpgBuffer.length / 1024).toFixed(1)} KB`);
console.log(`   Dims:  1200 × 630 px`);
