# Harden TanStack Router And Relay Route-Query Lifecycles

Status: implementation and validation complete; awaiting commit/PR and the
post-merge release workflow.
Created: 2026-08-11
Classification: confirmed lifecycle integration bug whose smallest reusable
fix is an additive public API improvement.
Prerequisite:
[Fix Relay Peer Runtime Contract](./completed/2026-08-11-1124_FIX_RELAY_PEER_RUNTIME_CONTRACT.md).
Release guidance: proposed minor release of
`@omgjs/labkit-webapp-graphql-relay` (3.0.0 to 3.1.0) if Gate B approves the
additive API. Do not edit the version manually.

## Decision Summary

Build a deterministic, real TanStack Router/React/Relay integration matrix for
the documented `loadRouteQuery` path. The matrix must characterize ownership
before changing public source.

TanStack routing remains application-owned. Keep TanStack dependencies in a
private fixture unless evidence proves that a reusable public adapter is
necessary. If the correct lifecycle cannot be expressed with the existing
helper and a documented application-owned route recipe, stop at the public API
gate and obtain maintainer approval before adding exports, changing signatures,
or introducing a public TanStack dependency/package.

The initial classification rules were:

- it is a library bug if the documented helper fails in an explicitly
  supported, single-runtime configuration;
- it remains an improvement if the helper works but realistic coverage and
  ownership documentation are missing;
- it becomes an API feature/change if a new lifecycle controller, ownership
  handle, or router adapter is required.

Phase 1 evidence below confirms the first and third cases: the supported helper
can dispose Relay work while its mounted consumer remains visible, and fixing
that ownership mismatch requires a reusable lifetime primitive.

## Prerequisite And Baseline

Complete the Relay peer runtime contract first. Before interpreting any route
lifecycle failure, the fixture must prove that application code, Labkit,
`react-relay`, and `relay-runtime` resolve one canonical supported graph.

The lifecycle fixture must fail its preflight on an unsupported or duplicated
Relay runtime. A split or mismatched graph is package-contract evidence, not
lifecycle evidence.

At implementation time, record exact versions of:

- Node and the selected test runner;
- React and React DOM;
- `react-relay`, `relay-runtime`, and `relay-compiler`;
- `@tanstack/react-router`;
- Vite and any browser automation or DOM harness.

Read the official documentation for those exact versions and record the
meanings of loader abort, preload promotion/expiry, `staleTime`,
`preloadStaleTime`, `gcTime`, invalidation, history restoration, and cache
clearing. Do not encode assumptions from another version.

## Repository Context

The current public helper in
[the Relay package source](../packages/webapp-graphql-relay/src/index.ts):

1. calls React Relay `loadQuery`;
2. returns one `PreloadedQuery`;
3. registers an idempotent disposal callback on one caller-provided abort
   signal.

The focused tests in
[the package test](../packages/webapp-graphql-relay/test/index.test.ts) inject
fake query loaders and prove abort disposal. They do not mount a real
`RouterProvider`, `RelayEnvironmentProvider`, or `usePreloadedQuery` consumer,
and they do not characterize router cache/history ownership.

Labkit's [browser architecture](../docs/architecture.md) assigns routes,
generated operations, hooks, and product behavior to the application. Labkit
owns reusable Relay runtime mechanics and the documented behavior of its
helper. The integration contract must preserve that boundary.

## Goals

- Define an evidence-backed ownership model for Relay query references created
  by TanStack loaders.
- Exercise the actual package root with a real router, React root, Relay
  environment/provider, generated operation, and `usePreloadedQuery`.
- Cover direct entry, full reload, in-app navigation, rapid replacement,
  back/forward, preload promotion/expiry, invalidation, route errors, retry,
  route abort, cache expiry, and final teardown.
- Cover one reference and two independently completing references owned by one
  route.
- Run selected ownership transitions under React Strict Mode.
- Prove that active consumers never receive a disposed reference under the
  selected application-owned cache policy.
- Prove that abandoned integration-owned references are eventually disposed at
  most once.
