# AI Architecture Notes

Labkit is a Rush-managed TypeScript package library. It extracts reusable
server and browser runtime concerns from a production NestJS GraphQL and
React/Vite/Relay application model while leaving product-specific choices in
consuming applications.

This document is self-contained. It uses plain repository paths, not Markdown
links, so agents can copy paths without assuming a rendered document.

## Repository Map

- `rush.json`: Rush project graph, package names, project folders, review
  categories, and version policy membership.
- `common/config/rush`: Rush command, pnpm, lockfile, publish, and version
  policy metadata.
- `packages`: public Labkit packages published to npm, grouped by shared,
  server, browser, and browser tooling runtime concerns.
- `tools/eslint-config`: private Rush project for repository linting support.
- `docs`: editable source documentation for the current docs line.
- `website-docusaurus`: Docusaurus website, generated docs copy, website
  scripts, sidebars, static assets, and GitHub Pages build.
- `docs-versions`: committed Docusaurus version archive inputs.
- `.github/workflows/pr-validate.yaml`: pull request validation workflow.
- `.github/workflows/package-release.yaml`: package release workflow.
- `.github/workflows/pages.yml`: GitHub Pages deployment workflow.
- `.dagger/release/npm.yaml`: Rush Delivery npm release metadata.
- `.ai`: AI conventions and task-scoped rules.
- `tasks`: active task plans.
- `tasks/completed`: completed task archive; do not edit archived task files.

## Package Groups

Shared packages are safe for both server and browser code:

- `packages/runtime-config`: `@omgjs/labkit-runtime-config`
- `packages/auth-contract`: `@omgjs/labkit-auth-contract`

Server packages may depend on shared packages and server frameworks:

- `packages/server-config`: `@omgjs/labkit-server-config`
- `packages/server-database`: `@omgjs/labkit-server-database`
- `packages/server-graphql`: `@omgjs/labkit-server-graphql`
- `packages/server-auth`: `@omgjs/labkit-server-auth`
- `packages/server-auth-typeorm`: `@omgjs/labkit-server-auth-typeorm`
- `packages/server-observability`: `@omgjs/labkit-server-observability`

Browser packages may depend on shared packages and browser frameworks:

- `packages/webapp-external-store`: `@omgjs/labkit-webapp-external-store`
- `packages/webapp-auth`: `@omgjs/labkit-webapp-auth`
- `packages/webapp-realtime`: `@omgjs/labkit-webapp-realtime`
- `packages/webapp-graphql-relay`: `@omgjs/labkit-webapp-graphql-relay`
- `packages/webapp-ui`: `@omgjs/labkit-webapp-ui`

Browser tooling packages support browser app builds and are still Labkit
packages:

- `packages/webapp-build-config`: `@omgjs/labkit-webapp-build-config`

Private repository tooling is not a public runtime package:

- `tools/eslint-config`: `@omgjs/labkit-eslint-config`

## Boundary Rules

Shared packages must not depend on NestJS, TypeORM, React, Relay, Vite, or
browser-only globals.

Server packages must not depend on browser packages. Browser packages must not
depend on server packages.

Applications may depend on Labkit packages. Labkit packages must not import from
application packages.

Labkit owns reusable runtime policy, contracts, helper factories, and adapter
interfaces. Applications own product schema, concrete resolvers, generated
operations, concrete UI, concrete themes, environment naming, migration
execution, deployment, and lifecycle side effects.

## Public API And Package Format

Package README files are part of the public contract. When a public export,
runtime behavior, package entrypoint, or package dependency expectation changes,
update the package README and any root docs that describe it.

Shared and browser-consumed packages publish both CommonJS and ESM entry
points. Server-only packages currently publish CommonJS output only.

Keep concrete application dependencies out of Labkit packages unless the
dependency is part of the reusable package contract.

## Documentation Architecture

Root docs under `docs` are the source of truth for current docs content.

`website-docusaurus/scripts/sync-docs.mjs` copies and rewrites current docs into
`website-docusaurus/docs` before website build. Do not hand-edit
`website-docusaurus/docs` as source content.

`website-docusaurus/docs-tree.yaml` maps root docs into Docusaurus ids and
sidebars.

`docs-versions/versions.json`, `docs-versions/versioned_docs`, and
`docs-versions/versioned_sidebars` are committed version archive inputs for
Docusaurus.

`website-docusaurus/scripts/sync-versioned-docs.mjs` generates
`docs-versions` snapshots from tagged source using its `publishedVersions`
array.

`website-docusaurus/scripts/sync-versioned-inputs.mjs` copies `docs-versions`
into the Docusaurus app before build.

`website-docusaurus/docusaurus.config.ts` owns the current docs label and the
archived docs versions visible in the website.

## CI And Release

Pull requests run direct Rush validation through
`.github/workflows/pr-validate.yaml`:

- `npm run rush:install`
- `rush change --verify`
- `npm run rush:build`
- `npm run rush:lint`
- `rush test`
- `rush verify`

Package releases run through `.github/workflows/package-release.yaml` on push
to `main` or manual dispatch. The workflow calls
`BootstrapLaboratory/rush-delivery@v0.6.6` with the `release-packages`
entrypoint and reads `.dagger/release/npm.yaml`.

The release metadata uses Rush change files as the versioning strategy. Package
publishing should only happen when valid Rush change files require package
version changes.

The GitHub Pages workflow in `.github/workflows/pages.yml` builds and deploys
the Docusaurus website when docs, website, or Pages workflow files change.

Rush Delivery is an external CI release engine in this repository. Its Dagger
framework architecture, application deploy target model, and provider adapter
patterns are not Labkit architecture.

## Invariants

Public package APIs must be intentional and documented.

Dependency direction must preserve shared, server, browser, tooling, and
application ownership boundaries.

Rush owns package graph, change verification, versioning, and publish lifecycle
commands.

Rush Delivery only invokes the package release path in CI.

Current docs may change. Archived docs under `docs-versions` are immutable
snapshots once committed.

Completed task files are archives. Do not edit files under `tasks/completed`;
create a new task file for follow-up work.
