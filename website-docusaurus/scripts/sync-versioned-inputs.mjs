import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { repoRoot, websiteRoot } from "../src/lib/docsTree.mjs";

const docsVersionsRoot = path.join(repoRoot, "docs-versions");

const inputs = [
  {
    source: path.join(docsVersionsRoot, "versions.json"),
    target: path.join(websiteRoot, "versions.json"),
  },
  {
    source: path.join(docsVersionsRoot, "versioned_docs"),
    target: path.join(websiteRoot, "versioned_docs"),
  },
  {
    source: path.join(docsVersionsRoot, "versioned_sidebars"),
    target: path.join(websiteRoot, "versioned_sidebars"),
  },
];

for (const input of inputs) {
  await rm(input.target, { force: true, recursive: true });
  await mkdir(path.dirname(input.target), { recursive: true });
  await cp(input.source, input.target, { recursive: true });
}
