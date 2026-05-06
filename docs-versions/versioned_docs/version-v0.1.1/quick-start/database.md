---
title: "Database"
sidebar_label: "Database"
description: "TypeORM options and feature manifests."
---

Add TypeORM configuration with Labkit database manifests. This page keeps the
feature tiny so the pattern is visible.

## `server/src/hello/hello.entity.ts`

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "hello_message" })
export class HelloMessageEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  message!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
```

## `server/src/hello/hello.database-manifest.ts`

```ts
import type { ServerDatabaseFeatureManifest } from "@omgjs/labkit-server-database";
import { HelloMessageEntity } from "./hello.entity";

export const helloDatabaseManifest = {
  entities: [HelloMessageEntity],
  migrations: [],
} satisfies ServerDatabaseFeatureManifest;
```

## `server/src/database/typeorm-options.ts`

```ts
import { ConfigService } from "@nestjs/config";
import {
  assertDatabaseMigrationSafety,
  composeServerDatabaseManifests,
  readDatabaseRuntimeFlags,
  readPostgresConnectionUrl,
  readPostgresDiscreteConnectionOptions,
  readPostgresSslConfig,
  summarizePostgresConnection,
} from "@omgjs/labkit-server-database";
import { serverAuthTypeormDatabaseManifest } from "@omgjs/labkit-server-auth-typeorm";
import type { DataSourceOptions } from "typeorm";
import { helloDatabaseManifest } from "../hello/hello.database-manifest";

export function createTypeormOptions(config: ConfigService): DataSourceOptions {
  const flags = readDatabaseRuntimeFlags(config, {
    nodeEnv: process.env.NODE_ENV,
  });
  assertDatabaseMigrationSafety(flags);

  const manifest = composeServerDatabaseManifests([
    serverAuthTypeormDatabaseManifest,
    helloDatabaseManifest,
  ]);

  const url = readPostgresConnectionUrl(config);
  const base = url
    ? { type: "postgres" as const, url }
    : {
        type: "postgres" as const,
        ...readPostgresDiscreteConnectionOptions(config),
      };

  console.log(
    JSON.stringify({
      event: "database_configured",
      ...summarizePostgresConnection({ ...base, synchronize: flags.synchronize }),
    }),
  );

  return {
    ...base,
    ssl: readPostgresSslConfig(config, { nodeEnv: process.env.NODE_ENV }),
    entities: manifest.entities,
    migrations: manifest.migrations,
    migrationsRun: flags.runMigrationsOnStart,
    synchronize: flags.synchronize,
  };
}
```

## Add TypeORM To `AppModule`

```ts
import { TypeOrmModule } from "@nestjs/typeorm";
import { createTypeormOptions } from "./database/typeorm-options";

TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: createTypeormOptions,
});
```

## Database Env

```dotenv
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=labkit_example
DATABASE_USER=labkit
DATABASE_PASSWORD=labkit
DATABASE_SYNCHRONIZE=true
DATABASE_RUN_MIGRATIONS_ON_START=false
```

Use synchronization only for local exploration. Real app environments should
run migrations deliberately with synchronization off.
