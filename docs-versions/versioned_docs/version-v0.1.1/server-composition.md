---
id: "server-composition"
title: "Server Composition"
sidebar_label: "Server Composition"
description: "Nest module, bootstrap, config, GraphQL, and auth composition."
---

A Labkit-style server is still a Nest application. Labkit packages provide
module factories, provider factories, and small helpers that keep repeated
runtime wiring consistent.

## Typical Module Stack

```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { createServerAuthAccessTokenGraphqlModule } from "@omgjs/labkit-server-auth";
import { getEnvFilePaths } from "@omgjs/labkit-server-config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePaths(),
      ignoreEnvFile: process.env.NODE_ENV === "production",
    }),
    IdentityModule,
    FeatureModule,
    createServerAuthAccessTokenGraphqlModule({
      imports: [IdentityModule],
      accessTokenServiceToken: AccessTokenService,
      configReaderToken: ConfigService,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => getDatabaseOptions(),
    }),
  ],
})
export class AppModule {}
```

## Bootstrap Shape

Use application bootstrap for host, port, CORS, cookies, validation, and
structured startup logging:

```ts
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
);

await app.register(fastifyCookie);

const config = app.get(ConfigService);
const cors = readServerCorsOptions(config);
const runtime = readServerRuntimeOptions(config);

app.enableCors(cors);
await app.listen(runtime.port, runtime.host);
```

The original app uses Fastify because Labkit's cookie refresh transport expects
reply objects with `setCookie` and `clearCookie` methods.

## App-Owned Adapters

Server composition usually requires app-owned classes:

- `AccessTokenService` for signing and verifying JWTs;
- `PasswordService` for hashing and verifying passwords;
- `IdentityConfigService` for auth and cookie settings;
- feature modules with resolvers, DTOs, entities, and database manifests;
- lifecycle handlers for audit logs, metrics, notifications, or risk checks.

Labkit keeps those adapter interfaces stable so the same auth and GraphQL
runtime model can move across apps.
