import { cp, mkdir, rm, stat } from "node:fs/promises";
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
  process.stdout.write("[standalone] Copied static and public assets.\n");
}
