# Review AI Rules And Release Guidance

## Status

Completed.

## Goal

Review `AGENTS.md` and `.ai` rules so they match the current Labkit repository
structure, keep agent loading strict and minimal, make architecture context
available through `.ai/conventions.md`, and add strict step-by-step release
instructions for Labkit package releases.

## Scope

- Keep `AGENTS.md` simple and strict.
- Keep `.ai/conventions.md` as the always-loaded entry point.
- Reference `.ai/architecture.md` from `.ai/conventions.md`.
- Make `.ai/architecture.md` self-contained and avoid Markdown links inside it.
- Add release instructions that cover package release order, Rush change files,
  docs version archiving, Docusaurus snapshots, validation, and publishing.
- Keep Rush Delivery described as this repository's CI release engine, not as
  Labkit package architecture.

## Checklist

- [x] Review current `.ai` and repository structure.
- [x] Update `AGENTS.md` for strict minimal loading.
- [x] Update `.ai/conventions.md` to point agents to architecture and release
      guidance.
- [x] Rewrite `.ai/architecture.md` as a self-contained project architecture
      note with plain path references.
- [x] Add strict Labkit library release procedure.
- [x] Validate Markdown/rule references.