- Replace timing races with controlled network and lifecycle events.
- Document supported router settings and the boundary between application and
  Labkit responsibility.
- Keep the permanent matrix small enough to be deterministic by testing each
  distinct ownership transition rather than a full Cartesian product.

## Non-Goals

- Do not fix Relay package duplication or version compatibility in this task.
- Do not depend on a product repository, product routes, authentication flow,
  production GraphQL service, or domain schema.
- Do not make TanStack Router a public dependency or peer of
  `@omgjs/labkit-webapp-graphql-relay` without approval.
- Do not silently broaden the current abort helper into a router cache manager.
- Do not add a public export, change the current signature/semantics, or create
  a public adapter package before the contract gate is approved.
- Do not rely on arbitrary sleeps, network throttling, warmed Relay state,
  private `PreloadedQuery` fields, or undocumented router internals.
- Do not test every framework patch version or every possible cache setting.
- Do not add SSR, streaming, hydration, React Server Components, or TanStack
  Start coverage.
- Do not redesign authentication, realtime, or general GraphQL transport
  behavior.
- Do not publish locally, manually edit versions/changelogs, or hand-edit
  generated/archived documentation.

## Ownership Model To Prove

Treat network completion and resource ownership as separate concepts. Every
query reference must follow one observable lifecycle:

1. **Created**: a loader or preload receives a new reference.
2. **Pending/preloaded**: an unresolved navigation or preload owns it.
3. **Committed/active**: a mounted route can consume it.
4. **Cached/replaced**: it is either intentionally kept live for reuse or is
   replaced before another reference becomes visible.
5. **Released**: it is disposed once and can never become visible again.

The selected integration must establish these invariants:

- a released reference is terminal;
- repeated abort, leave, unmount, retry, cache, and teardown signals remain
  idempotent;
- predecessor UI retains a usable predecessor reference while replacement work
  is pending if that UI remains mounted;
- superseded pending work cannot commit after a late response;
- a cached match contains a live reference or forces replacement before render;
- an unused/expired preload is eventually released;
- a promoted preload is not unnecessarily duplicated;
- retry never reuses a failed or released reference;
- each reference in a multi-query route has independent accounting;
- partial construction/failure releases already-created siblings according to
  the approved policy;
- final router/provider teardown releases all integration-owned work,
  listeners, and subscriptions;
- correctness does not depend on response order or wall-clock delays.

The statement "mounted consumers never receive disposed references" is an
invariant of the tested reference integration, including its app-owned signal
and cache policy. Do not attribute that entire guarantee to the current low-level
helper unless the contract gate explicitly establishes it.

## Private Fixture Architecture

Create a dedicated, non-published Rush project at a depth allowed by
`rush.json`, for example:

`tools/webapp-graphql-relay-lifecycle-fixture`

The project must:

- use `private: true` and be intentionally excluded from publishing/version
  policy;
- use the `tools` review category and participate in Rush build/test/verify;
- depend on the workspace Relay package through its public package entrypoint,
  never `src`;
- pin exact framework/test versions;
- keep all TanStack, DOM, Vite, and browser dependencies private;
- own its minimal schema, Relay compiler configuration, operations, and
  generated artifacts;
- expose no public exports;
- use a deterministic controlled GraphQL transport;
- provide a stable local command and CI entrypoint.

Reuse only neutral infrastructure from the packed-consumer fixture. Do not make
this large matrix part of the published package or its compiled `dist` tree.

### Two test levels

1. **Fast deterministic integration layer**
   - real TanStack memory history and `RouterProvider`;
   - real React root and selected Strict Mode cases;
   - real Relay environment/provider/hook;
   - controlled network observables;
   - deterministic DOM harness;
   - fake timers only for documented cache/preload timers, advanced explicitly.
2. **Browser/Vite acceptance layer**
   - Vite production/reference build;
   - a headless browser for fresh direct entry, actual document reload,
     back/forward, and teardown cases that a memory DOM cannot prove;
   - the smallest representative subset of the matrix;
   - a dedicated PR workflow step that installs only the required browser if
     the repository has no existing browser runner.

