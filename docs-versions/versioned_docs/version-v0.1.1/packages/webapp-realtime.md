---
title: "Webapp Realtime"
sidebar_label: "Webapp Realtime"
---

Browser GraphQL websocket reconnect policy and connection state.

## Install

```bash
npm install @omgjs/labkit-webapp-realtime
```

Runtime: browser. Package format: CommonJS and ESM.

## Public API Groups

- connection status and state types;
- default heartbeat, timeout, watchdog, and fatal close-code constants;
- close-code classification and error/message helpers;
- `parseRealtimeReconnectWatchdogMs`;
- `createWebappRealtimeConnection`.

## Owns

This package owns websocket client creation with connection-state tracking,
heartbeat timeout handling, reconnect watchdog behavior, browser online/offline
tracking, and user-facing connection messages.

## App Still Owns

The app owns endpoint resolution, access-token storage, Relay environment
creation, product UI, and server pub/sub behavior.

## Minimal Usage

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

## Runtime Notes

Use `getRealtimeConnectionMessage` for a first UI message, but keep rendering
app-owned so the product can decide tone and placement.

Package README and source:
[`../../packages/webapp-realtime/README.md`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/webapp-realtime/README.md),
[`../../packages/webapp-realtime/src/index.ts`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/webapp-realtime/src/index.ts).
