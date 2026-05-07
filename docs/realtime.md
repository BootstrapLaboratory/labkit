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
When Relay is present, prefer observing the runtime from
`DefaultWebappRelayRuntime` so UI monitors the same realtime connection Relay
uses.

```ts
import { relayRuntime } from "./relay/environment";

const realtime = relayRuntime.getRealtime();
const client = realtime.getClient();
const state = relayRuntime.getRealtimeConnectionState();
const unsubscribe = relayRuntime.subscribeToRealtimeConnectionState((nextState) => {
  console.log(nextState.status, nextState.detail);
});
```

Product UI can use `getRealtimeConnectionMessage` for a first status banner,
or render richer state from `getConnectionState()`.

## Relay Integration

`@omgjs/labkit-webapp-graphql-relay` provides a default runtime that creates
the Relay environment and realtime connection together:

```ts
import { DefaultWebappRelayRuntime } from "@omgjs/labkit-webapp-graphql-relay";

const relayRuntime = new DefaultWebappRelayRuntime({
  httpEndpoint: HTTP_ENDPOINT,
  wsEndpoint: WS_ENDPOINT,
  auth,
});

const environment = relayRuntime.getEnvironment();
const realtime = relayRuntime.getRealtime();
```

The runtime uses auth-session expiry to refresh before websocket reconnects.
Advanced apps can still pass a custom realtime adapter to
`createWebappRelayEnvironment`.

## Runtime Notes

Tune heartbeat, timeout, and reconnect settings only after observing real
network behavior. The defaults are meant to cover normal browser sleep,
deployment reconnects, and transient network loss without application code
knowing how to repair the transport.
