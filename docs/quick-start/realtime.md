# Realtime

Add the realtime adapter and a tiny connection-status hook.

## `webapp/src/shared/realtime/realtime-connection.ts`

```ts
import { useSyncExternalStore } from "react";
import type { Client } from "graphql-ws";
import {
  createWebappRealtimeConnection,
  parseRealtimeReconnectWatchdogMs,
  type GraphqlWsConnectionParamsFactory,
  type GraphqlWsConnectionState,
} from "@omgjs/labkit-webapp-realtime";

export {
  getRealtimeConnectionMessage,
  type GraphqlWsConnectionState,
  type GraphqlWsConnectionStatus,
} from "@omgjs/labkit-webapp-realtime";

const realtimeConnection = createWebappRealtimeConnection({
  logReconnects: import.meta.env.VITE_GRAPHQL_LOG_RECONNECTS === "true",
  reconnectWatchdogMs: parseRealtimeReconnectWatchdogMs(
    import.meta.env.VITE_GRAPHQL_RECONNECT_WATCHDOG_MS,
  ),
});

export function createRealtimeGraphqlWsClient(
  url: string,
  connectionParams?: GraphqlWsConnectionParamsFactory,
): Client {
  return realtimeConnection.createRealtimeGraphqlWsClient(
    url,
    connectionParams,
  );
}

export const subscribeToRealtimeConnectionState =
  realtimeConnection.subscribeToRealtimeConnectionState;
export const getRealtimeConnectionState =
  realtimeConnection.getRealtimeConnectionState;

export function useRealtimeConnectionState(): GraphqlWsConnectionState {
  return useSyncExternalStore(
    subscribeToRealtimeConnectionState,
    getRealtimeConnectionState,
    getRealtimeConnectionState,
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

When `createWebappRelayEnvironment` creates the websocket client, Labkit wires
connection params from the current access token and terminates the client when
the token changes.

For multi-instance servers, replace in-memory pub/sub with a shared backend
such as Redis.
