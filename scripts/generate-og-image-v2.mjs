import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load Sacramento font (download once, cache locally) ────────────────
const fontPath = join(__dirname, 'Sacramento-Regular.ttf');
if (!existsSync(fontPath)) {
  console.log('Downloading Sacramento font…');
  // Request TTF format via legacy UA
  const cssRes = await fetch(
    'https://fonts.googleapis.com/css?family=Sacramento',
    { headers: { 'User-Agent': 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)' } }
  );
  const css = await cssRes.text();
  const match = css.match(/url\(([^)]+)\)/);
  if (!match) throw new Error('Could not parse Sacramento font URL from Google Fonts CSS');
  const fontUrl = match[1].replace(/'/g, '');
  const fontRes = await fetch(fontUrl);
  writeFileSync(fontPath, Buffer.from(await fontRes.arrayBuffer()));
  console.log('Sacramento font saved to scripts/Sacramento-Regular.ttf');
}

// ── SVG overlay ────────────────────────────────────────────────────────
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <!-- Warm ivory base overlay — lets beach show through -->
    <!-- Subtle center glow for text readability -->
    <radialGradient id="centerGlow" cx="50%" cy="44%" r="52%">
      <stop offset="0%"   stop-color="#FDFCFA" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#FDFCFA" stop-opacity="0"/>
    </radialGradient>
    <!-- Edge darkening to frame the image naturally -->
    <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
      <stop offset="0%"   stop-color="transparent"/>
      <stop offset="100%" stop-color="#1F3347" stop-opacity="0.08"/>
    </radialGradient>
  </defs>

  <!-- Base overlay — 62% ivory, beach shows through while ensuring readability -->
  <rect width="1200" height="630" fill="#FDFCFA" opacity="0.62"/>

  <!-- Subtle center readability glow -->
  <rect width="1200" height="630" fill="url(#centerGlow)"/>

  <!-- Soft edge vignette -->
  <rect width="1200" height="630" fill="url(#vignette)"/>

  <!-- "Websites by" — smaller attribution in navy -->
  <text x="600" y="228" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="22" font-weight="normal" letter-spacing="6"
    fill="#1F3347" opacity="0.80">
    WEBSITES BY
  </text>

  <!-- "Leslie" — Sacramento script, richer blush for contrast on light beach -->
  <text x="600" y="336" text-anchor="middle"
    font-family="Sacramento, cursive"
    font-size="110" fill="#B87A90">
    Leslie
  </text>

  <!-- Blush accent divider -->
  <rect x="490" y="358" width="220" height="2.5" rx="1.25" fill="#B87A90" opacity="0.60"/>

  <!-- Supporting copy — warm, personal, unhurried -->
  <text x="600" y="412" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="24" fill="#1F3347" opacity="0.78">
    Websites built with care for real small businesses.
  </text>

</svg>
`;

// ── Render SVG overlay ─────────────────────────────────────────────────
const resvg = new Resvg(svg.trim(), {
  fitTo: { mode: 'width', value: 1200 },
  font: {
    loadSystemFonts: true,
    fontFiles: [fontPath],
  },
  background: 'transparent',
});
const svgPng = resvg.render().asPng();

// ── Composite beach + overlay → JPEG ──────────────────────────────────
const beachPath = join(__dirname, '..', 'src', 'assets', 'backgrounds', 'beach-background.jpeg');
const beachBuffer = await sharp(beachPath)
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .toBuffer();

const jpgBuffer = await sharp(beachBuffer)
  .composite([{ input: svgPng, blend: 'over' }])
  .jpeg({ quality: 93, progressive: true, mozjpeg: true })
  .toBuffer();

const outputPath = join(__dirname, '..', 'public', 'social-preview-v2.jpg');
writeFileSync(outputPath, jpgBuffer);

console.log(`✓  Saved: public/social-preview-v2.jpg`);
console.log(`   Size:  ${(jpgBuffer.length / 1024).toFixed(1)} KB`);
