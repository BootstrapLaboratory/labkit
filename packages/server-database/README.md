# @labkit/server-database

`@labkit/server-database` contains PostgreSQL and TypeORM configuration helpers
that keep database setup explicit and migration-safe.

## Owns

- PostgreSQL URL normalization.
- Discrete PostgreSQL connection option parsing.
- SSL option parsing.
- Database runtime flags.
- Migration safety checks.
- Safe connection summaries for logs.
- Feature database manifest types.
- Manifest composition for entities and migrations.

## Does Not Own

- Application data source bootstrapping.
- Running migrations.
- Editing or generating migration files.
- Product-specific entities.
- TypeORM module registration for a complete app.

## Usage

```ts
import {
  assertDatabaseMigrationSafety,
  composeServerDatabaseManifests,
  readPostgresConnectionUrl,
} from "@labkit/server-database";
import { serverAuthTypeormDatabaseManifest } from "@labkit/server-auth-typeorm";

const manifest = composeServerDatabaseManifests([
  serverAuthTypeormDatabaseManifest,
  chatDatabaseManifest,
]);

assertDatabaseMigrationSafety({
  synchronize: false,
  migrationsRun: true,
});
```

Feature packages should export manifests. Apps compose those manifests into
their TypeORM options and still own when migrations run.

## Package Format

This is a server-only CommonJS package.
