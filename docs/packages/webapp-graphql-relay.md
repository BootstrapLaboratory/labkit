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
- `terminateRealtimeClientOnAuthTokenChange`;
- `loadRouteQuery`;
- `appendRootFieldRecordIfMissing`.

## Owns

This package owns the Relay network mechanics: bearer auth headers, one refresh
retry for non-auth operations, websocket subscription integration, auth-token
change socket termination, route preload disposal, and a small store updater.

## App Still Owns

The app owns endpoint values, generated Relay operation files, route loaders,
auth session implementation, realtime connection adapter, GraphQL schema, and
product store update policy.

## Minimal Usage

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

## Runtime Notes

The default auth operation names are `LoginMutation`, `RegisterMutation`,
`RefreshMutation`, and `LogoutMutation`. Override `authOperationNames` if your
generated operation names differ.

Package README and source:
[`../../packages/webapp-graphql-relay/README.md`](../../packages/webapp-graphql-relay/README.md),
[`../../packages/webapp-graphql-relay/src/index.ts`](../../packages/webapp-graphql-relay/src/index.ts).
