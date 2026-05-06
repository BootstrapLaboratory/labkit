# Plan Self-Healing Realtime Runtime

## Goal

Design the next Labkit realtime API so applications do not need to own low-level
websocket recovery mechanics such as laptop sleep recovery, Cloud Run websocket
drain behavior, reconnect watchdog escalation, GraphQL WS client recreation, or
Relay subscription resubscription.

The library should still expose extension points for teams that need custom
transport behavior, but the default path should be production-ready and
preconfigured.

## Philosophy

Labkit should follow a layered design philosophy:

- Applications own product decisions: routes, GraphQL operations, product UI,
  endpoint values, auth policy selection, concrete styling, and product-specific
  side effects.
- Labkit owns reusable runtime discipline: browser auth session mechanics,
  GraphQL transport behavior, realtime recovery policy, retry and heartbeat
  rules, server/browser protocol contracts, and safe defaults for common
  production failure modes.
- Public APIs should provide a good default first and extension points second.
  A normal application should be able to use a preconfigured class or factory
  without learning all system-level failure cases.
- Extension points should be explicit interfaces, not accidental escape hatches.
  Advanced users should be able to replace the transport factory, reconnect
  policy, heartbeat policy, browser lifecycle adapter, fatal close-code policy,
  and logger without forking Labkit internals.
- Defaults should be observable, not mysterious. Labkit should expose connection
  state and useful diagnostics so the app can render status, but the app should
  not need to decide how to repair the transport.

This philosophy should be documented in the root docs, likely in
`docs/architecture.md` or a dedicated philosophy page referenced from
`docs/architecture.md`, `docs/realtime.md`, and package pages.

## Current Problem

`@omgjs/labkit-webapp-realtime` currently creates and tracks a `graphql-ws`
client. It handles heartbeat timeout, browser online/offline state, reconnect
messages, fatal close codes, and a reconnect watchdog.

The current hardening limit is that the watchdog escalates by calling
`client.terminate()` on the same concrete `graphql-ws` client. That is useful,
but it may not be enough when a browser tab resumes from sleep, the network
stack is wedged, or a deployment platform leaves a persistent websocket in a
bad state. The stronger recovery model is for Labkit to own a stable facade
client and recreate the inner GraphQL WS client when terminate-only recovery
does not produce a healthy connection.

## Compatibility Direction

Labkit is still early and the only real consumer is the reference
implementation project. Optimize this work for the correct long-term public
API, not for preserving the current small API surface.

Breaking changes are acceptable when they make the default shape simpler,
clearer, and more reliable. The migration cost is limited to the reference
implementation, and paying that cost now is better than carrying a weak public
contract into wider adoption.

This does not mean changing the contract of already published npm package
versions. Existing published versions remain available as immutable release
artifacts. The breaking API belongs to the next package version line and must
be represented with the correct Rush change bump type.

Because current docs describe already published package behavior, preserve the
current released docs in Docusaurus `docs-versions` before rewriting source
docs for the new realtime API. Old package users should be able to read docs
that match the package version they still use.

## Public API Direction

Design the new API around a production-ready class first:

- Make `DefaultWebappRealtimeConnection` the primary recommended entrypoint.
- Allow a small `createDefaultWebappRealtimeConnection` factory only as an
  ergonomic wrapper over the class if it improves usage examples.
- Return a stable GraphQL WS compatible `Client` facade from the default
  connection.
- Make the facade stable: Relay and application code hold the same outer client
  while Labkit can replace the inner `graphql-ws` client.
- Require `DefaultWebappRealtimeConnection` to expose connection state
  monitoring for product UI, logs, and diagnostics while keeping websocket
  recovery decisions internal to Labkit.
- Replace the current `createWebappRealtimeConnection` factory with
  `DefaultWebappRealtimeConnection` and a thin
  `createDefaultWebappRealtimeConnection` helper.
- Add public policy interfaces for advanced users.
- Keep the concrete self-healing facade implementation internal for now. Expose
  the default class and extension interfaces, not the facade class itself.

Potential new exports from `@omgjs/labkit-webapp-realtime`:

- `DefaultWebappRealtimeConnection`
- `createDefaultWebappRealtimeConnection`
- `GraphqlWsTransportFactory`
- `RealtimeReconnectPolicy`
- `RealtimeHeartbeatPolicy`
- `RealtimeBrowserLifecycle`
- `RealtimeRecoveryPolicy`
- `RealtimeRecoveryReason`
- `RealtimeConnectionEvent`

Required state-monitoring shape:

- Applications using `DefaultWebappRealtimeConnection` must be able to observe
  connection state without replacing the default production runtime.
- The state API should support simple UI banners and richer monitoring. It
  should expose status, message/detail, recovery reason, recovery attempt or
  restart count, last connected/disconnected timestamps, and the last relevant
  error when available.
- The state API must not require applications to decide when to terminate,
  recreate, resubscribe, or recover websocket transports. Applications observe
  state; Labkit owns recovery.
- The default state API names should be `getClient()`,
  `getConnectionState()`, and `subscribeToConnectionState(listener)`.