Before adding a new browser stack, inspect current tooling and record why it is
needed. Real reload/history requirements may not be replaced by a synthetic
component remount without documenting the reduced guarantee.

### Neutral route tree

Use a minimal route tree containing:

- a landing route with no query;
- a parameterized single-query route;
- a parameterized two-query route;
- a route-level error/retry boundary;
- navigation controls used by browser acceptance.

Routes, loader retention, retry UI, and cache settings remain fixture-owned
application examples. Generated operations must use neutral fields and no
product data.

## Deterministic Harness And Evidence

Build one reusable harness with a fresh router, history, DOM/root, Relay
environment/store, and network for every test. Provide explicit controls to:

- start, resolve, reject, complete, and cancel operations by name and variables;
- advance documented cache/preload timers;
- navigate, preload, invalidate, retry, go back/forward, clear cache, and
  teardown;
- resolve two queries in either order;
- abandon work before, between, and after responses.

Record a lifecycle ledger with stable IDs:

- test run;
- navigation/history action;
- router match and loader invocation;
- query reference;
- network subscription;
- mounted consumer.

Record ordered events for loader start/finish, reference creation, abort,
network subscribe/next/error/complete/cancel, mount/unmount, render/read,
cache/retry action, and disposal where observable. Assert event ordering rather
than elapsed time. Never record credentials, full payloads, or personal data.

Use complementary observability:

- controlled `RouteQueryLoader` contract tests may count disposal exactly;
- real Relay integration tests must use the default loader and assert only
  public outcomes and safely observable network/store behavior;
- do not inspect undocumented query-reference fields merely to make an exact
  counter possible.

Fail on unexpected console output, React warnings, uncaught errors, unhandled
rejections, work outside `act`, or open handles after teardown.

## Required Lifecycle Matrix

Do not generate a full Cartesian product. Implement every distinct transition
below and apply alternate completion order/Strict Mode only where specified.

| ID  | Scenario                                                                      | Required outcome                                                                           |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| B1  | Direct initial entry; one query suspends then succeeds                        | Correct data renders; the reference stays live while mounted                               |
| B2  | Full browser reload on the single-query URL                                   | A fresh runtime/reference renders the same correct identity without warmed state           |
| B3  | Signal already aborted and repeated abort notifications                       | The reference never renders and disposal is idempotent                                     |
| N1  | Rendered A navigates to B while B is pending                                  | A remains usable while mounted; B commits correctly; A is eventually released              |
| N2  | Pending A is superseded by B                                                  | A is canceled/released; a late A response cannot commit                                    |
| N3  | Rapid A(1) -> A(2) -> B with out-of-order responses                           | Only the final match commits; all superseded work is released                              |
| N4  | Route param or search dependency changes                                      | Old/new identities cannot be confused and replacement follows the selected policy          |
| H1  | A -> B -> browser back inside the fresh-cache window                          | Back reuses a proven-live reference or reloads before render, exactly as documented        |
| H2  | Browser forward after H1                                                      | Forward follows the same ownership/cache policy                                            |
| H3  | Return after cache expiry or explicit clear                                   | A new reference is created; an expired/released reference is never reused                  |
| H4  | Supported stale revalidation                                                  | Active data remains usable until replacement commits; no early release occurs              |
| P1  | Pending preload is promoted by navigation                                     | The documented promotion/deduplication behavior occurs without early release               |
| P2  | Completed preload is promoted                                                 | Preloaded data renders under the documented freshness policy                               |
| P3  | Preload is canceled or expires unused                                         | It never renders and is eventually released                                                |
| R1  | Query failure, route error, then retry succeeds                               | Retry creates valid new work; failed work is not reused or leaked                          |
| R2  | Active route invalidation/replacement                                         | The current route follows the documented pending/replacement policy safely                 |
| R3  | Retry/invalidation is superseded by navigation                                | Superseded retry work cannot commit and is released                                        |
| M1  | Two queries, first completes before second                                    | Both results render; sibling completion does not release the other reference               |
| M2  | Two queries, second completes before first                                    | Ownership and final rendering match M1                                                     |
| M3  | One query completes, then the route is abandoned while its sibling is pending | Both route-owned references are eventually released; pending work is canceled as supported |
| M4  | One of two queries fails, then retry succeeds                                 | No sibling leak or reuse of failed/released work                                           |
| M5  | Partial multi-query construction throws                                       | Every already-created reference is cleaned up according to the approved contract           |
| S1  | B1 under React Strict Mode                                                    | No duplicate loader ownership, premature disposal, warning, or failure                     |
| S2  | N1 and one multi-query transition under Strict Mode                           | Mount probing cannot release work still required by active UI                              |
| T1  | Router/provider/root teardown                                                 | All integration-owned references, requests, listeners, and subscriptions are released      |
| T2  | Runtime/router recreated at the same location                                 | No reference or store identity crosses from the old runtime                                |

