# Recover Transport Terminal Events

## Context

The browser can remain stuck for more than a minute after Labkit has already
recreated the websocket client. The visible state remains:

`Reconnecting live updates... Live updates reconnect timed out. Recreating the websocket client.`

A direct websocket probe from this workspace can open the production endpoint
and receive `connection_ack`, so the server endpoint is reachable. The remaining
client-side gap is likely that a current-generation transport failure can end
the facade subscription while Labkit is in recovery, leaving the UI in
`retrying` without a live Relay subscription to drive a clean reconnect.

## Scope

- Harden `packages/webapp-realtime`.
- Treat current-generation subscription terminal events during recovery as
  recoverable transport endings.
- Keep Relay subscriptions active and resubscribe them through a recreated
  inner client.
- Preserve normal GraphQL operation errors/completion while connected.
- Add regression tests.
- Reuse the current patch release change file for `@omgjs/labkit-webapp-realtime`.
- Do not stage or commit changes.

## Checklist

- [x] Add a facade callback for recoverable current-generation terminal events.
- [x] Restart the inner client when a subscription errors/completes during
  `connecting` or `retrying`.
- [x] Ensure GraphQL operation errors while `connected` still reach consumers.
- [x] Add regression tests for retrying subscription error/complete.
- [x] Run focused realtime validation.
- [x] Mark task complete.
