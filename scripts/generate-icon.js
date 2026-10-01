const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#4338ca" />
    </linearGradient>
    <linearGradient id="nGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e0e7ff" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#c084fc" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000000" flood-opacity="0.5" />
    </filter>
  </defs>
  
  <!-- Outer Rounded Squircle -->
  <rect x="32" y="32" width="448" height="448" rx="100" fill="url(#bgGrad)" filter="url(#shadow)" stroke="#6366f1" stroke-width="6" stroke-opacity="0.5" />
  
  <!-- Stylized Geometric N / Document Prism -->
  <g transform="translate(136, 124)">
    <!-- Left Column -->
    <rect x="0" y="0" width="56" height="264" rx="14" fill="url(#nGrad)" />
    <!-- Right Column -->
    <rect x="184" y="0" width="56" height="264" rx="14" fill="url(#nGrad)" />
    <!-- Diagonal Bridge -->
    <polygon points="36,0 204,220 204,264 36,44" fill="url(#nGrad)" />
    
    <!-- Accent Dots -->
    <circle cx="212" cy="28" r="12" fill="url(#glowGrad)" />
    <circle cx="28" cy="236" r="12" fill="url(#glowGrad)" />
  </g>
</svg>`;

// Helper function to build a Windows .ico file from an array of PNG buffers
function createIcoFromPngs(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4); // number of images

  let currentOffset = headerSize + entrySize * count;
  const entries = [];

  for (const item of pngBuffers) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(item.width >= 256 ? 0 : item.width, 0);
    entry.writeUInt8(item.height >= 256 ? 0 : item.height, 1);
    entry.writeUInt8(0, 2); // color palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8); // size of image data
    entry.writeUInt32LE(currentOffset, 12); // offset of image data
    entries.push(entry);
    currentOffset += item.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buffer)]);
}

async function generate() {
  const publicDir = path.join(__dirname, '..', 'public');
  const electronDir = path.join(__dirname, '..', 'electron');
  const buildDir = path.join(__dirname, '..', 'build');

  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  if (!fs.existsSync(electronDir)) fs.mkdirSync(electronDir, { recursive: true });
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

  const svgBuffer = Buffer.from(svg);

  // Write SVGs
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svg);
  fs.writeFileSync(path.join(electronDir, 'icon.svg'), svg);

  // Generate 512x512 Master PNG
  const png512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'icon.png'), png512);
  fs.writeFileSync(path.join(electronDir, 'icon.png'), png512);
  fs.writeFileSync(path.join(buildDir, 'icon.png'), png512);

  // Generate multi-resolution PNGs for ICO
  const sizes = [256, 128, 64, 48, 32, 16];
  const pngList = [];

  for (const size of sizes) {
    const buf = await sharp(svgBuffer).resize(size, size).png().toBuffer();
    pngList.push({ width: size, height: size, buffer: buf });
  }

  const icoBuffer = createIcoFromPngs(pngList);
  fs.writeFileSync(path.join(publicDir, 'icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(electronDir, 'icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);

  console.log('✅ App icons successfully generated:');
  console.log(' - public/icon.png & public/icon.ico');
  console.log(' - electron/icon.png & electron/icon.ico');
  console.log(' - build/icon.png & build/icon.ico');
}

generate().catch(console.error);
