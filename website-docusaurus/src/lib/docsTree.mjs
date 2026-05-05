import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

export const websiteRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const repoRoot = path.resolve(websiteRoot, "..");
export const docsTreePath = path.join(websiteRoot, "docs-tree.yaml");

export function loadDocsTree() {
  const tree = parseYaml(readFileSync(docsTreePath, "utf8"));

  if (
    typeof tree !== "object" ||
    tree === null ||
    !Array.isArray(tree.items) ||
    (tree.quickStartItems !== undefined &&
      !Array.isArray(tree.quickStartItems)) ||
    (tree.tutorialItems !== undefined && !Array.isArray(tree.tutorialItems))
  ) {
    throw new Error(
      "website-docusaurus/docs-tree.yaml must define items and optional quickStartItems/tutorialItems arrays.",
    );
  }

  return tree;
}

function normalizeSource(source) {
  return path.relative(repoRoot, path.resolve(websiteRoot, source));
}

function allDocItems() {
  const tree = loadDocsTree();

  return [
    ...tree.items,
    ...(tree.quickStartItems ?? []),
    ...(tree.tutorialItems ?? []),
  ];
}

export function flattenDocsTree(items = allDocItems()) {
  const pages = [];

  for (const item of items) {
    if (item.source !== undefined) {
      pages.push({
        description: item.description ?? "",
        id: item.id,
        source: normalizeSource(item.source),
        title: item.title,
      });
    }

    if (Array.isArray(item.children)) {
      pages.push(...flattenDocsTree(item.children));
    }
  }

  return pages;
}

function treeItemToSidebar(item) {
  if (Array.isArray(item.children)) {
    return {
      type: "category",
      label: item.title,
      items: item.children.map(treeItemToSidebar),
    };
  }

  return {
    type: "doc",
    id: item.id,
    label: item.title,
  };
}

export function buildSidebar() {
  const tree = loadDocsTree();

  return {
    docsSidebar: tree.items.map(treeItemToSidebar),
    quickStartSidebar: (tree.quickStartItems ?? []).map(treeItemToSidebar),
    tutorialSidebar: (tree.tutorialItems ?? []).map(treeItemToSidebar),
  };
}
