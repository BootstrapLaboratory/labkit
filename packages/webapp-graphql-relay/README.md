# @omgjs/labkit-webapp-graphql-relay

`@omgjs/labkit-webapp-graphql-relay` contains Relay runtime helpers for
auth-aware GraphQL HTTP requests, GraphQL WS subscriptions, route preloading,
and Relay store maintenance.

## Install

Install the package and its required Relay peers directly in the application:

```bash
npm install \
  @omgjs/labkit-webapp-graphql-relay \
  react-relay@20.1.1 \
  relay-runtime@20.1.1
```

The supported runtime pair is exactly `react-relay@20.1.1` and
`relay-runtime@20.1.1`. Both packages are application-owned, required peers.
Do not mix versions or substitute another Relay release, even when the package
manager completes the install with only a warning.

Applications that compile Relay operations or TypeScript can use the
repository-validated development-tooling set:

```bash
npm install --save-dev \
  relay-compiler@20.1.1 \
  @types/react-relay@18.2.1 \
  @types/relay-runtime@20.1.1
```

`relay-compiler` and the type packages are development tools, not runtime
peers. Keep the compiler aligned with the runtime pair so generated artifacts
match the runtime that executes them.

## Relay Runtime Contract

Labkit-created environments and preloaded query references are consumed by the
application's `RelayEnvironmentProvider`, hooks, and Relay imports. All of
those boundaries must resolve one canonical installation of each required
Relay package. Labkit does not support a private or nested Relay runtime.

Inspect the installed graph after installation or a lockfile update:

```bash
npm ls react-relay relay-runtime
# pnpm consumers:
pnpm why --recursive react-relay relay-runtime
```

The graph must contain only the matched `20.1.1` pair, with no `invalid`, unmet,
or nested copy under Labkit. Peer metadata describes the supported contract,
but package-manager settings can weaken its diagnostics. Auto-installation,
warning-only modes, `--force`, `--legacy-peer-deps`, aliases, and overrides do
not make another graph supported.

When upgrading from Labkit 2.x, add both exact Relay packages as direct
dependencies, align the compiler and types shown above, remove Relay aliases or
deduplication overrides used as workarounds, reinstall with the normal package
manager mode, and inspect the graph before building the application. See the
[package reference](../../docs/packages/webapp-graphql-relay.md#migrating-from-2x)
for the complete migration checklist.

## Owns

- Relay environment factory.
- Auth-aware Relay fetch with one refresh retry for non-auth operations.
- Auth-aware GraphQL WS connection-params creation.
- Default Relay runtime that composes Relay, auth, and realtime recovery.
- Relay subscribe function integration.
- Default realtime runtime creation when only websocket options are provided.
- Realtime client termination after auth-token changes.
- Realtime connection-state access for UI.
- Route-query lifetime ownership across loader abort, mounted React consumers,
  Suspense replacement, and final disposal.
- Root-field store updater helper.
- Unauthorized GraphQL response helper.

## Does Not Own

- Vite endpoint environment variables.
- Generated Relay operation types.
- Product route files.
- Product auth session implementation.
- GraphQL server schema.

## Usage

Use `DefaultWebappRelayRuntime` for the normal production path. It creates the
Relay environment and realtime runtime together, refreshes expiring auth before
websocket reconnects, and exposes the same realtime state that product UI can
display.

```ts
import { DefaultWebappRelayRuntime } from "@omgjs/labkit-webapp-graphql-relay";

export const relayRuntime = new DefaultWebappRelayRuntime({
  httpEndpoint: HTTP_ENDPOINT,
  wsEndpoint: WS_ENDPOINT,
  auth,
});

export function createRelayEnvironment() {
  return relayRuntime.getEnvironment();
}

export const realtime = relayRuntime.getRealtime();
export const getRealtimeConnectionState =
  relayRuntime.getRealtimeConnectionState;
export const subscribeToRealtimeConnectionState =
  relayRuntime.subscribeToRealtimeConnectionState;
```

The auth adapter must include `getAuthSession()` so Labkit can refresh an
expiring access token before websocket reconnects.

Advanced applications can still provide their own realtime adapter to
`createWebappRelayEnvironment` or use
`createAuthAwareRelayGraphqlWsConnectionParams` directly when replacing only one
runtime policy.

For TanStack Router loaders whose query reference is consumed by a mounted
route, create one lifetime per loader invocation and mount that lifetime in the
route component:

```tsx
import {
  createRouteQueryLifetime,
  loadRouteQuery,
  useRouteQueryLifetime,
} from "@omgjs/labkit-webapp-graphql-relay";
import { usePreloadedQuery } from "react-relay";

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "chat",
  pendingComponent: ChatPending,
  loader: ({ abortController, context }) => {
    const queryLifetime = createRouteQueryLifetime({
      routeAbortSignal: abortController.signal,
    });

    try {
      return {
        queryLifetime,
        queryRef: loadRouteQuery({
          environment: context.relayEnvironment,
          lifetime: queryLifetime,
          query: ChatPageQuery,
          variables: {},
        }),
      };
    } catch (error) {
      queryLifetime.abort(error);
      throw error;
    }
  },
  component: ChatRoute,
});

function ChatRoute() {
  const { queryLifetime, queryRef } = chatRoute.useLoaderData();
  useRouteQueryLifetime(queryLifetime);
  const data = usePreloadedQuery(ChatPageQuery, queryRef);

  return <ChatPage data={data} />;
}
```

Pass the same lifetime to every query reference created by the same loader. A
router abort releases loader ownership; mounted ownership keeps the reference
usable until replacement commits and the route unmounts. The raw
`abortSignal` option remains as a deprecated compatibility path only for work
that can never become a mounted React resource; do not supply it together with
`lifetime`. Call `queryLifetime.abort(error)` when multi-query construction
fails partway.

The validated TanStack policy uses an explicit pending component,
`defaultGcTime: 0`, `defaultStaleTime: 0`, and blocking stale reloads so retired
loader data is replaced before render. See the
[3.1 upgrade guide](../../docs/upgrades/webapp-graphql-relay-3.1.md) for
single-query and multi-query migration, preload/history/retry behavior, Strict
Mode, and teardown.

Endpoint resolution intentionally remains app-owned until another browser app
needs the same Vite URL policy.

## Release Channel

This package is published on npm as part of the Labkit release train. Breaking
public API changes are released in a new package version with matching docs.

## Package Format

This package publishes both CommonJS and ESM entry points. Browser bundlers
should use the ESM import entry automatically.
