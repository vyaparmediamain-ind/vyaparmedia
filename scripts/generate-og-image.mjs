import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const cwd = process.cwd();
const logoPath = path.join(cwd, "public", "logo.png");
const logoBase64 = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
  : "";

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradients -->
    <radialGradient id="bgGlow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1E1B4B" stop-opacity="0.85" />
      <stop offset="45%" stop-color="#0F172A" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#07090E" stop-opacity="1" />
    </radialGradient>
    <radialGradient id="emeraldAura" cx="50%" cy="25%" r="35%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#10B981" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="indigoAura" cx="15%" cy="85%" r="40%">
      <stop offset="0%" stop-color="#6366F1" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#6366F1" stop-opacity="0" />
    </radialGradient>

    <!-- Card Background Gradients -->
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" stop-opacity="0.7" />
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0.8" />
    </linearGradient>

    <!-- Pill Gradients -->
    <linearGradient id="pillGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#065F46" stop-opacity="0.35" />
    </linearGradient>
    <linearGradient id="pillGradIndigo" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366F1" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#3730A3" stop-opacity="0.35" />
    </linearGradient>

    <!-- Text Glow -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.6" />
    </filter>

    <clipPath id="logoClip">
      <circle cx="600" cy="115" r="50" />
    </clipPath>
  </defs>

  <!-- 1. Background Fill -->
  <rect width="1200" height="630" fill="#07090E" />
  <rect width="1200" height="630" fill="url(#bgGlow)" />
  <rect width="1200" height="630" fill="url(#emeraldAura)" />
  <rect width="1200" height="630" fill="url(#indigoAura)" />

  <!-- Subtle Decorative Grid Lines -->
  <g stroke="#334155" stroke-opacity="0.15" stroke-width="1">
    <line x1="0" y1="105" x2="1200" y2="105" />
    <line x1="0" y1="210" x2="1200" y2="210" />
    <line x1="0" y1="315" x2="1200" y2="315" />
    <line x1="0" y1="420" x2="1200" y2="420" />
    <line x1="0" y1="525" x2="1200" y2="525" />
    <line x1="200" y1="0" x2="200" y2="630" />
    <line x1="400" y1="0" x2="400" y2="630" />
    <line x1="600" y1="0" x2="600" y2="630" />
    <line x1="800" y1="0" x2="800" y2="630" />
    <line x1="1000" y1="0" x2="1000" y2="630" />
  </g>

  <!-- ── FLANK CARDS (Visible on 1.91:1 widescreen displays) ── -->
  <!-- Left Flank Card: For Creators -->
  <g filter="url(#cardShadow)">
    <rect x="50" y="160" width="220" height="310" rx="20" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.5" />
    <rect x="50" y="160" width="220" height="310" rx="20" fill="none" stroke="#10B981" stroke-width="1" stroke-opacity="0.3" />
    <text x="75" y="200" fill="#10B981" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" letter-spacing="1.5">FOR CREATORS</text>
    <text x="75" y="235" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="800">Zero Risk Payouts</text>
    
    <text x="75" y="280" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600">✓ Upfront Brand Escrow</text>
    <text x="75" y="315" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600">✓ Instant UPI Settlements</text>
    <text x="75" y="350" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600">✓ Automated TDS Invoicing</text>
    <text x="75" y="385" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600">✓ 1% Lifetime Referral Cut</text>
    
    <rect x="75" y="420" width="170" height="28" rx="8" fill="#10B981" fill-opacity="0.15" stroke="#10B981" stroke-width="1" stroke-opacity="0.4" />
    <text x="160" y="439" text-anchor="middle" fill="#34D399" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">100% Payout Guarantee</text>
  </g>

  <!-- Right Flank Card: For Brands -->
  <g filter="url(#cardShadow)">
    <rect x="930" y="160" width="220" height="310" rx="20" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.5" />
    <rect x="930" y="160" width="220" height="310" rx="20" fill="none" stroke="#6366F1" stroke-width="1" stroke-opacity="0.3" />
    <text x="955" y="200" fill="#818CF8" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" letter-spacing="1.5">FOR BRANDS</text>
    <text x="955" y="235" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="800">Verified ROI Deals</text>
    
    <text x="955" y="280" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600">✓ DRS™ Trust-Scored Influencers</text>
    <text x="955" y="315" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600">✓ Live Deliverable Tracking</text>
    <text x="955" y="350" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600">✓ Auto GST Input Credit</text>
    <text x="955" y="385" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600">✓ Non-Delivery Auto Refund</text>

    <rect x="955" y="420" width="170" height="28" rx="8" fill="#6366F1" fill-opacity="0.15" stroke="#6366F1" stroke-width="1" stroke-opacity="0.4" />
    <text x="1040" y="439" text-anchor="middle" fill="#A5B4FC" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700">Fair Price Guaranteed</text>
  </g>

  <!-- ── CENTER SAFE ZONE (630x630 from x=285 to x=915) ── -->
  <!-- WhatsApp 1:1 Square Crop matches this region perfectly -->

  <!-- Top Center Logo Badge -->
  <g filter="url(#glow)">
    <circle cx="600" cy="115" r="54" fill="#0F172A" stroke="#10B981" stroke-width="2.5" />
    <circle cx="600" cy="115" r="50" fill="#1E293B" />
    ${
      logoBase64
        ? `<image href="${logoBase64}" x="550" y="65" width="100" height="100" clip-path="url(#logoClip)" />`
        : `<text x="600" y="130" text-anchor="middle" fill="#10B981" font-family="system-ui, sans-serif" font-size="42" font-weight="900">VM</text>`
    }
  </g>

  <!-- Sub-heading Pill: India's Premier Marketplace -->
  <rect x="420" y="195" width="360" height="32" rx="16" fill="url(#pillGrad)" stroke="#10B981" stroke-width="1.2" />
  <text x="600" y="216" text-anchor="middle" fill="#34D399" font-family="system-ui, -apple-system, sans-serif" font-size="11.5" font-weight="800" letter-spacing="1.8">
    🇮🇳 INDIA'S #1 CREATOR ESCROW MARKETPLACE
  </text>

  <!-- Main Brand Title -->
  <text x="600" y="285" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="900" letter-spacing="-1">
    Vyapar<tspan fill="#10B981">Media</tspan>
  </text>

  <!-- Core Proposition -->
  <text x="600" y="332" text-anchor="middle" fill="#E2E8F0" font-family="system-ui, -apple-system, sans-serif" font-size="25" font-weight="700" letter-spacing="-0.3">
    Smart Escrow Contracts &amp; Verified Deals
  </text>

  <!-- Feature Pills in Center Zone -->
  <g transform="translate(0, 10)">
    <!-- Pill 1: 100% Escrow -->
    <rect x="360" y="365" width="230" height="52" rx="14" fill="url(#cardGrad)" stroke="#10B981" stroke-width="1.5" filter="url(#cardShadow)" />
    <circle cx="390" cy="391" r="14" fill="#10B981" fill-opacity="0.2" />
    <text x="390" y="396" text-anchor="middle" font-size="14">🛡️</text>
    <text x="415" y="386" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="800">100% Upfront Escrow</text>
    <text x="415" y="405" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600">Funds locked before work</text>

    <!-- Pill 2: Instant Payouts -->
    <rect x="610" y="365" width="230" height="52" rx="14" fill="url(#cardGrad)" stroke="#6366F1" stroke-width="1.5" filter="url(#cardShadow)" />
    <circle cx="640" cy="391" r="14" fill="#6366F1" fill-opacity="0.2" />
    <text x="640" y="396" text-anchor="middle" font-size="14">⚡</text>
    <text x="665" y="386" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="800">Instant UPI Payouts</text>
    <text x="665" y="405" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600">Direct to bank on approval</text>
  </g>

  <!-- Trust / Statutory Security Bar -->
  <rect x="370" y="460" width="460" height="40" rx="12" fill="#0F172A" fill-opacity="0.9" stroke="#334155" stroke-width="1" />
  <text x="600" y="485" text-anchor="middle" fill="#CBD5E1" font-family="system-ui, -apple-system, sans-serif" font-size="12.5" font-weight="700">
    🔒 100% Milestone Escrow  •  Section 194-O TDS  •  RBI Compliant
  </text>

  <!-- Referral Invitation Callout Banner -->
  <rect x="330" y="525" width="540" height="55" rx="16" fill="url(#pillGrad)" stroke="#10B981" stroke-width="1.5" />
  <text x="600" y="549" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800">
    Join with Invite Code to Claim Perks &amp; Royalties
  </text>
  <text x="600" y="569" text-anchor="middle" fill="#34D399" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700">
    0% Creator Commission  •  Transparent 7-10% Brand Fees  •  DigiLocker KYC
  </text>

  <!-- Outer Frame Highlight -->
  <rect x="1.5" y="1.5" width="1197" height="627" rx="0" fill="none" stroke="#334155" stroke-opacity="0.4" stroke-width="3" />
  <rect x="0" y="0" width="1200" height="3" fill="url(#pillGrad)" />
</svg>
`;

async function main() {
  const outPath = path.join(cwd, "public", "og-image.png");
  const testSquarePath = path.join(cwd, "public", "og-image-square-test.png");

  console.log("Generating 1200x630 Open Graph Image...");
  const pngBuffer = await sharp(Buffer.from(svg))
    .png({ quality: 95, compressionLevel: 8 })
    .toBuffer();

  fs.writeFileSync(outPath, pngBuffer);
  console.log(`Saved: ${outPath} (${pngBuffer.length} bytes)`);

  // Generate 1:1 square crop from center (x: 285 to 915, y: 0 to 630) to simulate WhatsApp mobile thumbnail
  console.log("Generating 1:1 center crop to verify WhatsApp mobile thumbnail...");
  const squareBuffer = await sharp(pngBuffer)
    .extract({ left: 285, top: 0, width: 630, height: 630 })
    .resize(300, 300)
    .png()
    .toBuffer();

  fs.writeFileSync(testSquarePath, squareBuffer);
  console.log(`Saved WhatsApp square preview simulation: ${testSquarePath} (${squareBuffer.length} bytes)`);
}

main().catch(console.error);
