# Architecture

Labkit is organized around process boundaries, not around convenience imports.
The server, browser, and shared packages each have different runtime rules.

```text
shared contracts
  auth shapes, runtime parsing
        |
        +--------------------+
        |                    |
server packages       browser packages
  Nest, TypeORM,        Relay, auth state,
  GraphQL, auth         realtime, theme
        |                    |
        +--------- app-owned GraphQL contract ---------+
```

The consuming application owns the product. Labkit owns the reusable runtime
constraints that make the product safe to build.

## Server Boundary

The server owns the executable GraphQL schema, resolvers, server-side auth
state, persistence, migrations, and runtime configuration. Labkit helps the
server keep those decisions consistent:

- `@omgjs/labkit-server-config` reads generic runtime options from a config
  reader such as Nest `ConfigService`.
- `@omgjs/labkit-server-graphql` builds a Nest Apollo module with HTTP and
  websocket context handling.
- `@omgjs/labkit-server-auth` provides guards, identity provider contracts,
  access-token helpers, refresh-session orchestration, and refresh-token
  transport helpers.
- `@omgjs/labkit-server-auth-typeorm` supplies TypeORM entities, migrations,
  and repository adapters for the server-auth persistence interfaces.
- `@omgjs/labkit-server-database` composes feature manifests and checks
  migration flags before the app starts.

The app still owns GraphQL DTO classes, resolver names, password hashing,
access-token signing, environment variable values, feature entities, migration
execution timing, and lifecycle side effects.

## Browser Boundary

The browser owns routing, generated Relay operations, visual composition, and
user-facing behavior. Labkit helps the browser wire the runtime:

- `@omgjs/labkit-webapp-auth` stores access tokens in memory, stores only a
  non-secret session hint, refreshes sessions, and logs out locally even when a
  stale refresh token fails server-side.
- `@omgjs/labkit-webapp-graphql-relay` creates an auth-aware Relay environment,
  retries one non-auth GraphQL operation after refresh, wires GraphQL
  subscriptions, and disposes route preloads when navigation aborts.
- `@omgjs/labkit-webapp-realtime` tracks websocket connection status,
  reconnects, heartbeat timeouts, browser online/offline state, and fatal close
  codes.
- `@omgjs/labkit-webapp-ui` owns small UI mechanics such as theme selection and
  class application, while concrete components remain app-owned.

The app still owns routes, generated operation files, endpoint resolution,
React hooks, form components, token storage policy selection, CSS classes,
theme values, and product UI.

## Shared Boundary

Shared packages are safe in both server and browser runtimes. They must not
import Nest, TypeORM, React, Relay, Vite, or browser-only globals.

The most important shared boundary is auth. `Principal`, `AuthPayload`,
refresh-token transport names, bearer token helpers, GraphQL websocket auth
parameter names, and auth-required error codes all live in
`@omgjs/labkit-auth-contract` so server and browser code speak the same
protocol.

## Dependency Direction

Shared packages sit at the bottom. Server packages can depend on shared
packages and server frameworks. Browser packages can depend on shared packages
and browser frameworks. Server and browser packages do not depend on each
other.

Applications can import any Labkit package that belongs in their runtime.
Labkit packages must not import application code.

## Versioned Contracts

The GraphQL schema is the runtime contract between server and browser. The
server generates the schema. The browser consumes it through Relay. TypeScript
DTO classes are not the boundary because they cannot describe a running
GraphQL process, authorization behavior, or websocket connection context.

See [GraphQL Contract](graphql-contract.md) for the contract workflow.
