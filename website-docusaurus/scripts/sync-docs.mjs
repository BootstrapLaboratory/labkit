import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  flattenDocsTree,
  repoRoot,
  websiteRoot,
} from "../src/lib/docsTree.mjs";

const generatedDocsDir = path.join(websiteRoot, "docs");
const githubBlobBase =
  "https://github.com/BootstrapLaboratory/labkit/blob/main";

function stripLeadingHeading(markdown) {
  return markdown.replace(/^# .+\r?\n+/, "");
}

function frontmatterString(page) {
  const lines = [
    "---",
    `title: ${JSON.stringify(page.title)}`,
    `sidebar_label: ${JSON.stringify(page.title)}`,
  ];

  if (!page.id.includes("/")) {
    lines.splice(1, 0, `id: ${JSON.stringify(page.id)}`);
  }

  if (page.description.length > 0) {
    lines.push(`description: ${JSON.stringify(page.description)}`);
  }

  lines.push("---", "");
  return lines.join("\n");
}

function routeForId(id) {
  return id === "index" ? "/docs/" : `/docs/${id}/`;
}

function relativeDocRoute(fromId, toId) {
  const relative = path.posix.relative(routeForId(fromId), routeForId(toId));

  return relative.length > 0 ? relative : ".";
}

function rewriteMarkdownLinks(markdown, page, sourceToId) {
  const sourceDir = path.dirname(path.join(repoRoot, page.source));

  return markdown.replace(
    /\]\((?!https?:\/\/|mailto:|#|\/)([^)\s]+)(#[^)]+)?\)/g,
    (_match, rawLink, rawHash = "") => {
      const targetPath = path
        .relative(repoRoot, path.resolve(sourceDir, rawLink))
        .replaceAll(path.sep, "/");
      const targetId = sourceToId.get(targetPath);

      if (targetId !== undefined) {
        return `](${relativeDocRoute(page.id, targetId)}${rawHash})`;
      }

      return `](${githubBlobBase}/${targetPath}${rawHash})`;
    },
  );
}

async function main() {
  const pages = flattenDocsTree();
  const sourceToId = new Map(pages.map((page) => [page.source, page.id]));

  await rm(generatedDocsDir, { force: true, recursive: true });
  await mkdir(generatedDocsDir, { recursive: true });

  await writeFile(
    path.join(generatedDocsDir, "index.md"),
    [
      "---",
      'id: "index"',
      'title: "Docs"',
      'sidebar_label: "Docs"',
      'description: "Documentation for Labkit."',
      "---",
      "",
      "Choose a page from the sidebar, or start with the [Quick Start](quick-start).",
      "",
    ].join("\n"),
  );

  for (const page of pages) {
    const sourcePath = path.join(repoRoot, page.source);
    const markdown = rewriteMarkdownLinks(
      stripLeadingHeading(await readFile(sourcePath, "utf8")),
      page,
      sourceToId,
    );
    const outputPath = path.join(generatedDocsDir, `${page.id}.md`);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      `${frontmatterString(page)}${markdown.trim()}\n`,
    );
  }
}

await main();
