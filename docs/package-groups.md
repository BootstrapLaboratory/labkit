# Package Groups

Labkit packages are intentionally small. Install only the groups your app uses.

## Shared Packages

| Package                                                      | Runtime            | Owns                                                                                                    |
| ------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------- |
| [`@omgjs/labkit-auth-contract`](packages/auth-contract.md)   | Server and browser | Auth shapes, refresh transport names, bearer helpers, websocket auth params, auth-required error codes. |
| [`@omgjs/labkit-runtime-config`](packages/runtime-config.md) | Server and browser | Primitive parsing for booleans, numbers, finite numbers, and comma-separated lists.                     |

Shared packages publish CommonJS and ESM entry points. Import from the package
root, never from `dist`.

## Server Packages

| Package                                                                  | Runtime      | Owns                                                                                                        |
| ------------------------------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------- |
| [`@omgjs/labkit-server-observability`](packages/server-observability.md) | Node/Nest    | Structured event logs, safe error serialization, verbose runtime log flags.                                 |
| [`@omgjs/labkit-server-config`](packages/server-config.md)               | Node/Nest    | Config readers, env file paths, CORS, cookie SameSite, server host/port/GraphQL path.                       |
| [`@omgjs/labkit-server-database`](packages/server-database.md)           | Node/TypeORM | PostgreSQL options, SSL options, migration safety, database manifest composition.                           |
| [`@omgjs/labkit-server-graphql`](packages/server-graphql.md)             | Nest GraphQL | Apollo/Nest module factory, GraphQL HTTP/WS context, subscription logging, scalar/directive/plugin helpers. |
| [`@omgjs/labkit-server-auth`](packages/server-auth.md)                   | Nest GraphQL | Auth providers, guards, refresh sessions, access-token helpers, transport, lifecycle events.                |
| [`@omgjs/labkit-server-auth-typeorm`](packages/server-auth-typeorm.md)   | Nest TypeORM | Auth entities, migration, repository adapters, transaction runner, Nest provider module.                    |

Server packages publish CommonJS output. They are meant for Node/Nest
applications, not direct browser imports.

## Browser Packages

| Package                                                                    | Runtime                   | Owns                                                                                       |
| -------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| [`@omgjs/labkit-webapp-external-store`](packages/webapp-external-store.md) | Browser/shared UI runtime | Tiny subscription store primitive.                                                         |
| [`@omgjs/labkit-webapp-auth`](packages/webapp-auth.md)                     | Browser                   | Memory auth session, session hint storage, refresh/logout GraphQL API, auth error parsing. |
| [`@omgjs/labkit-webapp-realtime`](packages/webapp-realtime.md)             | Browser                   | GraphQL WS reconnect policy, heartbeat/watchdog handling, connection state store.          |
| [`@omgjs/labkit-webapp-graphql-relay`](packages/webapp-graphql-relay.md)   | Browser/Relay             | Relay environment, auth-aware fetch, subscription integration, route query preloading.     |
| [`@omgjs/labkit-webapp-ui`](packages/webapp-ui.md)                         | Browser UI                | Class name helper, typed theme definitions, persisted theme controller.                    |
| [`@omgjs/labkit-webapp-build-config`](packages/webapp-build-config.md)     | Vite config               | Production env validation and package chunk-group helpers.                                 |

Browser and tooling packages publish CommonJS and ESM entry points. Vite should
choose the ESM import entry automatically.

## Install Sets

Minimal shared install:

```bash
npm install @omgjs/labkit-auth-contract @omgjs/labkit-runtime-config
```

Typical server install:

```bash
npm install \
  @omgjs/labkit-server-config \
  @omgjs/labkit-server-database \
  @omgjs/labkit-server-graphql \
  @omgjs/labkit-server-observability \
  @omgjs/labkit-server-auth \
  @omgjs/labkit-server-auth-typeorm
```

Typical browser install:

```bash
npm install \
  @omgjs/labkit-webapp-auth \
  @omgjs/labkit-webapp-realtime \
  @omgjs/labkit-webapp-graphql-relay \
  @omgjs/labkit-webapp-external-store \
  @omgjs/labkit-webapp-ui \
  @omgjs/labkit-webapp-build-config \
  react-relay@20.1.1 \
  relay-runtime@20.1.1

npm install --save-dev \
  relay-compiler@20.1.1 \
  @types/react-relay@18.2.1 \
  @types/relay-runtime@20.1.1
```

Nest, React, Relay, TypeORM, Vite, and GraphQL remain application-owned
framework dependencies. The Relay package currently supports the exact,
consumer-installed `react-relay@20.1.1` and `relay-runtime@20.1.1` pair. Keep
the development-time Relay compiler aligned with that runtime; see the
[Relay package reference](packages/webapp-graphql-relay.md#required-relay-peers)
for the complete peer and migration contract.
