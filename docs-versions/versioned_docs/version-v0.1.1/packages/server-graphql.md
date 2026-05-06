---
title: "Server GraphQL"
sidebar_label: "Server GraphQL"
---

Nest GraphQL setup helpers and reusable GraphQL runtime constraints.

## Install

```bash
npm install @omgjs/labkit-server-graphql
```

Runtime: server only. Package format: CommonJS.

## Public API Groups

- `createServerGraphqlOptions`.
- `createServerGraphqlModule`.
- GraphQL HTTP and websocket context types.
- websocket connection id and subscription logging helpers.
- `DateScalar`, upper-case directive transformer, logging plugin, and query
  complexity plugin.

## Owns

This package owns GraphQL module construction, HTTP/WS context extraction,
subscription authorization extraction, and subscription lifecycle logging.

## App Still Owns

The app owns resolvers, DTOs, schema generation workflow, access-token
verification policy, GraphQL errors, pub/sub, and database access.

## Minimal Usage

```ts
import { createServerGraphqlModule } from "@omgjs/labkit-server-graphql";

const GraphqlModule = createServerGraphqlModule({
  inject: [ConfigService, AccessTokenService],
  useFactory: (configReader, accessTokens) => ({
    configReader,
    resolvePrincipalFromAuthorization: (authorization) =>
      accessTokens.verifyAuthorization(authorization),
  }),
});
```

Most applications use the higher-level
`createServerAuthAccessTokenGraphqlModule` from
[`server-auth`](../server-auth), which adds Labkit access-token integration.

## Runtime Notes

The default options keep schema exploration available and use `autoSchemaFile:
true`. A production app can override Apollo options through `graphqlOptions`.

Package README and source:
[`../../packages/server-graphql/README.md`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/server-graphql/README.md),
[`../../packages/server-graphql/src/index.ts`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/server-graphql/src/index.ts).