For history and stale-revalidation cases, choose and document one coherent
strategy:

- retain cached loader references until a documented final release event; or
- disable their reuse and guarantee replacement before render.

Do not accept accidental reload behavior or an arbitrary grace timeout as the
contract.

## Evidence And Decisions

### Characterization Baseline

Phase 1 used a private Rush fixture with Node 24.18.0, React/React DOM 19.2.6,
React Relay/Relay Runtime/Relay Compiler 20.1.1, TanStack React Router 1.170.25
(Router Core 1.171.21), TypeScript 6.0.3, Vitest 4.1.10, jsdom 30.0.1, Vite
8.2.1, and Playwright 1.62.1.

The fixture imports the public Labkit package root and uses a real
`RouterProvider`, `RelayEnvironmentProvider`, generated operations,
`usePreloadedQuery`, controlled Relay network Observables, and an event ledger.
Its preflight proves that fixture code, Labkit, React Relay, and Relay Runtime
resolve the exact supported 20.1.1 pair through one canonical runtime path. A
negative preflight test rejects a duplicate runtime path.

The official contracts used for characterization are:

- TanStack assigns `abortController.signal` to a loader invocation. The signal
  aborts when that invocation becomes outdated and no Router consumer needs
  it. Navigation and preload may share an invocation.
- TanStack navigation `staleTime` defaults to zero, preloads have separate
  freshness, and cached matches have garbage-collection behavior. Cache
  clearing does not replace active match ownership.
- Relay retains a query reference until `dispose()`; after disposal it is no
  longer a valid mounted-consumer resource. Network completion and reference
  ownership are separate.

The selected safe router policy is blocking route replacement with an explicit
pending component and `gcTime: 0`. Loader values containing query references
must not be reused after release. Preload freshness remains explicit, and final
teardown navigates to a query-free route, clears cache, and unmounts.

### Observed Results

The existing helper passes direct entry, already-aborted loading, safe history
reload under the selected no-reuse policy, preload promotion, retry, both
two-query completion orders, and final teardown.

It fails N1 under a normal, single-runtime supported graph:

1. route A creates reference A, resolves, renders, and mounts;
2. route B starts and suspends on pending reference B;
3. TanStack keeps the mounted A UI visible while B is pending;
4. TanStack retires A's loader invocation and aborts A's loader signal;
5. `loadRouteQuery` immediately disposes reference A;
6. A remains mounted and visible with a disposed reference.

The Strict Mode S2 pair reproduces the same mismatch for two references: both
are released when replacement starts while their mounted route remains the
visible UI. This is not a duplicate-runtime, network-order, timer, cache, or
test-`act` artifact. The minimized invariant is that a loader invocation's
lifetime is shorter than the mounted React consumer's lifetime.

Partial multi-query construction exposes a second ownership gap. If the first
reference is created and construction of the second throws, TanStack does not
immediately abort the loader signal, so the first reference leaks. An explicit
terminal abort of a shared child lifetime fixes this path but does not fix N1;
the mounted consumer must also hold a lease.

The characterization suite intentionally retains failing N1 and S2 assertions
at Gate B. It must not be wired into required CI until the approved ownership
contract makes those invariants pass.

