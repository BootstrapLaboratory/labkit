---
title: "Server Database"
sidebar_label: "Server Database"
---

PostgreSQL and TypeORM helpers for explicit database composition.

## Install

```bash
npm install @omgjs/labkit-server-database
```

Runtime: server only. Package format: CommonJS.

## Public API Groups

- PostgreSQL URL and discrete connection readers.
- SSL config reader.
- database runtime flags and migration safety assertion.
- safe connection summaries.
- feature manifest types.
- `composeServerDatabaseManifests`.

## Owns

This package owns database option parsing and manifest composition. It keeps
entity/migration aggregation explicit.

## App Still Owns

The app owns DataSource creation, feature entities, migration files, migration
execution timing, backups, and provider-specific database operations.

## Minimal Usage

```ts
import {
  assertDatabaseMigrationSafety,
  composeServerDatabaseManifests,
  readDatabaseRuntimeFlags,
  readPostgresConnectionUrl,
} from "@omgjs/labkit-server-database";

const flags = readDatabaseRuntimeFlags(config, {
  nodeEnv: process.env.NODE_ENV,
});
assertDatabaseMigrationSafety(flags);

const manifest = composeServerDatabaseManifests([
  serverAuthTypeormDatabaseManifest,
  featureDatabaseManifest,
]);

const url = readPostgresConnectionUrl(config);
```

## Runtime Notes

Do not use `synchronize` and automatic migration runs together. Labkit throws
for that combination because it creates ambiguous schema ownership.

Package README and source:
[`../../packages/server-database/README.md`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/server-database/README.md),
[`../../packages/server-database/src/index.ts`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/server-database/src/index.ts).
