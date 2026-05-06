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
- `createRelayGraphqlWsConnectionParams`;
- `createRelaySubscribeFunction`;
- `createWebappRelayEnvironment`;
- `createWebappRelayRealtimeClient`;
- `terminateRealtimeClientOnAuthTokenChange`;
- `loadRouteQuery`;
- `appendRootFieldRecordIfMissing`.

## Owns

This package owns the Relay network mechanics: bearer auth headers, one refresh
retry for non-auth operations, websocket subscription integration, auth-token
change socket termination, route preload disposal, and a small store updater.

It can either consume an explicit realtime runtime or create the default Labkit
realtime runtime from websocket options.

## App Still Owns

The app owns endpoint values, generated Relay operation files, route loaders,
auth session implementation, GraphQL schema, and product store update policy.

## Recommended Usage

Pass a `DefaultWebappRealtimeConnection` instance when product UI also monitors
connection state:

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

For a smaller setup, let the Relay helper create the default runtime:

```ts
export function createRelayEnvironment() {
  return createWebappRelayEnvironment({
    httpEndpoint: HTTP_ENDPOINT,
    wsEndpoint: WS_ENDPOINT,
    auth,
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