### Gate A Decision

The existing `loadRouteQuery` abort behavior plus an application-only cache
recipe is insufficient. A loader signal cannot represent both a TanStack
loader invocation and one or more mounted React consumers. Keeping released
references in Router cache, delaying disposal with a timeout, or changing fetch
policy cannot make those ownership domains identical.

TanStack remains application-owned, but reusable Relay reference lifetime
mechanics belong in the Relay library. The fixture may translate TanStack
events into a router-agnostic library lifetime; the library must not import
TanStack types or runtime code.

### Gate B Proposal - Approval Required

Add the following router-agnostic API to
`@omgjs/labkit-webapp-graphql-relay`:

```ts
export type RouteQueryOwnerSignal = RouteAbortSignal & {
  readonly reason?: unknown;
  removeEventListener(type: "abort", listener: () => void): void;
};

export type RouteQueryLifetime = {
  readonly abortSignal: RouteAbortSignal;
  abort(reason?: unknown): void;
  acquire(): () => void;
};

export function createRouteQueryLifetime(options: {
  routeAbortSignal: RouteQueryOwnerSignal;
}): RouteQueryLifetime;

export function useRouteQueryLifetime(lifetime: RouteQueryLifetime): void;

// The existing environment/query/variables/fetch options are unchanged.
export type LoadRouteQueryLifetimeOptions<TQuery extends OperationType> =
  LoadRouteQueryBaseOptions<TQuery> & {
    lifetime: RouteQueryLifetime;
    abortSignal?: never;
  };

/** @deprecated Use LoadRouteQueryLifetimeOptions for mounted route queries. */
export type LoadRouteQueryOptions<TQuery extends OperationType> =
  LoadRouteQueryBaseOptions<TQuery> & {
    abortSignal: RouteAbortSignal;
    lifetime?: never;
  };
```

The ownership state is:

```text
route lease + zero mounted leases
              |
              +-- acquire --> route lease + mounted lease(s)
              |
route abort --+--> mounted lease(s) remain --> final mounted release --> abort
              |
              +--> no mounted lease -------------------------------> abort
explicit terminal abort -------------------------------------------> abort
```

The lifetime is passed unchanged to one or more calls to `loadRouteQuery`; its
child `abortSignal` remains available for other abort-aware resources. The
parent route signal releases only the route lease. The
hook acquires complementary commit-time and passive mounted leases. The layout
lease covers the interval before passive effects run; the passive lease
survives React Suspense disconnecting layout effects while the previous UI
remains visible. Both release during their corresponding cleanup. The child
signal aborts exactly once after the route lease and final mounted lease are
gone, or immediately after explicit terminal `abort()`. Listeners are detached
at terminal release. Acquisition after terminal release is rejected. Every
returned release callback and `abort()` is idempotent.

Responsibilities are:

- the loader creates one lifetime per invocation and passes that lifetime to
  every query reference created by that loader;
- on partial construction failure, the loader calls terminal `abort()` before
  rethrowing;
- the route component calls `useRouteQueryLifetime` for the returned lifetime;
- the application owns route cache policy, pending UI, retry, history, and
  final router teardown;
- the library owns lease accounting, terminal abort, listener cleanup, and
  Strict Mode-safe mounted ownership;
- one lifetime may own one reference or a group of independently completing
  references; completion never releases ownership by itself.

`loadRouteQuery` remains source-compatible for valid existing calls. Its safe,
documented branch accepts `lifetime`; the raw `abortSignal` branch remains
available but is deprecated for abort-scoped work guaranteed never to mount.
The ownership inputs are mutually exclusive in declarations and at runtime.
TanStack route loaders with mounted consumers create a lifetime, pass it into
the helper, return it with their refs, and mount the hook.

This adds no TanStack dependency or peer. React is already a peer. The public
package's CJS, ESM, and declaration surfaces must export the new API and pass
packed-consumer validation. The proposed change is additive and therefore a
minor Rush change for only this package, with an expected version of 3.1.0.

Rejected alternatives:

