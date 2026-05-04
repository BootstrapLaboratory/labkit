# Labkit

Labkit is the project-local application framework extracted from the server
and webapp. It is a set of small Rush packages under `packages/*`, not one
large shared library.

Each child folder is its own package with its own dependency boundary, build,
tests, and public API. Applications compose the packages they need.

## Package Map

| Package                                                            | Runtime | Purpose                                                                                                                |
| ------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`@labkit/auth-contract`](packages/auth-contract/README.md)                 | Shared  | Auth shapes and protocol constants that are safe for server and browser code.                                          |
| [`@labkit/runtime-config`](packages/runtime-config/README.md)               | Shared  | Small parsing helpers for environment and runtime configuration values.                                                |
| [`@labkit/server-observability`](packages/server-observability/README.md)   | Server  | Structured logging helpers and safe error serialization.                                                               |
| [`@labkit/server-config`](packages/server-config/README.md)                 | Server  | Config-reader helpers, env-file selection, CORS, runtime, and auth transport config.                                   |
| [`@labkit/server-database`](packages/server-database/README.md)             | Server  | PostgreSQL and TypeORM option helpers, migration safety, and database manifests.                                       |
| [`@labkit/server-graphql`](packages/server-graphql/README.md)               | Server  | Nest GraphQL module setup, HTTP/WS context helpers, scalars, directives, and plugins.                                  |
| [`@labkit/server-auth`](packages/server-auth/README.md)                     | Server  | Auth providers, guards, lifecycle events, access-token helpers, refresh-session orchestration, and transport services. |
| [`@labkit/server-auth-typeorm`](packages/server-auth-typeorm/README.md)     | Server  | TypeORM/PostgreSQL adapter for Labkit server auth persistence.                                                         |
| [`@labkit/webapp-external-store`](packages/webapp-external-store/README.md) | Browser | Tiny subscription store primitive used by browser runtimes.                                                            |
| [`@labkit/webapp-auth`](packages/webapp-auth/README.md)                     | Browser | Memory access-token session runtime, refresh/logout API helpers, auth errors, and boot orchestration.                  |
| [`@labkit/webapp-realtime`](packages/webapp-realtime/README.md)             | Browser | GraphQL WS reconnect policy, heartbeat/watchdog handling, and connection state.                                        |
| [`@labkit/webapp-graphql-relay`](packages/webapp-graphql-relay/README.md)   | Browser | Relay environment, auth-aware fetch, subscription integration, route preloading, and store helpers.                    |
| [`@labkit/webapp-ui`](packages/webapp-ui/README.md)                         | Browser | UI framework helpers and contracts; concrete product components stay app-owned.                                        |
| [`@labkit/webapp-build-config`](packages/webapp-build-config/README.md)     | Tooling | Vite build helpers for production env validation and package chunk grouping.                                           |

## Dependency Direction

Shared packages sit at the bottom:

```text
@labkit/runtime-config
@labkit/auth-contract
        ^
        |
        +-------------------+
        |                   |
@labkit/server-*      @labkit/webapp-*
        |                   |
apps/server           apps/webapp
```

Rules:

- Shared packages must not depend on NestJS, TypeORM, React, Relay, Vite, or
  browser-only globals.
- Server packages may depend on shared packages and server frameworks.
- Browser packages may depend on shared packages and browser/webapp frameworks.
- Server packages must not depend on browser packages.
- Browser packages must not depend on server packages.
- App packages may depend on Labkit packages; Labkit packages must not import
  from app packages.

## Server Composition

A server app usually composes the packages in layers:

```ts
import { createServerAuthAccessTokenGraphqlModule } from "@labkit/server-auth";
import { getEnvFilePaths } from "@labkit/server-config";
import { composeServerDatabaseManifests } from "@labkit/server-database";
import { serverAuthTypeormDatabaseManifest } from "@labkit/server-auth-typeorm";
```

Typical ownership:

- Labkit owns reusable policy and adapters: GraphQL context rules, access
  guards, refresh-token transport, session rotation, config parsing, database
  safety checks, and TypeORM auth repositories.
- The app owns product API shape: GraphQL DTOs/resolvers, concrete JWT signing
  configuration, password hashing implementation, environment variable names,
  migrations execution, and lifecycle side effects such as notifications or
  audit logging.

## Webapp Composition

A webapp usually keeps app-local adapter files that supply product choices to
Labkit helpers:

```ts
import { createWebappAuthSession } from "@labkit/webapp-auth";
import { createWebappRelayEnvironment } from "@labkit/webapp-graphql-relay";
import { createWebappRealtimeConnection } from "@labkit/webapp-realtime";
import { createWebappThemeController } from "@labkit/webapp-ui";
```

Typical ownership:

- Labkit owns reusable browser runtime policy: memory access tokens, non-secret
  session hints, refresh/logout GraphQL API wrappers, auth-aware Relay retry,
  GraphQL WS reconnect behavior, route query disposal, external store mechanics,
  and theme controller mechanics.
- The app owns endpoints, generated Relay operations, route files, React hooks,
  storage keys, concrete themes, CSS classes, UI components, and visual design.

## Package Format

Browser-consumed and shared packages publish dual CommonJS/ESM entry points:

- `exports.import` points to `dist/esm/src/index.js`.
- `exports.require` points to `dist/src/index.js`.
- `dist/esm/package.json` marks the ESM output as `"type": "module"`.

Server-only packages currently publish CommonJS output only. That keeps NestJS
and TypeORM consumption simple while browser-facing packages remain bundler
friendly.

## CI And Release

Pull requests run direct Rush validation in
`.github/workflows/pr-validate.yaml`:

- `rush install`
- `rush change --verify`
- `rush build`
- `rush lint`
- `rush test`
- `rush verify`

Package release is configured in `.github/workflows/package-release.yaml`.
It uses `BootstrapLaboratory/rush-delivery@v0.6.0` with the
`release-packages` entrypoint, `.dagger/release/npm.yaml`, and
`common/config/rush/.npmrc-publish`.

The release workflow is intentionally gated until Rush Delivery supports
package-only repositories without fake deploy metadata. Track that support in
BootstrapLaboratory/rush-delivery#1. To enable live publishing after that
support lands:

1. Add the GitHub Actions secret `NPM_TOKEN`.
2. Add the GitHub Actions repository variable
   `RUSH_DELIVERY_PACKAGE_RELEASE_ENABLED=true`.
3. Keep `toolchain-image-provider` and `rush-cache-provider` set to `off`
   unless provider metadata is added intentionally.

The first live release is expected to consume the committed Rush change files
and publish the public Labkit packages as `0.1.0`. `@labkit/eslint-config`
stays private repository tooling.

## Documentation Policy

Every Labkit package must have a package README that explains:

- what constraint the package owns;
- what the application still owns;
- the main public API;
- at least one typical usage shape;
- runtime/package-format expectations.

Do not create package-local `docs/` folders until a README becomes too large or
the package needs separate recipes, migration notes, or provider-specific
guides.
