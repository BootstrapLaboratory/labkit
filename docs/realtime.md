# Realtime

Labkit realtime support is centered on GraphQL subscriptions over
`graphql-ws`, with browser recovery handled by
`@omgjs/labkit-webapp-realtime`.

The important constraint is that websocket auth is established when the socket
connects. A token update in memory does not change the already-open connection.
The client must reconnect.

## Server Responsibilities

`@omgjs/labkit-server-graphql` builds GraphQL websocket configuration for the
Nest Apollo module:

- reads websocket authorization from connection params;
- stores a connection id and principal in websocket `extra`;
- reuses the same principal shape as HTTP GraphQL context;
- logs connect, disconnect, and subscribe events when subscription logging is
  enabled.

`@omgjs/labkit-server-auth` can create a GraphQL module that verifies bearer
access tokens and maps them into Labkit principals.

The app still owns pub/sub implementation. For one server process, in-memory
pub/sub can be enough. For multiple server instances, use a shared backend such
as Redis so events published by one instance can reach subscriptions connected
to another instance.

## Browser Runtime

`DefaultWebappRealtimeConnection` is the recommended browser runtime. It owns
the low-level websocket lifecycle and exposes a stable GraphQL WS compatible
client through `getClient()`.

Relay and application code keep the same outer client object. Internally Labkit
can replace the concrete `graphql-ws` client when terminate-only recovery is not
enough, then resubscribe active operations.

The default runtime handles:

- connection states: `idle`, `connecting`, `connected`, `retrying`,
  `disconnected`;
- heartbeat interval and timeout;
- reconnect watchdog escalation from `terminate()` to inner client recreation;
- fatal close-code handling;
- browser online/offline and visible/resume recovery;
- active subscription resubscription after internal client recreation;
- user-facing connection messages.

## State Monitoring

Applications observe connection state; they do not own recovery decisions.

```ts
import { DefaultWebappRealtimeConnection } from "@omgjs/labkit-webapp-realtime";

export const realtime = new DefaultWebappRealtimeConnection({
  wsEndpoint: WS_ENDPOINT,
  connectionParams: () =>
    createRelayGraphqlWsConnectionParams(() => auth.getAccessToken()),
});

const client = realtime.getClient();
const state = realtime.getConnectionState();
const unsubscribe = realtime.subscribeToConnectionState((nextState) => {
  console.log(nextState.status, nextState.detail);
});
```

Product UI can use `getRealtimeConnectionMessage` for a first status banner,
or render richer state from `getConnectionState()`.

## Relay Integration

`@omgjs/labkit-webapp-graphql-relay` accepts an already-created realtime
instance. This is the preferred shape when UI also monitors the same runtime:

```ts
const realtime = new DefaultWebappRealtimeConnection({
  wsEndpoint: WS_ENDPOINT,
  connectionParams: () =>
    createRelayGraphqlWsConnectionParams(() => auth.getAccessToken()),
});

const environment = createWebappRelayEnvironment({
  httpEndpoint: HTTP_ENDPOINT,
  auth,
  realtime,
});
```

For smaller apps, `createWebappRelayEnvironment` can also create the default
realtime runtime from `wsEndpoint` and `realtimeOptions`.

## Runtime Notes

Tune heartbeat, timeout, and reconnect settings only after observing real
network behavior. The defaults are meant to cover normal browser sleep,
deployment reconnects, and transient network loss without application code
knowing how to repair the transport.
