---
title: "Realtime Subscriptions"
sidebar_label: "Realtime Subscriptions"
---

Realtime starts with a simple rule: websocket auth is connection-scoped.

When the access token changes, terminate the websocket client. The next
connection will send fresh connection params.

## Browser Flow

1. Relay environment creates a websocket client through the realtime adapter.
2. Connection params read the current memory access token.
3. Relay uses the websocket client for subscriptions.
4. Auth-state subscription terminates the client when the token changes.
5. The realtime package tracks reconnect state and browser online/offline
   state.

## Server Flow

1. `graphql-ws` connection params carry bearer auth.
2. Server GraphQL helpers extract auth from params.
3. Server auth verifies the access token.
4. The principal is stored in websocket `extra`.
5. Subscription resolvers use the context principal.

For multiple server instances, add shared pub/sub such as Redis. Labkit does
not hide that scaling decision because it affects your runtime architecture.
