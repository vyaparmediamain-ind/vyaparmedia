import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        results = results.concat(walk(fullPath));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(path.join(process.cwd(), 'src'));
console.log(`Scanning ${files.length} JSX/TSX files for Dead UI issues...`);

const findings = {
  buttonWithoutAction: [],
  noopOnClick: [],
  hashHref: [],
  disabledForever: [],
  commentedJsx: [],
};

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    // 1. noop onClick
    if (/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(line) || /onClick\s*=\s*\{\s*\(\s*_\s*\)\s*=>\s*\{\s*\}\s*\}/.test(line)) {
      findings.noopOnClick.push({ file: path.relative(process.cwd(), f), line: lineNum, text: line.trim() });
    }
    // 2. href="#"
    if (/href\s*=\s*["']#["']/.test(line)) {
      findings.hashHref.push({ file: path.relative(process.cwd(), f), line: lineNum, text: line.trim() });
    }
    // 3. disabled={true} without condition
    if (/disabled\s*=\s*\{\s*true\s*\}/.test(line) && !/loading|submitting|isPending|disabled\s*=\s*\{true\s*\/\*/i.test(line)) {
      findings.disabledForever.push({ file: path.relative(process.cwd(), f), line: lineNum, text: line.trim() });
    }
    // 4. commented-out JSX
    if (/\{\s*\/\*\s*<[A-Za-z]/.test(line)) {
      findings.commentedJsx.push({ file: path.relative(process.cwd(), f), line: lineNum, text: line.trim() });
    }
  });

  // Check buttons without onClick / type="submit" / form
  // Match <button ...> tags
  const buttonRegex = /<button\b([^>]*?)>/gs;
  let match;
  while ((match = buttonRegex.exec(content)) !== null) {
    const attrs = match[1];
    const hasOnClick = /\bonClick\b/.test(attrs);
    const isSubmit = /\btype\s*=\s*["']submit["']/.test(attrs);
    const hasForm = /\bform\s*=/.test(attrs);
    const isModalTrigger = /data-dialog|data-slot|data-state/.test(attrs);
    const spreadsProps = /\{\.\.\./.test(attrs);

    if (!hasOnClick && !isSubmit && !hasForm && !isModalTrigger && !spreadsProps) {
      // Find line number
      const preText = content.substring(0, match.index);
      const lineNum = preText.split('\n').length;
      findings.buttonWithoutAction.push({
        file: path.relative(process.cwd(), f),
        line: lineNum,
        tag: match[0].replace(/\s+/g, ' ').slice(0, 100),
      });
    }
  }
}

console.log(`\n--- Summary of Dead UI Audit ---`);
console.log(`Noop onClick: ${findings.noopOnClick.length}`);
findings.noopOnClick.forEach(i => console.log(`  ${i.file}:${i.line} -> ${i.text}`));

console.log(`\nhref="#": ${findings.hashHref.length}`);
findings.hashHref.forEach(i => console.log(`  ${i.file}:${i.line} -> ${i.text}`));

console.log(`\nDisabled forever: ${findings.disabledForever.length}`);
findings.disabledForever.forEach(i => console.log(`  ${i.file}:${i.line} -> ${i.text}`));

console.log(`\nCommented JSX: ${findings.commentedJsx.length}`);
findings.commentedJsx.forEach(i => console.log(`  ${i.file}:${i.line} -> ${i.text}`));

console.log(`\nButtons without Action / Submit / Form: ${findings.buttonWithoutAction.length}`);
findings.buttonWithoutAction.forEach(i => console.log(`  ${i.file}:${i.line} -> ${i.tag}`));
