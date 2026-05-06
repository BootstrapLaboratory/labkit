---
id: "database-and-migrations"
title: "Database And Migrations"
sidebar_label: "Database And Migrations"
description: "TypeORM manifests, PostgreSQL options, and migration safety."
---

Labkit database packages keep TypeORM setup explicit and migration-safe.
They do not run migrations for you.

## Feature Manifests

Each feature package or module can export a manifest:

```ts
import type { ServerDatabaseFeatureManifest } from "@omgjs/labkit-server-database";
import { MessageEntity } from "./entities/message.entity";
import { CreateMessageTable20260415190000 } from "./migrations/20260415190000-CreateMessageTable";

export const chatDatabaseManifest = {
  entities: [MessageEntity],
  migrations: [CreateMessageTable20260415190000],
} satisfies ServerDatabaseFeatureManifest;
```

The app composes manifests into TypeORM options:

```ts
import { composeServerDatabaseManifests } from "@omgjs/labkit-server-database";
import { serverAuthTypeormDatabaseManifest } from "@omgjs/labkit-server-auth-typeorm";

const manifest = composeServerDatabaseManifests([
  serverAuthTypeormDatabaseManifest,
  chatDatabaseManifest,
]);
```

This keeps feature ownership visible. Auth persistence comes from Labkit.
Product entities come from the app.

## Connection Options

`@omgjs/labkit-server-database` reads either URL-style PostgreSQL config or
discrete fields:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `DATABASE_SSL`
- `DATABASE_SSL_REJECT_UNAUTHORIZED`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `DATABASE_USER`
- `DATABASE_PASSWORD`

It also summarizes connections for logs without leaking passwords.

## Migration Safety

`assertDatabaseMigrationSafety` prevents the dangerous combination of
`DATABASE_SYNCHRONIZE=true` and `DATABASE_RUN_MIGRATIONS_ON_START=true`.

Local development can choose synchronization for fast iteration. Runtime
environments that run migrations should keep synchronization off and execute
known migration files deliberately.

## What The App Owns

The app owns:

- DataSource creation;
- when migrations run;
- whether migrations run in CI, startup, or a separate command;
- product entities and migration files;
- backup, restore, and provider-specific database operations.

Labkit owns the reusable parsing, safety checks, and manifest composition.