- The default Relay integration should allow the same realtime instance to be
  passed into `createWebappRelayEnvironment` so UI code can observe it and Relay
  can use its stable facade client.
- The default Relay integration should also support raw websocket endpoint
  options for convenience, but documentation should present the explicit
  realtime instance path first.

Target usage shape:

```ts
const realtime = new DefaultWebappRealtimeConnection({
  wsEndpoint,
  connectionParams,
});

const relayEnvironment = createWebappRelayEnvironment({
  httpEndpoint,
  realtime,
  auth,
});

const client = realtime.getClient();
const state = realtime.getConnectionState();
const unsubscribe = realtime.subscribeToConnectionState((state) => {
  console.log(state.status, state.message, state.recoveryReason);
});
```

Remove the current `createWebappRealtimeConnection` contract if it cannot be
kept as a compatibility alias without weakening the clean API. Document the
migration in the package README and root docs.

## Package Impact

Primary package:

- `packages/webapp-realtime`

Likely secondary package:

- `packages/webapp-graphql-relay`

`@omgjs/labkit-webapp-graphql-relay` should depend directly on
`@omgjs/labkit-webapp-realtime` for its default production-safe Relay helper.
Keep lower-level adapter interfaces available for advanced users, but make the
main Relay path use the self-healing realtime runtime automatically.

## Design Plan

### Phase 1: API Design

- Review the current public exports in `packages/webapp-realtime/src/index.ts`
  and remove or reshape weak early exports where needed.
- Make `DefaultWebappRealtimeConnection` the main production preset.
- Add `createDefaultWebappRealtimeConnection` only as a thin wrapper over the
  class.
- Define the stable facade `Client` contract.
- Define the connection state monitoring contract exposed by
  `DefaultWebappRealtimeConnection`.
- Define the subscription registry contract:
  - store active subscription payloads and sinks;
  - return an unsubscribe function that prevents future resubscription;
  - suppress terminal `complete` or `error` events caused only by internal
    client recreation;
  - forward real subscription errors and fatal closes to the caller;
  - resubscribe active operations after inner client recreation.
- Define recovery escalation:
  - first recover with `terminate`;
  - after configurable repeated watchdog failures, recreate the inner client;
  - on browser `online` or visibility resume, restart if the state is stuck in
    `connecting` or `retrying`;
  - never recreate on fatal close codes unless a custom policy says otherwise.
- Define defaults:
  - heartbeat interval;
  - heartbeat timeout;
  - connection ack timeout;
  - reconnect watchdog;
  - max terminate attempts before inner recreation;
  - fatal close codes;
  - retry wait policy;
  - logging behavior.

### Phase 2: Implementation

- Implement the stable facade client in `packages/webapp-realtime`.
- Move existing GraphQL WS option creation behind an inner-client factory.
- Track active subscriptions with generation-aware records.
- Add an internal restart method that disposes the old inner client, creates a
  new inner client, and resubscribes active operations.
- Preserve the current connection state store API.
- Add additional state details that are useful but not app-owned recovery logic,
  such as:
  - restart count;
  - recovery reason;
  - last recovery action;
  - current inner client generation.
- Keep `getRealtimeConnectionMessage` useful for simple product UIs. Consider
  showing retry `detail` when present so watchdog escalation is visible.

### Phase 3: Relay Integration

- Make `@omgjs/labkit-webapp-graphql-relay` consume the new default realtime
  class in its recommended Relay environment path.
- Keep a lower-level realtime adapter shape for applications that need to bring
  a custom realtime runtime.
- Allow callers to pass an already-created `DefaultWebappRealtimeConnection`
  instance when they want to share state or tune policy. Document this path
  first.
- Also support raw websocket endpoint and connection params so simple apps can
  let the Relay helper create the default realtime runtime.
- Confirm auth-token changes still terminate or restart the realtime client
  safely without leaking old subscriptions.

### Phase 4: Tests

Add focused tests in `packages/webapp-realtime/test/index.test.ts`:

- watchdog timeout calls terminate before full recreation;
- repeated watchdog timeouts recreate the inner client after the configured
  threshold;
- active subscriptions are resubscribed after inner client recreation;
- unsubscribed operations are not resubscribed;
- internal restart does not forward artificial terminal events to Relay sinks;
- real fatal close codes move to `disconnected` and do not recreate by default;
- browser online/resume recovery can trigger restart when stuck;
- message formatting includes useful retry detail when present.

Add or adjust tests in `packages/webapp-graphql-relay` if a new Relay-facing
helper or overload is added.

### Phase 5: Documentation

Before changing source docs for the new API:

- Snapshot the current released docs into Docusaurus `docs-versions` by
  following `.ai/rules/LibraryReleases.md`.
- Determine the current docs version from
  `website-docusaurus/docusaurus.config.ts`.
- Confirm the matching git tag exists before generating the archive.
- Stop and report the blocker if the matching tag does not exist.
- Do not hand-edit generated archive files after the snapshot; regenerate them
  from the tagged source if corrections are needed.

Update source docs:

- `docs/architecture.md`: document Labkit's layered philosophy of production
  defaults plus explicit extension points.
