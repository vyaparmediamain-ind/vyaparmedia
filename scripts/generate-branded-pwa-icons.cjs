const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

async function generateBrandedIcons() {
  console.log('Generating branded PWA icons with Logo, Brand Name & Title...');

  // Load logo-vm emblem
  const logoPath = path.join(publicDir, 'logo-vm.png');

  // 1. Generate 512x512 Branded Icon (Transparent background for standard PWA icon)
  const emblem512 = await sharp(logoPath)
    .resize(250, 250, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const svgText512 = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>
      <!-- Brand Name -->
      <text x="256" y="375" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="-0.5" filter="url(#glow)">
        Vyapar<tspan fill="#10B981">Media</tspan>
      </text>
      <!-- Subtitle Tagline -->
      <text x="256" y="420" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="800" fill="#10B981" text-anchor="middle" letter-spacing="2.5" filter="url(#glow)">
        TRUSTED CREATOR COMMERCE
      </text>
    </svg>
  `);

  const icon512Buffer = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([
    { input: emblem512, top: 60, left: 131 },
    { input: svgText512, top: 0, left: 0 }
  ])
  .png()
  .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512Buffer);
  console.log('✓ Created public/icon-512.png');

  // 2. Generate 192x192 Branded Icon
  const icon192Buffer = await sharp(icon512Buffer)
    .resize(192, 192, { fit: 'contain' })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192Buffer);
  console.log('✓ Created public/icon-192.png');

  // 3. Generate 180x180 Apple Touch Icon
  const appleTouchBuffer = await sharp(icon512Buffer)
    .resize(180, 180, { fit: 'contain' })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouchBuffer);
  console.log('✓ Created public/apple-touch-icon.png');

  // 4. Generate 512x512 Maskable Icon (Full-bleed solid dark background for Android adaptive icon)
  const emblemMaskable = await sharp(logoPath)
    .resize(220, 220, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const svgTextMaskable = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#070a13"/>
      <!-- Soft ambient emerald background glow -->
      <circle cx="256" cy="200" r="160" fill="#10B981" opacity="0.12"/>
      <!-- Brand Name -->
      <text x="256" y="365" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="-0.5">
        Vyapar<tspan fill="#10B981">Media</tspan>
      </text>
      <!-- Subtitle Tagline -->
      <text x="256" y="408" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800" fill="#10B981" text-anchor="middle" letter-spacing="2.5">
        TRUSTED CREATOR COMMERCE
      </text>
      <!-- Micro trust pill -->
      <rect x="146" y="428" width="220" height="26" rx="13" fill="#10B981" opacity="0.15"/>
      <rect x="146" y="428" width="220" height="26" rx="13" fill="none" stroke="#10B981" stroke-width="1" stroke-opacity="0.3"/>
      <text x="256" y="445" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">
        Bharat's #1 Creator Escrow
      </text>
    </svg>
  `);

  const iconMaskableBuffer = await sharp(svgTextMaskable)
    .composite([
      { input: emblemMaskable, top: 70, left: 146 }
    ])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'icon-512-maskable.png'), iconMaskableBuffer);
  console.log('✓ Created public/icon-512-maskable.png');

  console.log('All branded icons successfully generated!');
}

generateBrandedIcons().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
