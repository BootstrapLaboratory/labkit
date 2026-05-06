# Use Workspace Protocol Dependencies

## Goal

Normalize cross-project Labkit dependency declarations so local development
always resolves internal packages from the Rush workspace while published
packages continue to expose normal npm dependency versions.

## Decision

- Use `workspace:*` for internal Labkit dependencies and devDependencies.
- Do not use `workspace:0.1.1` because exact workspace ranges would need manual
  churn every release.
- Do not use bare `workspace:` in repository manifests even though pnpm treats
  it like `workspace:*`; the explicit form is clearer and matches Rush examples.
- Keep Rush change files Rush-generated, not hand-written.

## Checklist

- [x] Remove manually created Rush change files.
- [x] Convert internal Labkit dependency and devDependency ranges to
  `workspace:*`.
- [x] Enable Rush PNPM workspace installs.
- [x] Regenerate Rush/pnpm install metadata.
- [x] Stage current repository changes.
- [x] Create Rush change files with Rush tooling.
- [x] Run release validation commands.
- [x] Move this task file to `tasks/completed` when complete.
