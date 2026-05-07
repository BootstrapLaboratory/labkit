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
- preload route queries through route loaders and dispose aborted preloads;
- update Relay store records explicitly for mutations/subscriptions when needed.

`@omgjs/labkit-webapp-graphql-relay` owns the reusable network behavior, but
the app owns operation files and route loaders.

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
