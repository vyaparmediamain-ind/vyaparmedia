import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (full.endsWith(".test.ts")) files.push(full);
  }
  return files;
}

const testFiles = walk("./tests");
console.log("Total test files:", testFiles.length);

const results = {
  hasOnly: [],
  hasSkip: [],
  hasReadSource: [],
  cannotFail: [],
};

for (const file of testFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (/\b(describe|it|test)\.only\b/.test(content)) results.hasOnly.push(file);
  if (/\b(describe|it|test)\.skip\b/.test(content)) results.hasSkip.push(file);
  if (/readFileSync\s*\(/.test(content)) {
    results.hasReadSource.push(file);
  }
}

console.log("Tests with .only:", results.hasOnly);
console.log("Tests with .skip:", results.hasSkip);
console.log("Tests reading implementation source directly (grep string assertions):", results.hasReadSource);
