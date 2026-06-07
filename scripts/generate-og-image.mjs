import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Designed natively at 1200×630 — no scaling from a larger format.
// Fonts: Georgia italic (name), Helvetica Neue Bold (headline), Helvetica (UI/tagline).
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#DFF0EC"/>
      <stop offset="55%"  stop-color="#C8DCDA"/>
      <stop offset="100%" stop-color="#A8CFCA"/>
    </linearGradient>
    <radialGradient id="glow-tr" cx="1140" cy="32" r="540" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#2D8A79" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#2D8A79" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-bl" cx="60" cy="598" r="480" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#88B8B4" stop-opacity="0.70"/>
      <stop offset="100%" stop-color="#88B8B4" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- ── Background ─────────────────────────────────────── -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow-tr)"/>
  <rect width="1200" height="630" fill="url(#glow-bl)"/>

  <!-- ── Decorative rings ───────────────────────────────── -->
  <circle cx="1148" cy="58"  r="230" fill="none" stroke="#2D8A79" stroke-width="1.5" opacity="0.13"/>
  <circle cx="1148" cy="58"  r="162" fill="none" stroke="#2D8A79" stroke-width="1"   opacity="0.09"/>
  <circle cx="52"   cy="592" r="200" fill="none" stroke="#1D6A5A" stroke-width="1.5" opacity="0.11"/>

  <!-- ── Leslie Benefield — flanking rules + script name ── -->
  <rect x="230" y="103" width="195" height="1.5" rx="0.75" fill="#2D8A79" opacity="0.45"/>
  <rect x="775" y="103" width="195" height="1.5" rx="0.75" fill="#2D8A79" opacity="0.45"/>

  <text x="600" y="120" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-style="italic" font-size="46" fill="#192B38" opacity="0.68">
    Leslie Benefield
  </text>

  <!-- ── Eyebrow ────────────────────────────────────────── -->
  <text x="600" y="178" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="14" font-weight="600" letter-spacing="5" fill="#2D8A79">
    WEBSITE DESIGNER &amp; DEVELOPER
  </text>

  <!-- ── Headline ───────────────────────────────────────── -->
  <text x="600" y="302" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="96" font-weight="700" fill="#192B38">
    Websites with
  </text>
  <text x="600" y="408" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="96" font-weight="700" fill="#192B38">
    personality.
  </text>

  <!-- ── Tagline ────────────────────────────────────────── -->
  <text x="600" y="472" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="23" fill="#3A5264">
    Custom websites for small businesses, creators,
  </text>
  <text x="600" y="500" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="23" fill="#3A5264">
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
