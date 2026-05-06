# Documentation Versioning

The Labkit documentation site is a Docusaurus app under
[`../website-docusaurus`](../website-docusaurus). Source content lives under
[`../docs`](../docs). The website sync scripts copy docs into the Docusaurus
project before build.

## Current Docs

The current version is configured in
[`../website-docusaurus/docusaurus.config.ts`](../website-docusaurus/docusaurus.config.ts).
Current docs are labeled `vNext` while they describe unreleased package work.
Published docs remain available through the version selector, starting with
`v0.1.1`.

The sidebar source is
[`../website-docusaurus/docs-tree.yaml`](../website-docusaurus/docs-tree.yaml).
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

Archived docs live under [`../docs-versions`](../docs-versions):

- `versions.json`;
- `versioned_docs`;
- `versioned_sidebars`.

Keep current docs editable under [`../docs`](../docs). Create version
snapshots only when a package version needs its old docs preserved. Do not
rewrite archived docs in place.

## Authoring Rules

Use relative links for files inside this repository. The website sync process
rewrites links between documented pages into Docusaurus routes and rewrites
other repository file links to GitHub source links.

Do not use the website docs for package release manuals or deployment provider
manuals. Link to Rush Delivery or app-specific docs when those topics are
needed for context.
