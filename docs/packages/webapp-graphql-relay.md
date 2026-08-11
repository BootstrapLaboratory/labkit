# @omgjs/labkit-webapp-graphql-relay

Relay runtime helpers for auth-aware GraphQL HTTP requests, subscriptions, and
route query loading.

## Install

```bash
npm install \
  @omgjs/labkit-webapp-graphql-relay \
  react-relay@20.1.1 \
  relay-runtime@20.1.1

npm install --save-dev \
  relay-compiler@20.1.1 \
  @types/react-relay@18.2.1 \
  @types/relay-runtime@20.1.1
```

Runtime: browser/Relay. Package format: CommonJS and ESM.

## Required Relay Peers

The application must directly install this exact supported runtime pair:

| Package         | Supported version | Ownership                 |
| --------------- | ----------------- | ------------------------- |
| `react-relay`   | `20.1.1`          | Required application peer |
| `relay-runtime` | `20.1.1`          | Required application peer |

Labkit creates Relay environments and preloaded query references; the
application supplies `RelayEnvironmentProvider`, hooks, generated operations,
and other Relay imports. These surfaces must resolve one canonical installation
of each Relay package. A different version, a mixed pair, or a private nested
copy is outside the supported contract even if it appears to work.

The Relay packages are required peers because Labkit imports both at runtime.
They are not optional integrations. The exact versions also express that
`react-relay` and `relay-runtime` must be selected as a coherent pair rather
than as two independently compatible ranges.

### Compiler and Type Packages

`relay-compiler`, `@types/react-relay`, and `@types/relay-runtime` are
application development tools, not Labkit runtime peers. The validated set is:

| Package                | Version  | Purpose                          |
| ---------------------- | -------- | -------------------------------- |
| `relay-compiler`       | `20.1.1` | Generate aligned Relay artifacts |
| `@types/react-relay`   | `18.2.1` | React Relay declarations         |
| `@types/relay-runtime` | `20.1.1` | Relay Runtime declarations       |

Pin these versions in TypeScript Relay applications. In particular, keep the
compiler on `20.1.1` so generated artifacts target the runtime that consumes
them.

### Package-Manager Diagnostics

Required exact peers communicate the supported graph, but not every package
manager mode rejects a missing or invalid peer. Depending on configuration,
npm or pnpm can auto-install a peer, emit only a warning, or allow an override.
An install that succeeds with a peer warning does not establish compatibility.

Do not use `--force`, `--legacy-peer-deps`, aliases, overrides, or forced
hoisting to admit another Relay pair. After installation or any lockfile
change, inspect the dependency graph from the application root:

```bash
npm ls react-relay relay-runtime
# pnpm consumers:
pnpm why --recursive react-relay relay-runtime
```

Both commands should report only `react-relay@20.1.1` and
`relay-runtime@20.1.1`. There must be no `invalid` or unmet peer, mixed version,
or Relay installation nested under `@omgjs/labkit-webapp-graphql-relay`. Also
run the application's typecheck and production build so its TypeScript and
bundler graphs are checked.

## Migrating from 2.x

Labkit 2.x could install its own Relay dependencies while the application used
another Relay graph. The new contract makes the application responsible for
the one supported pair.

To migrate:

1. Add `react-relay@20.1.1` and `relay-runtime@20.1.1` as direct application
   dependencies. If the application currently selects another Relay release,
   align it to this pair before upgrading Labkit.
2. Pin `relay-compiler@20.1.1`, `@types/react-relay@18.2.1`, and
   `@types/relay-runtime@20.1.1` as development dependencies where the
   application generates operations and typechecks Relay code.
3. Remove temporary Relay aliases, overrides, or deduplication rules that were
   introduced to work around separate application and Labkit runtimes.
4. Run the normal package-manager install so the lockfile records the direct
   peers. Do not bypass peer validation with force or legacy-peer modes.
5. Inspect the graph with the commands above, then run the application
   typecheck, Relay compilation, production build, and provider/hook tests.

If the application cannot use the exact supported pair, do not suppress the
peer diagnostic. That Relay combination is not a compatibility target for this
release.

## Public API Groups

- auth and realtime adapter types;
- `createAuthAwareRelayFetchFunction`;
- `createAuthAwareRelayGraphqlWsConnectionParams`;
- `createRelayGraphqlWsConnectionParams`;
- `createRelaySubscribeFunction`;
- `DefaultWebappRelayRuntime`;
- `createWebappRelayEnvironment`;
- `createWebappRelayRealtimeClient`;
- `terminateRealtimeClientOnAuthTokenChange`;
- `loadRouteQuery`;
- `appendRootFieldRecordIfMissing`.

## Owns

This package owns the Relay network mechanics: bearer auth headers, one refresh
retry for non-auth operations, auth-aware websocket connection params,
websocket subscription integration, auth-token change socket termination, route
preload disposal, and a small store updater.

The recommended default is `DefaultWebappRelayRuntime`, which composes the Relay
environment and Labkit realtime runtime so websocket recovery can refresh auth
before reconnecting and product UI can monitor the same runtime.

## App Still Owns

The app owns endpoint values, generated Relay operation files, route loaders,
auth session implementation, GraphQL schema, and product store update policy.

## Recommended Usage

Use one runtime for Relay and realtime state:

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

export function subscribeToRealtimeConnectionState(listener) {
  return relayRuntime.subscribeToRealtimeConnectionState(listener);
}
```

The auth adapter must provide `getAuthSession()` in addition to access-token
reads, auth-state subscription, refresh, credentials, and GraphQL auth-error
detection. Labkit uses the session expiry to refresh before websocket reconnects
instead of reconnecting with a stale bearer token.

For lower-level composition, pass an explicit realtime adapter:

```ts
import { DefaultWebappRealtimeConnection } from "@omgjs/labkit-webapp-realtime";
import {
  createAuthAwareRelayGraphqlWsConnectionParams,
  createWebappRelayEnvironment,
} from "@omgjs/labkit-webapp-graphql-relay";

const realtime = new DefaultWebappRealtimeConnection({
  wsEndpoint: WS_ENDPOINT,
  connectionParams: createAuthAwareRelayGraphqlWsConnectionParams({ auth }),
});

export function createRelayEnvironment() {
  return createWebappRelayEnvironment({
    httpEndpoint: HTTP_ENDPOINT,
    auth,
    realtime,
  });
}
```

## Runtime Notes

The default auth operation names are `LoginMutation`, `RegisterMutation`,
`RefreshMutation`, and `LogoutMutation`. Override `authOperationNames` if your
generated operation names differ.

Package README and source:
[`../../packages/webapp-graphql-relay/README.md`](../../packages/webapp-graphql-relay/README.md),
[`../../packages/webapp-graphql-relay/src/index.ts`](../../packages/webapp-graphql-relay/src/index.ts).
