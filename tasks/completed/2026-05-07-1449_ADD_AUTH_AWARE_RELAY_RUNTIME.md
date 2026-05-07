# Add Auth-Aware Relay Runtime

## Context

Cloud Run redeploys can leave a sleeping browser with an old websocket transport
and an expired access token. The realtime package can recreate websocket
clients, but the Relay integration currently lets applications compose auth,
Relay, and realtime independently. That means websocket recovery may reuse a
stale token even though page reload works because auth bootstrap runs before the
fresh connection.

Labkit should own this reusable recovery sequence for normal applications while
still exposing lower-level interfaces for teams that need custom policy.

## Goals

- Add a production-ready Relay runtime class in
  `@omgjs/labkit-webapp-graphql-relay`.
- Let the runtime own:
  - Relay `Environment` creation;
  - default realtime connection creation;
  - auth-aware websocket connection params;
  - access-token refresh before websocket reconnects;
  - auth-token-change websocket termination;
  - realtime state monitoring.
- Keep lower-level helpers available for advanced composition.
- Use simple runtime methods:
  - `relayRuntime.getEnvironment()`;
  - `relayRuntime.getRealtime()`;
  - `relayRuntime.getRealtimeConnectionState()`;
  - `relayRuntime.subscribeToRealtimeConnectionState(listener)`;
  - `relayRuntime.dispose()`.
- Update package and root docs so the runtime path is the documented default.
- Add Rush change metadata for the public API change.
- Do not stage or commit changes.

## Non-Goals

- Do not change the reference application repository directly.
- Do not publish packages locally.
- Do not add server-side websocket auth policy changes in this task.
- Do not snapshot docs unless the current docs line is being archived for a
  newly released version.

## Design Notes

- Extend the auth adapter contract with an auth session read so the Relay
  runtime can know when the current access token is expired or close to expiry.
- Add an auth-aware websocket connection-params factory that refreshes the
  stored auth session before reconnect when a session exists and the access
  token is within the refresh window.
- If refresh returns no session, return anonymous websocket connection params
  instead of sending a known stale bearer token.
- If refresh throws, let the websocket client retry through its existing retry
  policy.
- Prefer the runtime class in documentation, because it allows UI to observe the
  same realtime instance used by Relay while keeping recovery mechanics inside
  Labkit.

## Checklist

- [x] Add auth-session and refresh policy types.
- [x] Add auth-aware websocket connection params helper.
- [x] Add `DefaultWebappRelayRuntime`.
- [x] Update existing realtime/environment helper to use auth-aware params when
      it creates the default realtime connection.
- [x] Add unit tests for auth-aware websocket refresh behavior.
- [x] Add unit tests for runtime state/environment/realtime accessors.
- [x] Update package README and root docs.
- [x] Add Rush change file for `@omgjs/labkit-webapp-graphql-relay`.
- [x] Run focused package validation.
- [x] Move this task file to `tasks/completed` when complete.
