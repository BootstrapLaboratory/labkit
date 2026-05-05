# @omgjs/labkit-webapp-realtime

`@omgjs/labkit-webapp-realtime` contains browser GraphQL WS connection policy and
connection-state helpers.

## Owns

- GraphQL WS connection status and state types.
- Default heartbeat, timeout, watchdog, and fatal close-code constants.
- Reconnect watchdog parsing.
- GraphQL WS close-code classification.
- User-facing connection message formatting.
- GraphQL WS client creation with connection-state tracking.
- Browser online/offline integration.
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
  createWebappRealtimeConnection,
  parseRealtimeReconnectWatchdogMs,
} from "@omgjs/labkit-webapp-realtime";

const realtime = createWebappRealtimeConnection({
  logReconnects: import.meta.env.VITE_GRAPHQL_LOG_RECONNECTS === "true",
  reconnectWatchdogMs: parseRealtimeReconnectWatchdogMs(
    import.meta.env.VITE_GRAPHQL_RECONNECT_WATCHDOG_MS,
  ),
});

export const createRealtimeGraphqlWsClient =
  realtime.createRealtimeGraphqlWsClient;
```

Applications usually wrap the state subscription with `useSyncExternalStore`
and render their own connection-status UI.

## Release Channel

This package is published on npm as part of the Labkit release train. Patch
releases may include documentation-only clarifications, so consumers can update
within the same minor line without expecting runtime API changes.

## Package Format

This package publishes both CommonJS and ESM entry points. Browser bundlers
should use the ESM import entry automatically.