- use the TanStack loader signal directly: proven to dispose mounted work;
- retain loader values in cache: can make a disposed reference reusable;
- add a timeout or grace period: nondeterministic and has no ownership event;
- copy a controller into every application: duplicates reusable Relay
  lifecycle mechanics and leaves the documented helper unsafe to compose;
- add a TanStack adapter package: no router-specific public type or event is
  required by the proposed primitive;
- change `loadRouteQuery` semantics: would be breaking and would overload one
  abort signal with ownership it cannot observe.

Maintainer approval of this proposal was granted on 2026-08-11. Phase 2 may
proceed with option 3 exactly as proposed.

### Approved Implementation Result

The public package now implements the approved router-independent lifetime and
adds no TanStack dependency. Before commit, the maintainer approved a
lifetime-first refinement: `loadRouteQuery({ lifetime })` is the safe branch,
the raw `abortSignal` branch is deprecated compatibility for work guaranteed
never to mount, and supplying both or neither ownership input is rejected. The
existing exported raw-signal options type is preserved, while a separate
`LoadRouteQueryLifetimeOptions` type and lifetime-first function overload keep
the change genuinely additive/minor. Valid existing raw-signal calls and
wrappers continue to compile and retain their behavior. Unit coverage proves
route/consumer ownership, multiple consumers, already-aborted signals, listener
detachment, terminal partial-construction abort, idempotency, exclusive
ownership inputs, and rejection of acquisition after terminal release.

Real React characterization refined the approved hook implementation. A
layout-only lease is insufficient because Suspense can disconnect layout
effects while keeping the previous route visible. The final hook holds one
commit-time layout lease and one passive mounted lease. The first closes the
pre-passive commit gap; the second survives that Suspense disconnection until
real unmount. N1 and Strict Mode S2 pass with this complementary ownership.

Permanent validation completed with:

- 25 public-package unit tests, including lifetime-first runtime behavior,
  deprecated raw-signal behavior, and compile/runtime ownership exclusivity;
- 27 deterministic real TanStack/React/Relay/jsdom lifecycle tests covering
  every matrix row;
- one real Chromium/Vite test covering fresh direct entry, pending
  replacement, document reload, browser back/forward, runtime recreation, and
  final teardown;
- a publish-equivalent isolated 3.1 tarball matrix covering supported npm and
  isolated pnpm installs, strict peers, negative peer graphs, declarations,
  CJS, native and bundled ESM, Vite, SSR/provider rendering, and one canonical
  Relay runtime;
- full Rush build, lint, test, and verify;
- Docusaurus source synchronization, typecheck, and production build.

The customer migration is documented in
[Upgrade Webapp GraphQL Relay To
3.1](../docs/upgrades/webapp-graphql-relay-3.1.md) and registered in the
Docusaurus docs tree. Package README/reference, GraphQL contract, webapp
composition, and architecture sources describe the same ownership boundary.

`trunk check -a -y` was executed. Task-owned formatting was retained and
out-of-scope autofixes were reverted. Remaining findings are repository-wide
pre-existing Docker/action-pin, generated changelog Markdown, and dependency
advisory findings; none points to the new public source, fixture source, or
customer documentation.

## Work Plan

### Phase 1 - Upstream Contract And Characterization

Make no public source changes in this phase.

- [x] Read `AGENTS.md`, `.ai/conventions.md`, `.ai/architecture.md`, and the
      task-specific task-file, documentation, and library-release rules before
      implementation.
- [x] Read current official TanStack and Relay documentation for the pinned
      versions.
- [x] Inspect `git status --short` and preserve unrelated changes.
- [x] Complete the one-runtime preflight.
- [x] Record current `loadRouteQuery` behavior and existing unit coverage.
- [x] Create the private Rush fixture, neutral schema/operations, controlled
      network, and lifecycle ledger.
- [x] Characterize at least B1, N1, N2, H1, P1, R1, M1, M2, and T1 against the
      existing public helper.
- [x] Minimize each failure and distinguish Labkit behavior, fixture mistakes,
      documented TanStack behavior, unsupported configuration, and upstream
      defects.
