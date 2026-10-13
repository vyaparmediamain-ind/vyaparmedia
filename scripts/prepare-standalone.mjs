import { cp, mkdir, rm, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function copyIfPresent(source, destination) {
  if (!(await exists(source))) return;
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

async function removeIfPresent(target) {
  if (!(await exists(target))) return;
  await rm(target, { force: true, recursive: true });
}

// 1. Inject dynamic build timestamp / commit hash into service worker cache name
const swPath = path.join(root, "public", "sw.js");
if (await exists(swPath)) {
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.BUILD_ID || Date.now().toString();
  let swContent = await readFile(swPath, "utf8");
  swContent = swContent.replace(
    /const CACHE_NAME = "vyaparmedia-static-[^"]+";/,
    `const CACHE_NAME = "vyaparmedia-static-${buildId}";`,
  );
  await writeFile(swPath, swContent, "utf8");
}

if (await exists(standaloneDir)) {
  await removeIfPresent(path.join(standaloneDir, ".env"));
  await removeIfPresent(path.join(standaloneDir, ".env.local"));
  await removeIfPresent(path.join(standaloneDir, ".env.production"));
  await removeIfPresent(path.join(standaloneDir, ".env.production.local"));
  await copyIfPresent(
    path.join(root, ".next", "static"),
    path.join(standaloneDir, ".next", "static"),
  );
  await copyIfPresent(path.join(root, "public"), path.join(standaloneDir, "public"));
  process.stdout.write("[standalone] Copied static and public assets with versioned service worker.\n");
}
