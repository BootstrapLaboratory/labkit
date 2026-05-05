import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { repoRoot, websiteRoot } from "../src/lib/docsTree.mjs";

const schemasSourceDir = path.join(repoRoot, "schemas");
const schemasTargetDir = path.join(websiteRoot, "static", "schemas");

async function main() {
  await rm(schemasTargetDir, { force: true, recursive: true });

  try {
    await stat(schemasSourceDir);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  await mkdir(path.dirname(schemasTargetDir), { recursive: true });
  await cp(schemasSourceDir, schemasTargetDir, { recursive: true });
}

await main();
