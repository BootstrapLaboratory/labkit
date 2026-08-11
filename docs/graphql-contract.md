# GraphQL Contract

GraphQL is the process contract between the Labkit-style server and browser.
The server owns the schema. The browser consumes the schema through Relay.

## Why Not Share DTO Types

TypeScript DTO classes are useful inside a Nest server, but they are not the
client/server boundary:

- they do not describe the running GraphQL endpoint;
- they do not include authorization behavior;
- they cannot represent websocket connection context;
- they cannot replace Relay's operation-specific generated types;
- they encourage browser code to depend on server implementation files.

The durable contract is the generated GraphQL schema plus browser-owned
operations.

## Server Responsibilities

The server should:

- define object, input, mutation, query, and subscription types;
- generate the GraphQL schema from the Nest app;
- expose the same HTTP path and websocket path the browser is configured to use;
- attach `principal` to HTTP and websocket GraphQL contexts;
- keep auth-required errors recognizable by code or status;
- publish or commit the generated schema where Relay can consume it.

`@omgjs/labkit-server-graphql` helps build the Nest/Apollo module and context.
`@omgjs/labkit-server-auth` layers access-token verification onto that context.

## Browser Responsibilities

The browser should:

- define Relay operations near routes/features;
- generate Relay artifacts from the server schema;
- create one `DefaultWebappRelayRuntime` with auth-aware HTTP fetch,
  auth-aware websocket reconnects, and websocket subscription support;
- preload route queries through route loaders, give mounted query references an
  explicit route-query lifetime, and dispose them after their final owner;
- update Relay store records explicitly for mutations/subscriptions when needed.

`@omgjs/labkit-webapp-graphql-relay` owns the reusable network behavior, but
the app owns operation files and route loaders.

## Route Query Ownership

Network completion is not a release event for a Relay preloaded query
reference. A router loader/preload and its mounted React consumer are separate
owners: replacement navigation can retire the loader invocation while React
still presents the previous route.

For mounted route queries, the loader creates one
`createRouteQueryLifetime(...)`, passes that lifetime to every
`loadRouteQuery(...)` call in that loader, and returns the lifetime with the
references. The route component calls `useRouteQueryLifetime(...)` before
consuming those references. A route abort releases loader ownership; the final
mounted release performs disposal. Partial multi-query construction calls
terminal `abort(error)` before rethrowing.

The `loadRouteQuery` ownership inputs are exclusive. `lifetime` is the safe
path for mounted route queries. The deprecated raw `abortSignal` input remains
only for abort-scoped work guaranteed never to become a mounted React
resource. The lifetime's child signal remains available when the application
must compose other abort-aware resources into the same ownership domain.

The app continues to own route structure, generated operations, cache and
freshness settings, pending/error UI, history, and retry. Labkit owns the
router-independent lifetime accounting and idempotent terminal abort. See the
[3.1 upgrade guide](upgrades/webapp-graphql-relay-3.1.md) for the validated
TanStack policy and migration examples.

## Minimal Flow

```text
server DTOs/resolvers
  -> generated GraphQL schema
  -> committed or published schema contract
  -> Relay compiler
  -> browser generated operations
  -> Relay environment runtime
```

The original application keeps this flow visible through its server schema
generation script and webapp Relay operation files.
