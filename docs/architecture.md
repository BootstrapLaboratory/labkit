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

## Framework Direction

Labkit is not only a bag of helper packages. It is moving toward a cohesive
GraphQL application framework for TypeScript client/server systems.

The useful comparison is Spring in the Java world: not as an API to copy, but
as a model for giving application teams a stable foundation, strong defaults,
and clear extension points. NestJS, Relay, GraphQL, and TypeScript already
provide powerful building blocks, but they remain technical and low-level.
Labkit's job is to make recurring application architecture reusable and more
declarative.

That direction matters when designing APIs. Labkit should hide reusable system
mechanics behind production defaults, expose state and hooks where products
need visibility, and keep enough interfaces available that advanced teams can
replace one policy without leaving the framework path.

## Runtime Philosophy

Labkit APIs are designed in two layers:

- production defaults that work for normal applications without exposing every
  transport, auth, or lifecycle edge case;
- explicit extension interfaces for teams that need to replace one policy
  without forking the whole runtime.

Applications should decide product behavior, endpoint values, route structure,
GraphQL operations, UI placement, and visual tone. Labkit should absorb
reusable system mechanics such as auth-session storage discipline, GraphQL
transport recovery, websocket heartbeat/watchdog policy, route preload cleanup,
and shared browser/server protocol constants.

Defaults should still be observable. For example, the realtime browser runtime
owns websocket recovery, but exposes connection state so product UI and logs can
show what is happening.

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
  subscriptions, and coordinates route-query ownership across loader abort and
  mounted React consumers before disposal.
- `@omgjs/labkit-webapp-realtime` provides a self-healing websocket runtime
  with a stable GraphQL WS client facade, connection-state monitoring,
  heartbeat/watchdog policy, browser online/resume recovery, fatal close-code
  handling, and active subscription resubscription after internal client
  recreation.
- `@omgjs/labkit-webapp-ui` owns small UI mechanics such as theme selection and
  class application, while concrete components remain app-owned.

The app still owns routes, generated operation files, endpoint resolution,
product React hooks, form components, token storage policy selection, CSS
classes, theme values, and product UI. Browser packages may expose focused
framework hooks when a reusable runtime resource needs framework lifecycle
integration; those hooks must remain independent of app route definitions and
product behavior.

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
