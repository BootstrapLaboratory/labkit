# Realtime

Create one realtime runtime and reuse it for Relay plus product UI.

## `webapp/src/shared/realtime/realtime-connection.ts`

```ts
import { useSyncExternalStore } from "react";
import {
  DefaultWebappRealtimeConnection,
  parseRealtimeReconnectWatchdogMs,
  type RealtimeConnectionState,
} from "@omgjs/labkit-webapp-realtime";
import { createRelayGraphqlWsConnectionParams } from "@omgjs/labkit-webapp-graphql-relay";
import { WS_ENDPOINT } from "../graphql/endpoints";
import { getAccessToken } from "../auth/session";

export {
  getRealtimeConnectionMessage,
  type RealtimeConnectionState,
  type RealtimeConnectionStatus,
} from "@omgjs/labkit-webapp-realtime";

export const realtimeConnection = new DefaultWebappRealtimeConnection({
  wsEndpoint: WS_ENDPOINT,
  connectionParams: () =>
    createRelayGraphqlWsConnectionParams(() => getAccessToken()),
  logReconnects: import.meta.env.VITE_GRAPHQL_LOG_RECONNECTS === "true",
  reconnectWatchdogMs: parseRealtimeReconnectWatchdogMs(
    import.meta.env.VITE_GRAPHQL_RECONNECT_WATCHDOG_MS,
  ),
});

export const realtimeClient = realtimeConnection.getClient();

export function useRealtimeConnectionState(): RealtimeConnectionState {
  return useSyncExternalStore(
    (listener) => realtimeConnection.subscribeToConnectionState(listener),
    () => realtimeConnection.getConnectionState(),
    () => realtimeConnection.getConnectionState(),
  );
}
```

## Status Component

```tsx
import {
  getRealtimeConnectionMessage,
  useRealtimeConnectionState,
} from "./shared/realtime/realtime-connection";

export function RealtimeStatus() {
  const state = useRealtimeConnectionState();
  const message = getRealtimeConnectionMessage(state);

  return message ? <p>{message}</p> : null;
}
```

The app displays state. Labkit owns websocket recovery: heartbeat timeout,
watchdog escalation, browser online/resume handling, internal client
recreation, and active subscription resubscription.

For multi-instance servers, replace in-memory pub/sub with a shared backend
such as Redis.
