# Realtime

Reuse the realtime runtime created by `DefaultWebappRelayRuntime` for product
UI.

## `webapp/src/shared/realtime/realtime-connection.ts`

```ts
import { useSyncExternalStore } from "react";
import { type RealtimeConnectionState } from "@omgjs/labkit-webapp-realtime";
import { relayRuntime } from "../relay/environment";

export {
  getRealtimeConnectionMessage,
  type RealtimeConnectionState,
  type RealtimeConnectionStatus,
} from "@omgjs/labkit-webapp-realtime";

export const realtimeConnection = relayRuntime.getRealtime();

export const realtimeClient = realtimeConnection.getClient();

export function useRealtimeConnectionState(): RealtimeConnectionState {
  return useSyncExternalStore(
    relayRuntime.subscribeToRealtimeConnectionState,
    relayRuntime.getRealtimeConnectionState,
    relayRuntime.getRealtimeConnectionState,
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
