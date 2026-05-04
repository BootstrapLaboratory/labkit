# @omgjs/labkit-webapp-graphql-relay

`@omgjs/labkit-webapp-graphql-relay` contains Relay runtime helpers for auth-aware
GraphQL HTTP requests, GraphQL WS subscriptions, route preloading, and Relay
store maintenance.

## Owns

- Relay environment factory.
- Auth-aware Relay fetch with one refresh retry for non-auth operations.
- GraphQL WS connection-params creation.
- Relay subscribe function integration.
- Realtime client termination after auth-token changes.
- Route query preload with abort disposal.
- Root-field store updater helper.
- Unauthorized GraphQL response helper.

## Does Not Own

- Vite endpoint environment variables.
- Generated Relay operation types.
- Product route files.
- Product auth session implementation.
- GraphQL server schema.

## Usage

```ts
import { createWebappRelayEnvironment } from "@omgjs/labkit-webapp-graphql-relay";

export function createRelayEnvironment() {
  return createWebappRelayEnvironment({
    httpEndpoint: HTTP_ENDPOINT,
    wsEndpoint: WS_ENDPOINT,
    auth,
    realtime,
  });
}
```

For TanStack Router loaders:

```ts
import { loadRouteQuery } from "@omgjs/labkit-webapp-graphql-relay";

loader: ({ abortController, context }) => ({
  queryRef: loadRouteQuery({
    abortSignal: abortController.signal,
    environment: context.relayEnvironment,
    query: ChatPageQuery,
    variables: {},
  }),
});
```

Endpoint resolution intentionally remains app-owned until another browser app
needs the same Vite URL policy.

## Package Format

This package publishes both CommonJS and ESM entry points. Browser bundlers
should use the ESM import entry automatically.
