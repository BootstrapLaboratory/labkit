# @omgjs/labkit-webapp-realtime

`@omgjs/labkit-webapp-realtime` contains the browser GraphQL WS runtime for
self-healing websocket recovery and observable connection state.

## Owns

- Stable GraphQL WS compatible client facade.
- Default heartbeat, timeout, watchdog, and fatal close-code constants.
- Reconnect watchdog parsing.
- GraphQL WS close-code classification.
- User-facing connection message formatting.
- Inner `graphql-ws` client creation.
- Browser online/offline and resume recovery.
- Active subscription resubscription after internal client recreation.
- Subscription store for connection state.

## Does Not Own

- GraphQL endpoint resolution.
- Access-token storage.
- Relay environment creation.
- Product UI for displaying connection status.
- Server pub/sub behavior.

## Usage

```ts
import {
  DefaultWebappRealtimeConnection,
  parseRealtimeReconnectWatchdogMs,
} from "@omgjs/labkit-webapp-realtime";
import { createRelayGraphqlWsConnectionParams } from "@omgjs/labkit-webapp-graphql-relay";

export const realtime = new DefaultWebappRealtimeConnection({
  wsEndpoint: WS_ENDPOINT,
  connectionParams: () =>
    createRelayGraphqlWsConnectionParams(() => auth.getAccessToken()),
  logReconnects: import.meta.env.VITE_GRAPHQL_LOG_RECONNECTS === "true",
  reconnectWatchdogMs: parseRealtimeReconnectWatchdogMs(
    import.meta.env.VITE_GRAPHQL_RECONNECT_WATCHDOG_MS,
  ),
});

export const realtimeClient = realtime.getClient();
```

Applications usually wrap `subscribeToConnectionState` and
`getConnectionState` with `useSyncExternalStore`, then render their own
connection-status UI.

## Release Channel

This package is published on npm as part of the Labkit release train. Breaking
public API changes are released in a new package version with matching docs.

## Package Format

This package publishes both CommonJS and ESM entry points. Browser bundlers
should use the ESM import entry automatically.
