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

    <radialGradient id="gtr" cx="1050" cy="80" r="500" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#4DA3A8" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#4DA3A8" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="gbl" cx="150" cy="550" r="450" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#E4BDC6" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#E4BDC6" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#gtr)"/>
  <rect width="1200" height="630" fill="url(#gbl)"/>

  <!-- Blush accent bar at top -->
  <rect x="0" y="0" width="1200" height="5" fill="#E4BDC6"/>

  <!-- Name -->
  <text x="600" y="100" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-style="italic" font-size="42" fill="#1F3347">
    Leslie Benefield
  </text>

  <!-- Role line -->
  <text x="600" y="140" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="18" font-weight="500" letter-spacing="3" fill="#4DA3A8">
    WEBSITE DESIGNER &amp; DEVELOPER
  </text>

  <!-- Divider -->
  <rect x="490" y="165" width="220" height="2" rx="1" fill="#E4BDC6" opacity="0.50"/>

  <!-- Brand name — large -->
  <text x="600" y="265" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-style="italic" font-size="72" fill="#E4BDC6">
    Websites by Leslie
  </text>

  <!-- Tagline — two lines, big and bold -->
  <text x="600" y="395" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="62" font-weight="700" fill="#1F3347">
    Affordable websites
  </text>
  <text x="600" y="478" text-anchor="middle"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="62" font-weight="700" fill="#1F3347">
    without the DIY headache.
  </text>

  <!-- Sea glass bar at bottom -->
  <rect x="0" y="625" width="1200" height="5" fill="#4DA3A8"/>
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
