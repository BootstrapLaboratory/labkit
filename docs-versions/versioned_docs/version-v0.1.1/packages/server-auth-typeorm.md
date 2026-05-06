---
title: "Server Auth TypeORM"
sidebar_label: "Server Auth TypeORM"
---

TypeORM/PostgreSQL persistence adapter for `@omgjs/labkit-server-auth`.

## Install

```bash
npm install @omgjs/labkit-server-auth-typeorm
```

Runtime: server only. Package format: CommonJS.

## Public API Groups

- identity user, account, role, and refresh-session entities;
- checked-in identity-table migration;
- `serverAuthTypeormDatabaseManifest`;
- TypeORM repository adapter classes;
- `createServerAuthTypeormRepositories`;
- `createServerAuthTypeormRepositoryProviders`;
- `ServerAuthTypeormModule`.

## Owns

This package owns the default Labkit auth persistence schema and adapters for
the server-auth repository interfaces.

## App Still Owns

The app owns TypeORM root configuration, migration execution, database
provider setup, password hashing, JWT signing, auth resolver names, and product
user profile fields outside the default auth schema.

## Minimal Usage

```ts
import { ServerAuthTypeormModule } from "@omgjs/labkit-server-auth-typeorm";

@Module({
  imports: [ServerAuthTypeormModule],
})
export class IdentityPersistenceModule {}
```

Compose the manifest:

```ts
import { composeServerDatabaseManifests } from "@omgjs/labkit-server-database";
import { serverAuthTypeormDatabaseManifest } from "@omgjs/labkit-server-auth-typeorm";

const manifest = composeServerDatabaseManifests([
  serverAuthTypeormDatabaseManifest,
  appFeatureDatabaseManifest,
]);
```

## Runtime Notes

Importing this package must not mutate a database. The app decides when to run
the migration exported by the package.

Package README and source:
[`../../packages/server-auth-typeorm/README.md`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/server-auth-typeorm/README.md),
[`../../packages/server-auth-typeorm/src/index.ts`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/server-auth-typeorm/src/index.ts).
