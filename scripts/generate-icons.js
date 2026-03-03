import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '..', 'client', 'public', 'icons');

// Create a simple book icon SVG
const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>
  <g transform="translate(256,256)">
    <!-- Open book shape -->
    <path d="M-10,-60 C-10,-60 -100,-80 -120,-40 L-120,60 C-100,20 -10,40 -10,40 Z" fill="rgba(255,255,255,0.95)"/>
    <path d="M10,-60 C10,-60 100,-80 120,-40 L120,60 C100,20 10,40 10,40 Z" fill="rgba(255,255,255,0.85)"/>
    <!-- Spine -->
    <line x1="0" y1="-65" x2="0" y2="45" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
    <!-- Camera lens hint -->
    <circle cx="0" cy="85" r="18" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="3"/>
    <circle cx="0" cy="85" r="8" fill="rgba(255,255,255,0.7)"/>
  </g>
</svg>`;

async function generate() {
  const svgBuffer = Buffer.from(svgIcon);

  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192.png'));
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512.png'));
  console.log('Icons generated!');
}

generate().catch(console.error);
