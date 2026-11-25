const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

async function generateBrandedIcons() {
  console.log('Generating branded PWA icons with Logo, Brand Name & Title...');

  const logoPath = path.join(publicDir, 'logo-vm.png');

  // Android adaptive safe circle is ~330px in a 512x512 canvas (diameter = 66% of width = 338px).
  // Everything important (emblem, brand text, tagline) MUST sit within y=90 to y=420 and x=85 to x=427.
  
  // 1. Emblem resized to 170x170
  const emblemBuffer = await sharp(logoPath)
    .resize(170, 170, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // 2. Full branded SVG layout: Deep Slate (#0B0D12), Emerald ambient glow, emblem, "VyaparMedia", "TRUSTED CREATOR COMMERCE"
  const svgCanvas = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ambientGlow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#10B981" stop-opacity="0.28"/>
          <stop offset="50%" stop-color="#059669" stop-opacity="0.10"/>
          <stop offset="100%" stop-color="#0B0D12" stop-opacity="0"/>
        </radialGradient>
        <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.8"/>
        </filter>
      </defs>

      <!-- Background: Platform dark theme canvas #0B0D12 -->
      <rect width="512" height="512" rx="0" fill="#0B0D12"/>

      <!-- Ambient radial glow behind emblem -->
      <rect width="512" height="512" fill="url(#ambientGlow)"/>

      <!-- Brand Name: VyaparMedia (centered at x=256, y=318) -->
      <text x="256" y="318" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="38" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="-0.5" filter="url(#textShadow)">
        Vyapar<tspan fill="#10B981">Media</tspan>
      </text>

      <!-- Title / Tagline: TRUSTED CREATOR COMMERCE (centered at x=256, y=350) -->
      <text x="256" y="350" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="800" fill="#34D399" text-anchor="middle" letter-spacing="2.2" filter="url(#textShadow)">
        TRUSTED CREATOR COMMERCE
      </text>

      <!-- Subtitle badge: Bharat's #1 Creator Escrow Platform (centered at x=256, y=382) -->
      <g filter="url(#textShadow)">
        <rect x="136" y="367" width="240" height="22" rx="11" fill="#064E3B" fill-opacity="0.75" stroke="#10B981" stroke-width="1" stroke-opacity="0.5"/>
        <circle cx="152" cy="378" r="3" fill="#10B981"/>
        <text x="260" y="382" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="10" font-weight="700" fill="#ECFDF5" text-anchor="middle" letter-spacing="0.4">
          Bharat&apos;s #1 Creator Escrow
        </text>
      </g>
    </svg>
  `);

  // Composite 512x512 icon (emblem at top: 95, left: 171)
  const icon512Solid = await sharp(svgCanvas)
    .composite([
      { input: emblemBuffer, top: 100, left: 171 }
    ])
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512Solid);
  fs.writeFileSync(path.join(publicDir, 'icon-512-maskable.png'), icon512Solid);
  console.log('✓ Created public/icon-512.png and public/icon-512-maskable.png');

  // 3. Generate 192x192 icon
  const icon192Solid = await sharp(icon512Solid)
    .resize(192, 192, { fit: 'contain' })
    .png({ quality: 100 })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192Solid);
  console.log('✓ Created public/icon-192.png');

  // 4. Generate 180x180 Apple Touch Icon
  const appleTouch = await sharp(icon512Solid)
    .resize(180, 180, { fit: 'contain' })
    .png({ quality: 100 })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);
  console.log('✓ Created public/apple-touch-icon.png');

  // Also sync with src/app/apple-icon.png and src/app/icon.png
  const srcAppDir = path.join(__dirname, '..', 'src', 'app');
  if (fs.existsSync(srcAppDir)) {
    fs.writeFileSync(path.join(srcAppDir, 'apple-icon.png'), appleTouch);
    const favicon48 = await sharp(icon512Solid).resize(48, 48).png().toBuffer();
    fs.writeFileSync(path.join(srcAppDir, 'icon.png'), favicon48);
    console.log('✓ Synced src/app/apple-icon.png and src/app/icon.png');
  }

  console.log('All branded icons successfully generated!');
}

generateBrandedIcons().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
