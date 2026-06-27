import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Resize beach to exact OG dimensions and embed as data URL
const beachPath = join(__dirname, '..', 'src', 'assets', 'backgrounds', 'beach-background.jpeg');
const beachJpg = await sharp(beachPath)
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 92 })
  .toBuffer();
const beachDataUrl = `data:image/jpeg;base64,${beachJpg.toString('base64')}`;

// Design: logo floats directly over the beach, no solid backing.
// Contrast comes only from:
//   1. A soft radial ivory gradient centered on the logo (barely perceptible)
//   2. A subtle navy text-shadow on the script lettering
// Both are invisible as design elements — they simply lift the text off the photo.
//
// Logo position: slightly above vertical center to give tagline room below.
// Fonts loaded via Google Fonts in the browser — same request as the live website.

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sacramento&family=Lora:ital@1&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 1200px;
  height: 630px;
  overflow: hidden;
  position: relative;
}

/* Beach photo */
.beach {
  position: absolute;
  inset: 0;
  background-image: url('${beachDataUrl}');
  background-size: cover;
  background-position: center;
}

/* Soft ivory wash — 45% so the beach stays vivid */
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(253, 252, 250, 0.45);
}

/* Edge vignette */
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 50%, rgba(31,51,71,0.10) 100%);
}

/* Invisible local contrast aid: a very faint ivory radial glow exactly
   where the logo sits. It's not perceptible as a shape — just makes the
   light blush text legible without any solid backing element. */
.logo-glow {
  position: absolute;
  left: 50%;
  top: 132px;
  transform: translateX(-50%);
  width: 1000px;
  height: 260px;
  background: radial-gradient(ellipse 65% 100% at 50% 50%,
    rgba(253,252,250,0.40) 0%,
    transparent 100%);
  pointer-events: none;
}

/* Content block — nudged up slightly to stay balanced with larger text */
.content {
  position: absolute;
  left: 0;
  right: 0;
  top: 168px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Logo — Sacramento script, exact .nav-logo color from the website */
.logo {
  font-family: 'Sacramento', cursive;
  font-size: 128px;
  color: #E4BDC6;
  line-height: 1;
  white-space: nowrap;
  /* 1px stroke in low-opacity dark navy — paint-order puts the stroke
     behind the fill so it reads as a soft edge, not a hard outline.
     Think calligraphy on textured paper: crisp separation, not a border. */
  -webkit-text-stroke: 2px rgba(20, 40, 60, 0.65);
  paint-order: stroke fill;
  text-shadow: 0 2px 4px rgba(20, 40, 60, 0.25);
}

/* Blush divider — matches --color-pop */
.divider {
  width: 180px;
  height: 2px;
  background: #E4BDC6;
  opacity: 0.75;
  margin-top: 22px;
}

/* Tagline — Lora italic, --color-text-muted, 30px for thumbnail legibility */
.tagline {
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  font-size: 50px;
  color: #5D7385;
  margin-top: 26px;
  text-align: center;
}
</style>
</head>
<body>
  <div class="beach"></div>
  <div class="overlay"></div>
  <div class="vignette"></div>
  <div class="logo-glow"></div>
  <div class="content">
    <span class="logo">Websites by Leslie</span>
    <div class="divider"></div>
    <div class="tagline">Helping small businesses look their best online.</div>
  </div>
</body>
</html>`;

const tmpHtml = join(tmpdir(), `og-${randomBytes(6).toString('hex')}.html`);
writeFileSync(tmpHtml, html);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);

  const { fontFamily, fontLoaded } = await page.evaluate(() => {
    const el = document.querySelector('.logo');
    return {
      fontFamily: getComputedStyle(el).fontFamily,
      fontLoaded: [...document.fonts].some(f => f.family === 'Sacramento' && f.status === 'loaded'),
    };
  });
  console.log('font-family:', fontFamily);
  console.log('Sacramento loaded:', fontLoaded);

  const png = await page.screenshot({ type: 'png' });
  const jpg = await sharp(png)
    .jpeg({ quality: 93, progressive: true, mozjpeg: true })
    .toBuffer();

  const out = join(__dirname, '..', 'public', 'social-preview-v12.jpg');
  writeFileSync(out, jpg);
  console.log(`Saved: public/social-preview-v12.jpg  (${(jpg.length / 1024).toFixed(1)} KB)`);
} finally {
  await browser.close();
  unlinkSync(tmpHtml);
}
