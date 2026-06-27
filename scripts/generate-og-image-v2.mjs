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
      <stop offset="60%"  stop-color="#F2F7F7"/>
      <stop offset="100%" stop-color="#EEF5F5"/>
    </linearGradient>

    <radialGradient id="gtr" cx="1100" cy="400" r="500" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#4DA3A8" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#4DA3A8" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="gbl" cx="100" cy="400" r="450" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#E4BDC6" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#E4BDC6" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Main background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#gtr)"/>
  <rect width="1200" height="630" fill="url(#gbl)"/>

  <!-- Navy header band — matches site nav -->
  <rect x="0" y="0" width="1200" height="130" fill="#1F3347"/>
  <rect x="0" y="128" width="1200" height="3" fill="#4DA3A8" opacity="0.35"/>

  <!-- Brand name inside navy band — matches nav logo style -->
  <text x="600" y="75" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-style="italic" font-size="56" fill="#E4BDC6">
    Websites by Leslie
  </text>

  <!-- Role line inside band -->
  <text x="600" y="112" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="14" font-weight="500" letter-spacing="4" fill="#4DA3A8">
    WEBSITE DESIGNER &amp; DEVELOPER
  </text>

  <!-- Main headline — big and bold, centered in lower area -->
  <text x="600" y="305" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="74" font-weight="700" fill="#1F3347">
    Affordable websites
  </text>
  <text x="600" y="396" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="74" font-weight="700" fill="#1F3347">
    without the DIY headache.
  </text>

  <!-- Blush accent underline below headline -->
  <rect x="370" y="416" width="460" height="4" rx="2" fill="#E4BDC6" opacity="0.55"/>

  <!-- Sub-tagline -->
  <text x="600" y="492" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="22" fill="#4DA3A8">
    Simple. Affordable. Built for your business.
  </text>

  <!-- Sea glass bar at bottom -->
  <rect x="0" y="620" width="1200" height="10" fill="#1F3347"/>
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