- `docs/realtime.md`: explain the self-healing realtime model and what the app
  still owns.
- `docs/packages/webapp-realtime.md`: document the new class, facade client,
  policies, defaults, and migration notes.
- `docs/packages/webapp-graphql-relay.md`: document any Relay convenience API.
- `docs/quick-start/realtime.md`: show the recommended default path first, with
  advanced customization below it.
- `packages/webapp-realtime/README.md`: update public API and examples.
- `packages/webapp-graphql-relay/README.md`: update only if its public API
  changes.

Do not hand-edit generated `website-docusaurus/docs`; sync scripts own that
copy.

### Phase 6: Version And Release Planning

Expected release impact:

- `@omgjs/labkit-webapp-realtime`: breaking API/behavior redesign. Because the
  package is still early, prefer the right API even if the Rush bump type must
  be `major`.
- `@omgjs/labkit-webapp-graphql-relay`: likely breaking or at least minor,
  because the recommended Relay environment API should expose the new default
  realtime behavior.
- Use the bump type required by Rush policy and `.ai/rules/LibraryReleases.md`;
  do not manually edit package versions.

When implementing, first archive the current released docs if this work changes
current docs for the next package line. Then make source and docs changes.
After source and docs changes are complete, create Rush change files. Do not
manually edit package versions.

Before preparing a package release line, follow `.ai/rules/LibraryReleases.md`,
including docs version snapshot requirements if this starts a new released docs
line.

## Docs Snapshot Preflight Result

- Latest published package version before this work is `0.1.1`.
- The package release commit is `decab01ac8f5aad960ebaf3f804a877b803440ae`,
  but that commit does not contain `docs` or `website-docusaurus`.
- Docs were introduced later in `bc02b3a`, while package versions were still
  `0.1.1`.
- A local `v0.1.1` tag was created at `bc02b3a` as the docs-bearing archive
  source for the `0.1.1` docs line.
- `website-docusaurus/scripts/sync-versioned-docs.mjs` now includes
  `v0.1.1`, and `website-docusaurus/docusaurus.config.ts` exposes `v0.1.1` as
  archived docs while current docs are labeled `vNext`.
- `npm run site:docusaurus:sync-versioned-docs` generated the `v0.1.1`
  archive under `docs-versions`.

## Design Decisions

- Production preset: use `DefaultWebappRealtimeConnection` as the primary
  class. Add `createDefaultWebappRealtimeConnection` only as a thin ergonomic
  wrapper.
- Facade visibility: keep the concrete self-healing facade internal for now.
  Expose `DefaultWebappRealtimeConnection` and extension interfaces.
- Old factory: replace `createWebappRealtimeConnection` with
  `DefaultWebappRealtimeConnection` and
  `createDefaultWebappRealtimeConnection`; do not preserve a weak legacy shape.
- State API names: expose `getClient()`, `getConnectionState()`, and
  `subscribeToConnectionState(listener)`.
- Browser lifecycle: include browser online/offline and visibility resume in
  the default lifecycle policy. Make the lifecycle adapter replaceable for
  non-browser tests or unusual browser shells.
- Watchdog escalation: default to one terminate-only recovery attempt, then
  recreate the inner client on the next watchdog timeout if the state is still
  `connecting` or `retrying`.
- Retry messages: display retry `detail` when present so timeout/restart
  reasons are visible without requiring custom UI, while keeping structured
  state available for richer app rendering.
- Relay package coupling: let `@omgjs/labkit-webapp-graphql-relay` depend on
  `@omgjs/labkit-webapp-realtime` for the default helper. Keep lower-level
  adapter interfaces for custom realtime implementations.
- Relay helper shape: support both an explicit realtime instance and raw
  websocket endpoint options. Document the instance path first because it lets
  UI code monitor the same runtime Relay uses.
- Docs snapshot preflight: before editing docs, confirm the current Docusaurus
  docs version and matching git tag. This preflight blocks docs edits if the
  tag is missing, but not necessarily source implementation.
- Compatibility: do not preserve old source APIs in the next package line if
  they weaken the clean design. Preserve old released behavior through npm
  package versions and Docusaurus docs snapshots. Update the reference
  implementation after the Labkit API is improved.

## Checklist

- [x] Approve API direction and package impact.
- [x] Decide compatibility target: clean breaking API is acceptable.
- [x] Implement stable facade client in `packages/webapp-realtime`.
- [x] Add recovery policy and browser lifecycle extension interfaces.
- [x] Add subscription resubscription behavior.
- [x] Replace `createWebappRealtimeConnection` with the new default class and
      thin factory.
- [x] Add focused realtime tests.
- [x] Add Relay integration tests if `packages/webapp-graphql-relay` changes.
- [x] Run docs snapshot preflight before docs edits.
- [x] Archive current released docs into `docs-versions` before rewriting docs
      for the new API.
- [x] Update package README files.
- [x] Update root docs and quick-start docs.
- [x] Create Rush change files for affected packages.
- [x] Run package and repository validation.
- [x] Prepare docs snapshot only if this work starts a new released docs line.
