# Review AI Conventions

## Goal

Review the copied AI convention files and remove guidance that is specific to
the Rush Delivery framework project, while preserving repository-agnostic
conventions and Labkit's real Rush/Rush Delivery CI release usage.

## Scope

- Review [`../../AGENTS.md`](../../AGENTS.md),
  [`../../.ai/conventions.md`](../../.ai/conventions.md),
  [`../../.ai/architecture.md`](../../.ai/architecture.md), and relevant rule
  files.
- Keep generic task, documentation, Docusaurus/versioning, and shell-layout
  conventions unless they conflict with Labkit.
- Keep references to Rush and Rush Delivery where they describe this
  repository's actual package validation or release workflow.

## Checklist

- [x] Identify copied Rush Delivery framework-specific assumptions.
- [x] Update convention and architecture notes for this TypeScript package
  library.
- [x] Verify remaining Rush Delivery mentions describe CI release tooling, not
  this repository's product architecture.
