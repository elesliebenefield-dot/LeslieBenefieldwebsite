import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL    = 'http://localhost:5173';
const OUT    = join(__dirname, '..', 'public', 'social-preview.jpg');

console.log('Launching Chrome…');
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

console.log(`Navigating to ${URL}…`);
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });

// Let fonts settle
await new Promise(r => setTimeout(r, 1200));

// OG-only layout: center the logo, hide nav links and contact btn,
// remove photo, collapse hero to single-column centered text
await page.addStyleTag({ content: `
  .nav-links, .nav-contact-btn { display: none !important; }
  .nav-inner    { justify-content: center !important; }
  .hero-photo   { display: none !important; }
  .hero-inner   {
    grid-template-columns: 1fr !important;
    text-align: center !important;
    max-width: 860px !important;
  }
  .hero-copy    { margin-left: auto !important; margin-right: auto !important; }
  .hero         { padding-top: 3.5rem !important; padding-bottom: 22rem !important; }
` });

// Brief settle after style injection
await new Promise(r => setTimeout(r, 400));

// Measure nav + hero exactly so we clip to just those two elements
const clipHeight = await page.evaluate(() => {
  const nav  = document.querySelector('.nav');
  const hero = document.querySelector('.hero');
  return nav.offsetHeight + hero.offsetHeight;
});

console.log(`Taking screenshot (nav + hero = ${clipHeight}px)…`);
const raw = await page.screenshot({
  type: 'png',
  clip: { x: 0, y: 0, width: 1440, height: clipHeight },
});

await browser.close();

// Scale the clipped nav+hero strip to 1200×630
const jpg = await sharp(raw)
  .resize(1200, 630, { fit: 'cover', position: 'top' })
  .jpeg({ quality: 93, progressive: true, mozjpeg: true })
  .toBuffer();

writeFileSync(OUT, jpg);

console.log(`✓  Saved: public/social-preview.jpg`);
console.log(`   Size:  ${(jpg.length / 1024).toFixed(1)} KB`);
console.log(`   Dims:  1200 × 630 px`);
