---
title: "Server"
sidebar_label: "Server"
description: "Minimal Nest GraphQL server with Labkit config."
---

Create the server entrypoint, root module, and a tiny GraphQL feature.

## `server/src/main.ts`

```ts
import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import {
  readServerCorsOptions,
  readServerRuntimeOptions,
  summarizeServerCorsOrigin,
} from "@omgjs/labkit-server-config";
import { logStructuredEvent } from "@omgjs/labkit-server-observability";
import { AppModule } from "./app.module";

const logger = new Logger("Bootstrap");

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(fastifyCookie);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = app.get(ConfigService);
  const cors = readServerCorsOptions(config);
  const runtime = readServerRuntimeOptions(config);

  app.enableCors(cors);
  app.enableShutdownHooks();

  logStructuredEvent(logger, "log", "server_configured", {
    host: runtime.host,
    port: runtime.port,
    graphqlPath: runtime.graphqlPath,
    corsOrigin: summarizeServerCorsOrigin(cors.origin),
    corsCredentials: cors.credentials,
  });

  await app.listen(runtime.port, runtime.host);
}

void bootstrap().catch((error) => {
  logStructuredEvent(logger, "error", "server_bootstrap_failed", {}, error);
  process.exit(1);
});
```

## `server/src/app.module.ts`

```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createServerGraphqlModule } from "@omgjs/labkit-server-graphql";
import { getEnvFilePaths } from "@omgjs/labkit-server-config";
import { HelloModule } from "./hello/hello.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePaths(),
      ignoreEnvFile: process.env.NODE_ENV === "production",
    }),
    HelloModule,
    createServerGraphqlModule({
      inject: [ConfigService],
      useFactory: (configReader: ConfigService) => ({
        configReader,
        resolvePrincipalFromAuthorization: () => null,
      }),
    }),
  ],
})
export class AppModule {}
```

## `server/src/hello/hello.module.ts`

```ts
import { Module } from "@nestjs/common";
import { HelloResolver } from "./hello.resolver";

@Module({
  providers: [HelloResolver],
})
export class HelloModule {}
```

## `server/src/hello/hello.resolver.ts`

```ts
import { Args, Mutation, Query, Resolver, Subscription } from "@nestjs/graphql";
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();
const HELLO_ADDED = "helloAdded";

@Resolver()
export class HelloResolver {
  @Query(() => String)
  hello(): string {
    return "Hello from Labkit";
  }

  @Mutation(() => String)
  async addHello(@Args("message") message: string): Promise<string> {
    await pubsub.publish(HELLO_ADDED, { helloAdded: message });
    return message;
  }

  @Subscription(() => String)
  helloAdded() {
    return pubsub.asyncIterableIterator(HELLO_ADDED);
  }
}
```

Install the tiny subscription helper used by the example:

```bash
npm install -w server graphql-subscriptions
```

## `server/.env.development`

```dotenv
HOST=0.0.0.0
PORT=3000
GRAPHQL_PATH=/graphql
CORS_ORIGIN=http://localhost:5173
AUTH_REFRESH_TOKEN_TRANSPORT=cookie
```

At this point the server demonstrates Labkit config, structured logs, and
GraphQL module creation. Auth and database come next.
