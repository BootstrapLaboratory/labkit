---
id: "documentation-versioning"
title: "Documentation Versioning"
sidebar_label: "Documentation Versioning"
description: "Docusaurus source docs, version snapshots, and build flow."
---

The Labkit documentation site is a Docusaurus app under
[`../website-docusaurus`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/website-docusaurus). Source content lives under
[`../docs`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/docs). The website sync scripts copy docs into the Docusaurus
project before build.

## Current Docs

The current version is configured in
[`../website-docusaurus/docusaurus.config.ts`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/website-docusaurus/docusaurus.config.ts).
For the first Labkit line, current docs are labeled `v0.1.0`.

The sidebar source is
[`../website-docusaurus/docs-tree.yaml`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/website-docusaurus/docs-tree.yaml).
That file maps repository docs into Docusaurus ids and sidebars.

## Build Flow

Run:

```bash
npm run site:docusaurus:check
```

The check runs:

- `sync-docs`;
- `sync-versioned-inputs`;
- `sync-static`;
- TypeScript typecheck for the website;
- Docusaurus build.

## Version Snapshots

Archived docs live under [`../docs-versions`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/docs-versions):

- `versions.json`;
- `versioned_docs`;
- `versioned_sidebars`.

Keep current docs editable under [`../docs`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/docs). Create version
snapshots only when a package version needs its old docs preserved. Do not
rewrite archived docs in place.

## Authoring Rules

Use relative links for files inside this repository. The website sync process
rewrites links between documented pages into Docusaurus routes and rewrites
other repository file links to GitHub source links.

Do not use the website docs for package release manuals or deployment provider
manuals. Link to Rush Delivery or app-specific docs when those topics are
needed for context.
