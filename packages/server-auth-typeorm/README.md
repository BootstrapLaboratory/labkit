# @omgjs/labkit-server-auth-typeorm

`@omgjs/labkit-server-auth-typeorm` is the optional TypeORM/PostgreSQL persistence
adapter boundary for `@omgjs/labkit-server-auth`.

## Owns

- Default Labkit auth TypeORM entities.
- The checked-in identity-table migration.
- Repository adapters for `@omgjs/labkit-server-auth` storage interfaces.
- A transaction runner adapter.
- Nest provider factories for those adapters.
- `ServerAuthTypeormModule` for standard Nest provider registration.
- `serverAuthTypeormDatabaseManifest` for app-owned TypeORM option
  composition.

## Does Not Own

- Running migrations.
- Enabling schema synchronization.
- Creating or mutating database schema at import time.
- Password hashing.
- JWT signing.
- GraphQL DTOs or resolver behavior.

## Usage

```ts
import { ServerAuthTypeormModule } from "@omgjs/labkit-server-auth-typeorm";

@Module({
  imports: [ServerAuthTypeormModule],
})
export class IdentityModule {}
```

Compose the database manifest into the app-owned TypeORM configuration:

```ts
import { composeServerDatabaseManifests } from "@omgjs/labkit-server-database";
import { serverAuthTypeormDatabaseManifest } from "@omgjs/labkit-server-auth-typeorm";

const manifest = composeServerDatabaseManifests([
  serverAuthTypeormDatabaseManifest,
  appFeatureDatabaseManifest,
]);
```

Server apps opt into auth persistence by composing this package's database
manifest and running migrations through their own database workflow.

## Boundary

Importing this package must not run migrations, enable schema synchronization,
or mutate a database. The application owns migration execution and deployment
timing.

## Package Format

This is a server-only CommonJS package.
