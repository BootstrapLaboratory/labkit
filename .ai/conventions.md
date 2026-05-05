# AI Conventions

Use this file when modifying Labkit or helping future agents understand where a
change belongs.

## Public Contract First

Start from the public contract:

- Package README files and root package documentation.
- Public exports and package entrypoints.
- Package metadata in `package.json`, [`../rush.json`](../rush.json), and
  [`../common/config/rush`](../common/config/rush).
- Package release metadata under [`../.dagger/release`](../.dagger/release).
- Shared/server/browser dependency boundaries.

Avoid changing source internals before checking whether the same outcome belongs
in a public API, package metadata, release metadata, or documentation.

## Keep Package Boundaries Clear

Labkit is a Rush-managed TypeScript package library. Each package under
[`../packages`](../packages) should keep a clear dependency boundary, build,
tests, and public API.

Shared packages must stay safe for both server and browser code. Server packages
may depend on shared packages and server frameworks. Browser packages may depend
on shared packages and browser frameworks. Server packages must not depend on
browser packages, and browser packages must not depend on server packages.

Application-specific choices stay app-owned unless the reusable constraint is
clearly part of Labkit.

## Prefer Metadata Over Hardcoding

Do not add package-name switches or hardcoded source lists when Rush metadata,
package metadata, or local configuration can describe the behavior.

Keep release behavior declarative. Rush owns package versioning and change-file
semantics. Rush Delivery is used by this repository as a CI release runner, not
as the architecture model for Labkit packages.

Keep `toolchain-image-provider` and `rush-cache-provider` set to `off` unless
provider metadata is added intentionally.

## CI And Release

Pull requests run direct Rush validation through
[`../.github/workflows/pr-validate.yaml`](../.github/workflows/pr-validate.yaml).

Package release runs through
[`../.github/workflows/package-release.yaml`](../.github/workflows/package-release.yaml)
with the Rush Delivery `release-packages` entrypoint and
[`../.dagger/release/npm.yaml`](../.dagger/release/npm.yaml).

Keep Rush Delivery references scoped to release-runner configuration and release
metadata. Do not copy Rush Delivery framework concepts such as deploy targets,
Dagger stage orchestration, provider adapters, or workflow entrypoints into
Labkit package architecture unless this repository explicitly starts owning such
metadata.

## Documentation Style

Keep documentation high-level and API-oriented. Package READMEs should describe
what the package owns, what the application still owns, the main public API, a
typical usage shape, and runtime/package-format expectations.

Use relative links. Remove obsolete descriptions instead of adding historical
warnings about old behavior.

Do not create package-local `docs/` folders until a package README becomes too
large or the package needs separate recipes, migration notes, or
provider-specific guides.

When a Docusaurus documentation website is added, freeze the currently released
docs before editing root docs for the next release line. The snapshot directory
should use the latest released tag version, for example
`docs-versions/versioned_docs/version-v0.5.0/`. Treat released versioned docs as
immutable snapshots.

After completing any repository file changes, include two semantic commit
message suggestions: one short commit subject and one more detailed commit
message with a body.

## Version Guidance

Public package API or behavior changes normally need Rush change files. Use the
same version impact across related packages only when their public contracts
really change together.

Do not create a local schema versioning process unless Labkit starts publishing
schemas as part of its own public contract. External schema URLs used by Rush
Delivery release metadata describe the release runner contract, not Labkit's
package architecture.

If a future Labkit public schema or generated documentation artifact becomes
versioned, keep released version directories immutable and update current docs,
tutorials, and examples to reference the new version.

## Task Files

Read [`rules/TasksFiles.md`](rules/TasksFiles.md) before creating or modifying
task files.

Create a task file before implementation when the work is more than a small
local fix, needs multiple design decisions, or changes public project
contracts. Task files are required by default for:

- package public API changes
- package metadata or release metadata changes
- behavior changes across shared, server, or browser package boundaries
- combined docs-and-implementation changes
- anything that needs version guidance

When a task checklist is complete, move the file into the matching `completed`
directory. Do not modify completed task files.
