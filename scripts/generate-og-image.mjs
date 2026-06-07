import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Layout is vertically centered. Content block is ~500px tall, leaving ~65px
// top + bottom padding for breathing room.
//
// Leslie Benefield  66px italic  (baseline y=118)
// ─────── rule ───────────────  (y=132)
// WEBSITE DESIGNER & DEVELOPER  14px caps  (baseline y=168)
// [gap ~40px]
// Websites with   128px bold  (baseline y=312)
// personality.    128px bold  (baseline y=453)
// [gap ~24px]
// Custom websites…  22px serif  (baseline y=501)
// and service prov…             (baseline y=527)
//
// Content top ~y=66, bottom ~y=541 → span 475px → centered in 630px → ~77px padding each side.

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <!-- Coastal gradient: seafoam top-left → deeper aqua bottom-right -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#DFF0EC"/>
      <stop offset="55%"  stop-color="#C4D9D6"/>
      <stop offset="100%" stop-color="#A0C8C4"/>
    </linearGradient>

    <!-- Teal glow top-right -->
    <radialGradient id="gtr" cx="1140" cy="28" r="520" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#2D8A79" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#2D8A79" stop-opacity="0"/>
    </radialGradient>

    <!-- Seafoam glow bottom-left (fills lower space intentionally) -->
    <radialGradient id="gbl" cx="80"   cy="590" r="500" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#88B8B4" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#88B8B4" stop-opacity="0"/>
    </radialGradient>

    <!-- Soft centre glow — warms up the middle of the frame -->
    <radialGradient id="gctr" cx="600" cy="380" r="420" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#A0C8C4" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#A0C8C4" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- ── Background layers ──────────────────────────────── -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#gtr)"/>
  <rect width="1200" height="630" fill="url(#gbl)"/>
  <rect width="1200" height="630" fill="url(#gctr)"/>

  <!-- ── Decorative rings ───────────────────────────────── -->
  <circle cx="1152" cy="52"  r="245" fill="none" stroke="#2D8A79" stroke-width="1.5" opacity="0.14"/>
  <circle cx="1152" cy="52"  r="172" fill="none" stroke="#2D8A79" stroke-width="1"   opacity="0.09"/>
  <circle cx="48"   cy="600" r="215" fill="none" stroke="#1D6A5A" stroke-width="1.5" opacity="0.12"/>
  <circle cx="48"   cy="600" r="148" fill="none" stroke="#1D6A5A" stroke-width="1"   opacity="0.08"/>

  <!-- Dot accents -->
  <circle cx="86"  cy="56" r="4.5" fill="#2D8A79" opacity="0.28"/>
  <circle cx="108" cy="56" r="4.5" fill="#2D8A79" opacity="0.19"/>
  <circle cx="130" cy="56" r="4.5" fill="#2D8A79" opacity="0.12"/>
  <circle cx="1070" cy="575" r="4.5" fill="#2D8A79" opacity="0.28"/>
  <circle cx="1092" cy="575" r="4.5" fill="#2D8A79" opacity="0.19"/>
  <circle cx="1114" cy="575" r="4.5" fill="#2D8A79" opacity="0.12"/>

  <!-- ── Leslie Benefield — flanking rules ─────────────── -->
  <!-- Text at 66px italic Georgia ≈ 360px wide centered → edges at x≈420/780 -->
  <rect x="215" y="106" width="185" height="1.8" rx="0.9" fill="#2D8A79" opacity="0.50"/>
  <rect x="800" y="106" width="185" height="1.8" rx="0.9" fill="#2D8A79" opacity="0.50"/>

  <text x="600" y="120" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-style="italic" font-size="52" fill="#192B38" opacity="0.72">
    Leslie Benefield
  </text>

  <!-- ── Thin divider ───────────────────────────────────── -->
  <rect x="552" y="132" width="96" height="1.8" rx="0.9" fill="#2D8A79" opacity="0.55"/>

  <!-- ── Eyebrow ────────────────────────────────────────── -->
  <text x="600" y="170" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="14" font-weight="600" letter-spacing="5.5" fill="#2D8A79">
    WEBSITE DESIGNER &amp; DEVELOPER
  </text>

  <!-- ── Main headline ─────────────────────────────────── -->
  <text x="600" y="312" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="128" font-weight="700" fill="#192B38">
    Websites with
  </text>
  <text x="600" y="453" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="128" font-weight="700" fill="#192B38">
    personality.
  </text>

  <!-- ── Tagline ────────────────────────────────────────── -->
  <text x="600" y="501" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="22" fill="#3A5264">
    Custom websites for small businesses, creators,
  </text>
  <text x="600" y="527" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="22" fill="#3A5264">
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
