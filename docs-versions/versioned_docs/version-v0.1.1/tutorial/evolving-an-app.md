---
title: "Evolving An App"
sidebar_label: "Evolving An App"
---

When adding a feature, decide first whether the behavior is product-specific or
runtime-reusable.

## Add A Protected Feature

1. Add server entity and migration.
2. Export a feature database manifest.
3. Add GraphQL DTOs and resolver methods.
4. Protect resolver methods with guards or principal checks.
5. Regenerate the GraphQL schema.
6. Add Relay operations in the webapp feature folder.
7. Regenerate Relay artifacts.
8. Update route loaders and UI.
9. Add tests around app-owned behavior.

## Move Behavior Into Labkit Only When

- a second app needs the same runtime rule;
- the behavior does not import product code;
- the abstraction reduces real duplication;
- ownership remains clear after extraction.

Keep product policy in the app. Move runtime mechanics into Labkit.
