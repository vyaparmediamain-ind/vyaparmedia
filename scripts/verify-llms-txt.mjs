import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const llmsPath = path.join(cwd, "public", "llms.txt");
const llmsFullPath = path.join(cwd, "public", "llms-full.txt");

console.log("🔍 Verifying LLM discovery specs (public/llms*.txt)...");

if (!fs.existsSync(llmsPath)) {
  console.error("❌ Missing public/llms.txt");
  process.exit(1);
}

if (!fs.existsSync(llmsFullPath)) {
  console.error("❌ Missing public/llms-full.txt");
  process.exit(1);
}

const llmsContent = fs.readFileSync(llmsPath, "utf-8");
const llmsFullContent = fs.readFileSync(llmsFullPath, "utf-8");

const CANONICAL_DOMAIN = "https://vyaparmedia.vercel.app";

const extractUrls = (content) => {
  const matches = content.match(/https?:\/\/[^\s)\],]+/g) || [];
  return [...new Set(matches)];
};

const llmsUrls = extractUrls(llmsContent);
const llmsFullUrls = extractUrls(llmsFullContent);

for (const url of [...llmsUrls, ...llmsFullUrls]) {
  if (url.includes("vyaparmedia.vercel.app") && !url.startsWith(CANONICAL_DOMAIN)) {
    console.error(`❌ Non-canonical or malformed domain in LLM spec: ${url}`);
    process.exit(1);
  }
}

// Mandatory sections required in llms.txt
const requiredSections = [
  "India's premier influencer marketing",
  "Automated Escrow",
  "Statutory Indian Tax Compliance",
  "Section 194-O",
  "Key Public Pages",
];

for (const section of requiredSections) {
  if (!llmsContent.includes(section)) {
    console.error(`❌ Drift detected in public/llms.txt: missing required section "${section}"`);
    process.exit(1);
  }
}

console.log(`✅ LLM specs verified!`);
console.log(`   - public/llms.txt (${llmsContent.length} bytes, ${llmsUrls.length} verified URLs)`);
console.log(`   - public/llms-full.txt (${llmsFullContent.length} bytes, ${llmsFullUrls.length} verified URLs)`);
