# Harden Realtime Restart

## Context

The reference webapp can remain stuck in the live-updates retrying state after
browser sleep/resume or a server-side websocket interruption. The browser
console shows a `graphql-ws` close-like object with code `1000` and reason
`All Subscriptions Gone`.

The reference app uses the shared `DefaultWebappRealtimeConnection` instance
correctly. The issue belongs in `@omgjs/labkit-webapp-realtime`: restart should
own old-generation websocket shutdown noise and keep active subscriptions
resubscribed behind the stable facade.

## Scope

- Harden `packages/webapp-realtime`.
- Add regression tests for old-generation dispose/retry shutdown behavior.
- Create a patch Rush change file for `@omgjs/labkit-webapp-realtime`.
- Do not stage or commit changes.

## Docs And Release Notes

- This is a backward-compatible runtime bugfix, so the package bump should be
  `patch`.
- `v0.1.1` docs are already archived and current docs are labeled `vNext`.
- Do not create a new docs snapshot unless this task edits current docs for a
  newly released docs line.

## Checklist

- [x] Confirm the existing realtime restart flow and failing edge case.
- [x] Catch/suppress old-generation dispose rejection during restart.
- [x] Keep active subscriptions resubscribed through restart.
- [x] Ensure restart remains watchdog-protected until connected.
- [x] Add regression tests for `1000 / All Subscriptions Gone`.
- [x] Run focused realtime package tests.
- [x] Create Rush patch change file.
