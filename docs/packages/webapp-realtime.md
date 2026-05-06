# @omgjs/labkit-webapp-realtime

Browser GraphQL websocket runtime with self-healing recovery and observable
connection state.

## Install

```bash
npm install @omgjs/labkit-webapp-realtime
```

Runtime: browser. Package format: CommonJS and ESM.

## Public API Groups

- `DefaultWebappRealtimeConnection`;
- `createDefaultWebappRealtimeConnection`;
- connection status, state, recovery reason, and policy types;
- heartbeat, timeout, watchdog, and fatal close-code constants;
- close-code classification and error/message helpers;
- `parseRealtimeReconnectWatchdogMs`.

## Owns

This package owns the browser websocket runtime:

- stable GraphQL WS compatible client facade;
- inner `graphql-ws` client creation;
- heartbeat timeout handling;
- reconnect watchdog escalation;
- browser online/offline and resume recovery;
- fatal close-code handling;
- active subscription resubscription after internal client recreation;
- connection-state storage and user-facing connection messages.

## App Still Owns

The app owns endpoint values, access-token storage policy, product UI,
generated GraphQL operations, and server pub/sub behavior.

## Minimal Usage

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

For product UI:

```ts
import { useSyncExternalStore } from "react";
import {
  getRealtimeConnectionMessage,
  type RealtimeConnectionState,
} from "@omgjs/labkit-webapp-realtime";
import { realtime } from "./realtime";

export function useRealtimeConnectionState(): RealtimeConnectionState {
  return useSyncExternalStore(
    (listener) => realtime.subscribeToConnectionState(listener),
    () => realtime.getConnectionState(),
    () => realtime.getConnectionState(),
  );
}

export function useRealtimeConnectionMessage(): string | null {
  return getRealtimeConnectionMessage(useRealtimeConnectionState());
}
```

## Extension Points

Most applications should use defaults. Advanced applications can replace:

- the GraphQL WS transport factory;
- retry and fatal close-code policy;
- heartbeat and ack timeout policy;
- browser lifecycle adapter;
- logger.

The concrete self-healing facade is intentionally internal. Public code should
hold the default connection instance and its `getClient()` result.

Package README and source:
[`../../packages/webapp-realtime/README.md`](../../packages/webapp-realtime/README.md),
[`../../packages/webapp-realtime/src/index.ts`](../../packages/webapp-realtime/src/index.ts).