- [x] Add an `Evidence And Decisions` section to this file with observed event
      order and exact tested versions.
- [x] Do not land assertions that merely freeze accidental current behavior.

Phase 1 is complete when the current ownership boundary is measured rather than
assumed.

### Gate A - Supported Ownership Model

Before changing public source, record:

- supported `staleTime`, `preloadStaleTime`, and `gcTime` assumptions;
- whether loader values containing query references may be reused;
- the final release event for navigation, preload, active route, cache, and
  teardown owners;
- whether the existing abort signal is sufficient;
- how single-query and multi-query cleanup differ;
- whether an app-owned route recipe using existing APIs satisfies every
  invariant.

If the current helper plus an explicit route recipe is sufficient, continue as
a test/documentation improvement. If not, proceed to Gate B.

### Gate B - Public API And Package Boundary

Prefer the smallest architecture-preserving outcome:

1. correct a proven internal bug without changing the public signature;
2. document a safe application-owned recipe using existing APIs;
3. add a router-agnostic lifecycle controller/ownership handle;
4. introduce a dedicated TanStack adapter package if router-specific types or
   events are unavoidable.

Do not add TanStack to the core Relay package for convenience. If option 3 or 4
is required, append a proposal containing:

- proposed package and exported TypeScript signatures;
- an ownership state diagram and final-release rule;
- responsibilities for loader, route, mounted component, cache, and retry;
- single-query and multi-query examples;
- error, partial-construction, cancellation, and idempotency behavior;
- migration from `loadRouteQuery`;
- dependency/peer and CJS/ESM/type impact;
- SemVer and documentation impact;
- alternatives considered and rejected.

Then stop and request maintainer approval. Do not implement the export, change
the existing helper, add a public TanStack dependency, or register a new public
package before approval is recorded.

### Phase 2 - Implement The Approved Minimal Contract

After Gate A or Gate B is resolved:

- [x] Implement only the approved ownership model.
- [x] Keep the core Relay package router-agnostic whenever possible.
- [x] Keep disposal idempotent and detach listeners when ownership transfer
      makes them obsolete.
- [x] Never call `loadQuery` during React render.
- [x] Do not read, clone, or serialize private query-reference fields.
- [x] Treat multiple references as independent resources.
- [x] Clean up partial construction failures.
- [x] Preserve existing fetch policy and network-cache options unless an
      approved public proposal says otherwise.
- [x] Add focused unit/state-machine tests before expanding the integration
      suite.
- [x] Preserve a safe compatibility path if a new additive API is approved.

Phase 2 is complete when the minimal approved contract is implemented and its
unit-level ownership transitions pass.

### Phase 3 - Complete The Integration And Browser Matrices

- [x] Implement every required matrix row.
- [x] Use controlled response order rather than race-prone sleeps.
- [x] Assert route and rendered data identity after every navigation.
- [x] Assert late responses cannot alter the selected final UI.
- [x] Assert exact disposal at controlled contract seams and public
      cancellation/teardown outcomes in real Relay cases.
- [x] Execute both multi-query completion orders.
- [x] Execute selected transitions under Strict Mode.
- [x] Add the minimal Vite/browser subset for direct entry, reload, history,
      and final teardown.
- [x] Give every test a fresh runtime and complete cleanup.
- [x] Remove temporary diagnostic logging after ledger assertions stabilize.

If a documented upstream behavior prevents a required invariant, record a
minimal reproduction and stop rather than hiding the behavior with a delay,
retry loop, or cache workaround.

### Phase 4 - Documentation

After the ownership decision, update only affected current sources:

- [x] [Package README](../packages/webapp-graphql-relay/README.md).
- [x] [Package reference](../docs/packages/webapp-graphql-relay.md).
- [x] [GraphQL contract](../docs/graphql-contract.md), if the general query
      ownership contract changes.
- [x] [Webapp composition](../docs/webapp-composition.md).
- [x] [Architecture](../docs/architecture.md), only if the Labkit/application
      ownership boundary changes or needs a reusable rule.
