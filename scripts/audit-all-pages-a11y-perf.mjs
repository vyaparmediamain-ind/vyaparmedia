import fs from "node:fs";
import path from "node:path";

const APP_DIR = path.resolve("src/app");

const pages = [];
function findPages(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findPages(full);
    } else if (entry.name === "page.tsx" || entry.name === "not-found.tsx") {
      pages.push(full);
    }
  }
}
findPages(APP_DIR);

console.log(`Found ${pages.length} pages to audit.`);

const auditResults = [];

for (const pagePath of pages) {
  const content = fs.readFileSync(pagePath, "utf-8");
  const relPath = path.relative(process.cwd(), pagePath);

  const issues = {
    a11y: [],
    performance: [],
    usability: [],
    strengths: []
  };

  // 1. Accessibility Checks
  // Check for raw <img> without alt
  const imgMatches = content.match(/<img\s+[^>]*>/g) || [];
  for (const img of imgMatches) {
    if (!img.includes("alt=")) {
      issues.a11y.push("Found <img> tag missing alt attribute");
    }
  }
  // Check for Next Image without alt
  const nextImgMatches = content.match(/<Image\s+[^>]*>/g) || [];
  for (const img of nextImgMatches) {
    if (!img.includes("alt=")) {
      issues.a11y.push("Found <Image> tag missing alt attribute");
    }
  }

  // Check buttons missing aria-label when they might be icon-only
  // Match buttons that don't have text between tags and don't have aria-label
  const buttonTags = content.match(/<button[\s\S]*?<\/button>/g) || [];
  for (const btn of buttonTags) {
    // If button has Lucide icon or SVG and no text and no aria-label
    if ((btn.includes("<Lucide") || btn.includes("<Icon") || btn.includes("lucide-react") || /<[A-Z][a-zA-Z]+Icon/.test(btn) || /<(Plus|Trash|Edit|Close|Search|Menu|X|Chevron|Arrow|Eye|Check|Copy|Share|Filter|Download|Upload|Bell|Settings)\b/.test(btn)) && !btn.includes("aria-label") && !btn.includes("aria-labelledby")) {
      // check if it has text inside
      const textInside = btn.replace(/<[^>]+>/g, "").trim();
      if (!textInside) {
        issues.a11y.push("Icon-only button might be missing aria-label");
      }
    }
  }

  // Check form inputs missing label or aria-label
  const inputTags = content.match(/<input\s+[^>]*>/g) || [];
  for (const inp of inputTags) {
    if (!inp.includes("aria-label") && !inp.includes("id=") && !inp.includes("aria-labelledby") && !inp.includes('type="hidden"') && !inp.includes('type="file"')) {
      issues.a11y.push("Input field missing aria-label or id (for associated label)");
    }
  }

  // Check aria-expanded or dialog controls
  if (content.includes("aria-expanded") || content.includes("aria-label") || content.includes("role=")) {
    issues.strengths.push("ARIA attributes (aria-label/role/expanded) implemented");
  }

  // 2. Performance Checks
  if (imgMatches.length > 0) {
    issues.performance.push(`Uses raw <img> instead of next/image (${imgMatches.length} occurrences)`);
  }
  if (content.includes("next/image") || content.includes("<Image")) {
    issues.strengths.push("Uses optimized next/image component");
  }
  if (content.includes("dynamic(") || content.includes("React.lazy")) {
    issues.strengths.push("Code splitting / dynamic imports detected");
  }
  if (content.includes("Skeleton") || content.includes("animate-pulse")) {
    issues.strengths.push("Loading skeleton implemented to prevent CLS");
  }

  // 3. Usability Checks
  if (content.includes("min-h-") || content.includes("h-11") || content.includes("p-3") || content.includes("py-2.5") || content.includes("h-10")) {
    issues.strengths.push("Touch target guidelines respected (>=40-44px)");
  }
  if (content.includes("disabled=") || content.includes("disabled={")) {
    issues.strengths.push("Disabled state handling implemented for actions/buttons");
  }
  if (content.includes("toast.") || content.includes("alert(") || content.includes("statusMessage") || content.includes("error")) {
    issues.strengths.push("User feedback (error/status/toasts) handled");
  }
  if (content.includes("grid-cols-") && !content.includes("md:") && !content.includes("sm:") && !content.includes("lg:")) {
    issues.usability.push("Grid without responsive breakpoints detected");
  }

  auditResults.push({
    file: relPath,
    issues
  });
}

console.log("\n--- AUDIT SUMMARY ---");
let totalA11yIssues = 0;
let totalPerfIssues = 0;
let totalUsabilityIssues = 0;

for (const r of auditResults) {
  if (r.issues.a11y.length > 0 || r.issues.performance.length > 0 || r.issues.usability.length > 0) {
    console.log(`\nPage: ${r.file}`);
    if (r.issues.a11y.length) {
      console.log("  [A11y]:", [...new Set(r.issues.a11y)].join("; "));
      totalA11yIssues += r.issues.a11y.length;
    }
    if (r.issues.performance.length) {
      console.log("  [Perf]:", [...new Set(r.issues.performance)].join("; "));
      totalPerfIssues += r.issues.performance.length;
    }
    if (r.issues.usability.length) {
      console.log("  [Usability]:", [...new Set(r.issues.usability)].join("; "));
      totalUsabilityIssues += r.issues.usability.length;
    }
  }
}

console.log("\n==================================");
console.log(`Total Pages Scanned: ${auditResults.length}`);
console.log(`Total A11y Flags: ${totalA11yIssues}`);
console.log(`Total Perf Flags: ${totalPerfIssues}`);
console.log(`Total Usability Flags: ${totalUsabilityIssues}`);
