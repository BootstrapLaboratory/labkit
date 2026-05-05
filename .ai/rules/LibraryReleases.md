# Library Release Procedure

Read this file before working on Labkit package releases, package versions,
Rush change files, docs version snapshots, package publishing, or release
workflows.

## Non-Negotiable Rules

- Do not publish packages locally unless the user explicitly asks for a local
  publish operation.
- Do not run `rush change --commit` or pass `--commit-message`; the user owns
  commits.
- Do not stage or commit files unless the user explicitly asks.
- Do not create package versions by manually editing package versions unless
  the task explicitly asks for a version-file repair. Rush owns version changes.
- Do not edit archived docs under `docs-versions` by hand after a snapshot is
  committed. Regenerate snapshots from tagged source, or ask the user before an
  emergency archive repair.
- Do not treat Rush Delivery as Labkit architecture. It is only the CI release
  engine used by `.github/workflows/package-release.yaml`.

## When A Release Change Is Needed

A Rush change file is normally required when a change affects a public package
contract or package behavior:

- public exports;
- runtime behavior;
- package dependencies or peer dependency expectations;
- package metadata that affects npm consumers;
- package README or root docs that describe released behavior.

Docs-only website/homepage changes do not require a package release unless they
document a package contract change that is part of the same release.

Use bump types carefully:

- `major`: breaking public API or behavior change.
- `minor`: backward-compatible new public API or capability.
- `patch`: backward-compatible bug fix or behavior correction.
- `none`: package-owned changes that should not trigger an immediate release.

Use the same bump type across multiple packages only when their public contracts
really change together.

## Required Order For Release Work

1. Read `AGENTS.md`, `.ai/conventions.md`, `.ai/architecture.md`, this file,
   and any task-specific rules.
2. Inspect `git status --short` and identify unrelated user changes. Work with
   them; do not revert them.
3. Identify the packages affected from `rush.json` and the relevant
   `packages/*/package.json` files.
4. Decide whether the task is package release work, docs-only work, or both.
5. If the work is more than a small local fix, create a task file under `tasks`
   before implementation.
6. If starting a new release line, archive the current docs before changing
   root docs for the next version. Follow the docs snapshot procedure below.
7. Make package/source/docs changes.
8. Update package README files and root docs under `docs` for any public
   package behavior or API changes.
9. Create Rush change files for affected packages.
10. Run validation commands.
11. Summarize changed files, validation results, and release/publish
    expectations for the user.

## Docusaurus Docs Snapshot Procedure

Use this when working on a new release and the current released docs must remain
available for old package versions.

1. Determine the released version being archived from
   `website-docusaurus/docusaurus.config.ts` `currentDocsVersion`.
2. Confirm a matching git tag exists for that released version. The versioned
   docs generator reads files from git tags.
3. Add the released version to the `publishedVersions` array in
   `website-docusaurus/scripts/sync-versioned-docs.mjs` if it is not already
   present.
4. Add the same version to `archivedDocsVersions` in
   `website-docusaurus/docusaurus.config.ts`.
5. Set `currentDocsVersion` in `website-docusaurus/docusaurus.config.ts` to the
   new release line label when current docs are being prepared for that new
   release.
6. Run `npm run site:docusaurus:sync-versioned-docs`.
7. Confirm generated changes under `docs-versions/versions.json`,
   `docs-versions/versioned_docs`, and `docs-versions/versioned_sidebars`.
8. Run `npm run site:docusaurus:check`.
9. Do not modify generated archive files after this except by regenerating the
   snapshot.

If there is no matching tag yet, stop and explain the blocker. Do not invent a
docs snapshot from the working tree unless the user explicitly approves that
manual fallback.

## Creating Rush Change Files

Prefer Rush-managed change files over hand-written version edits.

For one common bump type and one common message across all changed projects,
use:

```bash
node common/scripts/install-run-rush.js change \
  --bulk \
  --message "Describe the package-visible change" \
  --bump-type patch \
  --target-branch origin/main \
  --no-fetch
```

Change `patch` to `minor`, `major`, or `none` as appropriate.

When packages need different messages or bump types, use `rush change`
interactively or create separate Rush change files only if you know the Rush
change-file format already used by this repository. Do not guess the format.

Never use `--commit` while creating change files.

Verify change files with:

```bash
node common/scripts/install-run-rush.js change \
  --verify \
  --target-branch origin/main \
  --no-fetch
```

## Validation Before Release

Run the smallest relevant validation while developing, then run the full release
validation before handing release work back to the user:

```bash
npm run rush:install
npm run rush:build
npm run rush:lint
node common/scripts/install-run-rush.js test --parallelism 1
node common/scripts/install-run-rush.js verify --parallelism 1
npm run site:docusaurus:check
```

If only docs changed and no package source changed, `npm run
site:docusaurus:check` is usually enough, but still run Rush validation if the
docs change is part of a package release.

## CI Publish Flow

Package publishing is expected to happen in CI:

1. The user merges or pushes release changes to `main`.
2. `.github/workflows/package-release.yaml` starts on push to `main`.
3. The workflow calls `BootstrapLaboratory/rush-delivery@v0.6.6` with
   `entrypoint: release-packages`.
4. `.dagger/release/npm.yaml` tells Rush Delivery to use
   `rush-change-files` against `main`.
5. Rush consumes valid change files, bumps package versions, publishes to npm
   using `NPM_TOKEN`, and writes release artifacts according to Rush Delivery.

GitHub Pages publishing is separate:

1. `.github/workflows/pages.yml` starts on push to `main` only when docs,
   `docs-versions`, `website-docusaurus`, `README.md`, or the Pages workflow
   changes.
2. It builds `website-docusaurus`.
3. It uploads and deploys the Pages artifact.

For docs-only commits that touch `website-docusaurus` or `docs`, expect Pages
to deploy. The package release workflow may also start because it currently
triggers on every push to `main`, but it should not publish package versions
without valid Rush change files requiring a release.

## Post-Release Checks

After CI finishes, check or ask the user to check:

- the package release workflow completed successfully;
- expected package versions appeared on npm;
- package changelogs and tags are correct if the release process produced them;
- GitHub Pages deployed successfully when docs changed;
- current docs and archived docs show the intended versions.