- [x] Add a customer-facing 3.1 upgrade guide to the current `docs` source and
      Docusaurus navigation. Cover migration from passing the TanStack loader
      signal directly, single- and multi-query examples, supported cache and
      pending-UI policy, retry/error cleanup, Strict Mode, and final teardown.

Document exact tested versions, supported cache/revalidation assumptions,
initial/preload/navigation/history/retry behavior, multi-query composition,
final release rules, app-owned responsibilities, and migration if applicable.

Do not present fixture route files or generated operations as Labkit-owned.
Do not hand-edit generated `website-docusaurus/docs` or `docs-versions`; the
upgrade guide must live in the current source consumed by Docusaurus.

### Phase 5 - Release And CI Decision

Choose release metadata from the final diff:

- private fixture/tests/CI only: no public release by default;
- clarification of an existing released contract: follow repository guidance
  and decide `none` versus patch explicitly;
- backward-compatible runtime bug fix: patch;
- additive public lifecycle API: minor;
- incompatible signature, dependency, or behavior change: major;
- new public adapter package: separate approved package/release design.

- [x] Register the private tool project and its build ordering intentionally in
      `rush.json`.
- [x] Make fast deterministic tests part of Rush test/verify.
- [x] Add a dedicated browser command/workflow step only if the browser layer
      cannot run safely inside the existing job.
- [x] Create Rush change metadata only for packages whose released contract
      changes.
- [x] Do not manually edit package versions or changelogs.
- [x] Leave publication to post-merge CI.

## Validation

Run focused fixture/package commands while developing. Before handoff, run:

```bash
npm run rush:install
npm run rush:build
npm run rush:lint
node common/scripts/install-run-rush.js test --parallelism 1
node common/scripts/install-run-rush.js verify --parallelism 1
```

Run the dedicated browser command if one is added. If current docs change, also
run:

```bash
npm run site:docusaurus:check
```

Finally run:

```bash
trunk check -a -y
```

The permanent matrix must have no arbitrary sleeps, random completion order,
shared runtime between cases, network dependency, or open handles. Intentional
route-error cases may capture only TanStack's exact development-mode route
boundary warning; every other console message fails the test. Report
unavailable commands or unrelated failures precisely.

## Acceptance Criteria

- [x] Exact tested framework/compiler/tool versions and upstream lifecycle
      meanings are recorded.
- [x] The fixture rejects an unsupported or duplicated Relay graph before
      lifecycle assertions.
- [x] A private non-published Rush fixture exercises the package root.
- [x] TanStack remains private test tooling unless a public boundary is
      explicitly approved.
- [x] A real `RouterProvider`, `RelayEnvironmentProvider`, generated operation,
      default `loadRouteQuery`, and `usePreloadedQuery` path render correct data.
- [x] The lifecycle ledger deterministically records creation, ownership,
      network, routing, rendering, retry, and cleanup transitions.
- [x] Every required matrix row passes under the approved ownership policy.
- [x] Fresh direct entry and actual document reload do not depend on warmed
      Relay or router state.
- [x] Active or cached routes never observe a released reference.
- [x] Superseded work cannot commit after a late response.
- [x] Back/forward and stale revalidation follow one explicit cache policy.
- [x] Unused preloads and evicted matches eventually release owned work.
- [x] Both multi-query completion orders and partial-failure paths are safe.
- [x] Strict Mode introduces no duplicate ownership or premature release.
- [x] Final teardown leaves no owned references, requests, listeners,
      subscriptions, console errors, or open handles.
- [x] No test relies on private Relay fields, undocumented router internals, or
      wall-clock timing.
- [x] Gate A evidence is recorded, and Gate B approval exists before any public
      API/dependency/package change.
- [x] Package/root docs describe the final supported contract and app-owned
      responsibilities.
- [x] Rush and CI wiring execute the permanent matrix deterministically.
- [x] Release metadata matches only the actual public impact.
- [x] Focused, full Rush, docs, browser, and Trunk validation pass or every gap
      is reported.
- [ ] This file is moved to `tasks/completed` only when every applicable item
      is complete.
