# @omgjs/labkit-webapp-graphql-relay

Relay runtime helpers for auth-aware GraphQL HTTP requests, subscriptions, and
route query loading.

## Install

```bash
npm install @omgjs/labkit-webapp-graphql-relay
```

Runtime: browser/Relay. Package format: CommonJS and ESM.

## Public API Groups

- auth and realtime adapter types;
- `createAuthAwareRelayFetchFunction`;
- `createAuthAwareRelayGraphqlWsConnectionParams`;
- `createRelayGraphqlWsConnectionParams`;
- `createRelaySubscribeFunction`;
- `DefaultWebappRelayRuntime`;
- `createWebappRelayEnvironment`;
- `createWebappRelayRealtimeClient`;
- `terminateRealtimeClientOnAuthTokenChange`;
- `loadRouteQuery`;
- `appendRootFieldRecordIfMissing`.

## Owns

This package owns the Relay network mechanics: bearer auth headers, one refresh
retry for non-auth operations, auth-aware websocket connection params,
websocket subscription integration, auth-token change socket termination, route
preload disposal, and a small store updater.

The recommended default is `DefaultWebappRelayRuntime`, which composes the Relay
environment and Labkit realtime runtime so websocket recovery can refresh auth
before reconnecting and product UI can monitor the same runtime.

## App Still Owns

The app owns endpoint values, generated Relay operation files, route loaders,
auth session implementation, GraphQL schema, and product store update policy.

## Recommended Usage

Use one runtime for Relay and realtime state:

```ts
import { DefaultWebappRelayRuntime } from "@omgjs/labkit-webapp-graphql-relay";

export const relayRuntime = new DefaultWebappRelayRuntime({
  httpEndpoint: HTTP_ENDPOINT,
  wsEndpoint: WS_ENDPOINT,
  auth,
});

export function createRelayEnvironment() {
  return relayRuntime.getEnvironment();
}

export function subscribeToRealtimeConnectionState(listener) {
  return relayRuntime.subscribeToRealtimeConnectionState(listener);
}
```

The auth adapter must provide `getAuthSession()` in addition to access-token
reads, auth-state subscription, refresh, credentials, and GraphQL auth-error
detection. Labkit uses the session expiry to refresh before websocket reconnects
instead of reconnecting with a stale bearer token.

For lower-level composition, pass an explicit realtime adapter:

```ts
import { DefaultWebappRealtimeConnection } from "@omgjs/labkit-webapp-realtime";
import {
  createAuthAwareRelayGraphqlWsConnectionParams,
  createWebappRelayEnvironment,
} from "@omgjs/labkit-webapp-graphql-relay";

const realtime = new DefaultWebappRealtimeConnection({
  wsEndpoint: WS_ENDPOINT,
  connectionParams: createAuthAwareRelayGraphqlWsConnectionParams({ auth }),
});

export function createRelayEnvironment() {
  return createWebappRelayEnvironment({
    httpEndpoint: HTTP_ENDPOINT,
    auth,
    realtime,
  });
}
```

## Runtime Notes

The default auth operation names are `LoginMutation`, `RegisterMutation`,
`RefreshMutation`, and `LogoutMutation`. Override `authOperationNames` if your
generated operation names differ.

Package README and source:
[`../../packages/webapp-graphql-relay/README.md`](../../packages/webapp-graphql-relay/README.md),
[`../../packages/webapp-graphql-relay/src/index.ts`](../../packages/webapp-graphql-relay/src/index.ts).
