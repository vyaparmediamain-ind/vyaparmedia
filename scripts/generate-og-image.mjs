import sharp from "sharp";
import fs from "fs";
import path from "path";

const width = 1200;
const height = 630;

// SVG template with dark luxury theme matching VyaparMedia (#070a13), indigo/purple gradient, badge, and copy
const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070a13" />
      <stop offset="50%" stop-color="#0b1120" />
      <stop offset="100%" stop-color="#050811" />
    </linearGradient>
    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <radialGradient id="glowLeft" cx="20%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowRight" cx="80%" cy="70%" r="50%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Background Base -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
  <rect width="${width}" height="${height}" fill="url(#glowLeft)" />
  <rect width="${width}" height="${height}" fill="url(#glowRight)" />

  <!-- Subtle Grid lines / Tech feel -->
  <line x1="80" y1="0" x2="80" y2="${height}" stroke="rgba(255,255,255,0.03)" stroke-width="1" />
  <line x1="1120" y1="0" x2="1120" y2="${height}" stroke="rgba(255,255,255,0.03)" stroke-width="1" />
  <line x1="0" y1="530" x2="${width}" y2="530" stroke="rgba(255,255,255,0.04)" stroke-width="1" />

  <!-- Card Container / Inner Frame -->
  <rect x="80" y="60" width="1040" height="470" rx="24" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />

  <!-- Kicker Pill Badge -->
  <g transform="translate(130, 110)">
    <rect width="360" height="38" rx="19" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.35)" stroke-width="1" />
    <circle cx="20" cy="19" r="5" fill="#10b981" />
    <text x="35" y="24" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#a5b4fc" letter-spacing="0.5">
      INDIA'S PREMIER ESCROW MARKETPLACE
    </text>
  </g>

  <!-- Main Headline -->
  <text x="130" y="215" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="900" fill="#ffffff" letter-spacing="-1">
    Where Brands &amp; Creators Build
  </text>
  <text x="130" y="278" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="900" fill="url(#primaryGrad)" letter-spacing="-1">
    Trusted Business.
  </text>

  <!-- Subtitle Description -->
  <text x="130" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="400" fill="#94a3b8">
    100% Upfront Escrow Protection • Verified DRS™ Trust Score • Automated TDS Section 194-O
  </text>
  <text x="130" y="372" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="400" fill="#94a3b8">
    Legally Binding Smart Contracts • Instant Verified Deliverables &amp; Zero Payment Defaults
  </text>

  <!-- Feature Highlights / Badges at bottom -->
  <g transform="translate(130, 420)">
    <!-- Feature 1 -->
    <rect x="0" y="0" width="230" height="52" rx="12" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
    <text x="20" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#e2e8f0">
      🔒 100% Escrow Safe
    </text>

    <!-- Feature 2 -->
    <rect x="250" y="0" width="240" height="52" rx="12" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
    <text x="270" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#e2e8f0">
      ⚡ 0% Creator Deductions
    </text>

    <!-- Feature 3 -->
    <rect x="510" y="0" width="240" height="52" rx="12" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
    <text x="530" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#e2e8f0">
      📋 GST &amp; TDS Compliant
    </text>
  </g>

  <!-- Bottom Brand Footer -->
  <text x="130" y="575" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#cbd5e1" letter-spacing="1">
    VYAPARMEDIA.IN
  </text>
  <text x="1070" y="575" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="#64748b" text-anchor="end">
    Guaranteed Escrow Infrastructure for Indian Creators &amp; Brands
  </text>
</svg>
`;

async function generate() {
  const outputPath = path.resolve("public", "og-image.png");
  await sharp(Buffer.from(svg))
    .png({ quality: 95 })
    .toFile(outputPath);
  console.log(`Generated OG Image at ${outputPath} (${width}x${height})`);
}

generate().catch(console.error);
