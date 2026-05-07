# Harden Sleep Redeploy Realtime Recovery

## Context

After `@omgjs/labkit-webapp-realtime@1.0.1`, the reference webapp still can
remain stuck in `retrying` when the server is redeployed while the browser
computer is asleep. Reloading the page creates a fresh Relay/runtime instance
and recovers.

The reference app wiring uses one shared `DefaultWebappRealtimeConnection`
instance and passes it to Relay correctly. The remaining issue belongs in the
Labkit realtime recovery policy.

## Hypothesis

Browser sleep can pause timers while the old websocket still appears connected
to Labkit. On resume, the current implementation only recreates the client if
state is already `connecting` or `retrying`. If state still says `connected`,
Labkit waits for stale socket failure and watchdog recovery. The default
watchdog first calls `terminate()`, which can leave users seeing `Terminated`
and can keep the old `graphql-ws` retry machinery involved too long.

## Scope

- Harden `packages/webapp-realtime`.
- Treat long browser resume as a stale connection boundary when subscriptions
  are active.
- Prefer full client recreation over `terminate()` for default stuck-reconnect
  watchdog recovery.
- Keep the explicit terminate-first policy configurable for users that opt in.
- Add regression tests.
- Create a patch Rush change file.
- Do not stage or commit changes.

## Checklist

- [x] Add active-subscription visibility to the stable facade.
- [x] Restart the realtime client after long browser resume even from
  `connected` state.
- [x] Change the default watchdog policy to recreate the client immediately.
- [x] Preserve opt-in terminate-first watchdog behavior.
- [x] Add regression tests for sleep/resume while apparently connected.
- [x] Add/update watchdog policy tests.
- [x] Run focused realtime validation.
- [x] Create patch Rush change file.
