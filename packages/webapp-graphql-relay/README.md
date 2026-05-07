# @omgjs/labkit-webapp-graphql-relay

`@omgjs/labkit-webapp-graphql-relay` contains Relay runtime helpers for
auth-aware GraphQL HTTP requests, GraphQL WS subscriptions, route preloading,
and Relay store maintenance.

## Owns

- Relay environment factory.
- Auth-aware Relay fetch with one refresh retry for non-auth operations.
- Auth-aware GraphQL WS connection-params creation.
- Default Relay runtime that composes Relay, auth, and realtime recovery.
- Relay subscribe function integration.
- Default realtime runtime creation when only websocket options are provided.
- Realtime client termination after auth-token changes.
- Realtime connection-state access for UI.
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

Use `DefaultWebappRelayRuntime` for the normal production path. It creates the
Relay environment and realtime runtime together, refreshes expiring auth before
websocket reconnects, and exposes the same realtime state that product UI can
display.

```ts
import {
  DefaultWebappRelayRuntime,
} from "@omgjs/labkit-webapp-graphql-relay";

export const relayRuntime = new DefaultWebappRelayRuntime({
  httpEndpoint: HTTP_ENDPOINT,
  wsEndpoint: WS_ENDPOINT,
  auth,
});

export function createRelayEnvironment() {
  return relayRuntime.getEnvironment();
}

export const realtime = relayRuntime.getRealtime();
export const getRealtimeConnectionState =
  relayRuntime.getRealtimeConnectionState;
export const subscribeToRealtimeConnectionState =
  relayRuntime.subscribeToRealtimeConnectionState;
```

The auth adapter must include `getAuthSession()` so Labkit can refresh an
expiring access token before websocket reconnects.

Advanced applications can still provide their own realtime adapter to
`createWebappRelayEnvironment` or use
`createAuthAwareRelayGraphqlWsConnectionParams` directly when replacing only one
runtime policy.

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
