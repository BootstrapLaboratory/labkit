# @omgjs/labkit-webapp-graphql-relay

`@omgjs/labkit-webapp-graphql-relay` contains Relay runtime helpers for
auth-aware GraphQL HTTP requests, GraphQL WS subscriptions, route preloading,
and Relay store maintenance.

## Owns

- Relay environment factory.
- Auth-aware Relay fetch with one refresh retry for non-auth operations.
- GraphQL WS connection-params creation.
- Relay subscribe function integration.
- Default realtime runtime creation when only websocket options are provided.
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

Pass an explicit realtime instance when product UI should monitor the same
runtime Relay uses:

```ts
import { DefaultWebappRealtimeConnection } from "@omgjs/labkit-webapp-realtime";
import {
  createRelayGraphqlWsConnectionParams,
  createWebappRelayEnvironment,
} from "@omgjs/labkit-webapp-graphql-relay";

export const realtime = new DefaultWebappRealtimeConnection({
  wsEndpoint: WS_ENDPOINT,
  connectionParams: () =>
    createRelayGraphqlWsConnectionParams(() => auth.getAccessToken()),
});

export function createRelayEnvironment() {
  return createWebappRelayEnvironment({
    httpEndpoint: HTTP_ENDPOINT,
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

## Release Channel

This package is published on npm as part of the Labkit release train. Breaking
public API changes are released in a new package version with matching docs.

## Package Format

This package publishes both CommonJS and ESM entry points. Browser bundlers
should use the ESM import entry automatically.
