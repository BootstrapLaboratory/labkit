# Realtime

Labkit realtime support is centered on GraphQL subscriptions over
`graphql-ws`.

The important constraint is that websocket auth is established when the socket
connects. A token update in memory does not change the already-open
connection. The client must reconnect.

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

## Browser Responsibilities

`@omgjs/labkit-webapp-realtime` creates a tracked `graphql-ws` client:

- connection states: `idle`, `connecting`, `connected`, `retrying`,
  `disconnected`;
- heartbeat interval and timeout;
- reconnect watchdog;
- fatal close-code handling;
- browser online/offline tracking;
- user-facing connection messages.

`@omgjs/labkit-webapp-graphql-relay` connects that client to Relay and
terminates it when the access token changes.

## Connection Params

Relay websocket connection params are created from the current access token:

```ts
import { createRelayGraphqlWsConnectionParams } from "@omgjs/labkit-webapp-graphql-relay";

const connectionParams = () =>
  createRelayGraphqlWsConnectionParams(() => authSession.getAccessToken());
```

The server reads the same parameter names through
`@omgjs/labkit-auth-contract`, so browser and server code do not drift.

## Runtime Notes

Show connection state in product UI when realtime matters. Labkit supplies
state and default messages; the app decides where and how to render them.

Tune heartbeat, timeout, and reconnect settings only after observing real
network behavior. The defaults are conservative enough for a first app.
