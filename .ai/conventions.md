# AI Conventions

This file is the always-loaded entry point for AI work in Labkit. Keep it short
and use it to decide which specialized document to load next.

## Load Only What Applies

Do not recursively read every file mentioned here. Read extra `.ai` documents
only when `AGENTS.md` says the current task needs them.

Project architecture lives in [`.ai/architecture.md`](architecture.md). Read it
when the task touches package source, package metadata, documentation
structure, the Docusaurus website, CI/release configuration, or `.ai` guidance
that describes repository structure.

Library release procedure lives in
[`.ai/rules/LibraryReleases.md`](rules/LibraryReleases.md). Read it before
working on package versions, Rush change files, docs version snapshots,
package publishing, or release workflows.

## Project Shape

Labkit is a Rush-managed TypeScript package library for reusable server and
browser runtime concerns. It is not an application deployment framework.

The main source groups are:

- public libraries under `packages`;
- private repository tooling under `tools`;
- root source docs under `docs`;
- generated Docusaurus website sources under `website-docusaurus`;
- archived documentation inputs under `docs-versions`;
- Rush metadata under `rush.json` and `common/config/rush`;
- release and validation workflows under `.github/workflows`;
- Rush Delivery release-runner metadata under `.dagger/release`.

Rush Delivery is used here as a CI release engine. Do not copy Rush Delivery
application deployment concepts into Labkit package architecture.

## Public Contract First

Start from the public contract:

- package README files and root docs;
- public exports and package entrypoints;
- package metadata in `package.json`, `rush.json`, and `common/config/rush`;
- release metadata under `.dagger/release`;
- shared, server, browser, and tooling dependency boundaries.

Avoid changing source internals before checking whether the same outcome belongs
in a public API, package metadata, release metadata, or documentation.

## Boundaries

Shared packages must stay safe for both server and browser code. Server
packages may depend on shared packages and server frameworks. Browser packages
may depend on shared packages and browser frameworks. Server packages must not
depend on browser packages, and browser packages must not depend on server
packages.

Application-specific choices stay app-owned unless the reusable constraint is
clearly part of Labkit.

## Documentation

Use relative Markdown links when linking to repository files from Markdown
documents, unless a task-specific rule says a document must use plain path text.

Root docs under `docs` are the editable source for current documentation.
Docusaurus generated docs under `website-docusaurus/docs` are produced by sync
scripts and should not be hand-edited as source content.

Keep released docs snapshots under `docs-versions` immutable once committed.

## Task Files

Read [`.ai/rules/TasksFiles.md`](rules/TasksFiles.md) before creating or
modifying task files.

Create a task file before implementation when the work is more than a small
local fix, needs multiple design decisions, or changes public project
contracts. When the checklist is complete, move the task file into
`tasks/completed`.

## Final Response

After completing repository file changes, include two semantic commit message
suggestions: one short commit subject and one detailed commit message with a
body.
