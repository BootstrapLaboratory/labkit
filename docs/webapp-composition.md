# Webapp Composition

A Labkit-style webapp keeps product code in app folders and isolates Labkit
wiring in small adapter files.

## Adapter Files

A practical browser layout:

```text
src/shared/auth/session.ts
src/shared/auth/auth-api.ts
src/shared/graphql/endpoints.ts
src/shared/realtime/realtime-connection.ts
src/shared/relay/environment.ts
src/shared/theme/theme-store.ts
```

Those files expose stable app names such as `getAccessToken`,
`refreshStoredAuthSession`, `createRelayEnvironment`, and `useAuthState`.
Routes and components import the app adapters, not raw package factories.

## Auth Session

```ts
import { useSyncExternalStore } from "react";
import {
  cookieRefreshTokenTransport,
  createAuthSessionHintStorage,
  createWebappAuthSession,
} from "@omgjs/labkit-webapp-auth";

const authSession = createWebappAuthSession({
  refreshTokenTransport: cookieRefreshTokenTransport,
  sessionHintStorage: createAuthSessionHintStorage({
    storageKey: "webapp:auth-session-hint",
  }),
});

export const getAccessToken = authSession.getAccessToken;
export const getAuthSession = authSession.getAuthSession;
export const subscribeAuthState = authSession.subscribeAuthState;

export function useAuthState() {
  return useSyncExternalStore(
    authSession.subscribeAuthState,
    authSession.getAuthState,
    authSession.getAuthState,
  );
}
```

## Relay Environment

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
```

The `auth` adapter provides access-token reads, auth-state subscription,
auth-session reads, refresh, credentials, and auth-required error checks. The
runtime provides the Relay environment, the realtime instance, and observable
connection state.

## App Providers

At the top of the React tree, create one Relay environment, bootstrap auth
once, and apply theme classes from your app-owned theme adapter.

```tsx
export function AppProviders() {
  const environment = useMemo(() => createRelayEnvironment(), []);

  useEffect(() => {
    void bootstrapAuthSession();
  }, []);

  return (
    <RelayEnvironmentProvider environment={environment}>
      <RouterProvider router={router} />
    </RelayEnvironmentProvider>
  );
}
```

Labkit owns reusable runtime and resource-lifetime mechanics. The app owns
routes, generated operations, product hooks, UI, and visual design.

## Route-Owned Relay Queries

When a TanStack loader creates a Relay query reference that a route component
mounts, use `createRouteQueryLifetime` to bridge loader ownership and mounted
React ownership. Return the lifetime with the references and call
`useRouteQueryLifetime` in the route component. Use one lifetime for all
references created by one loader and call terminal `abort(error)` if
multi-query construction fails partway.

The application still chooses pending/error components, freshness and cache
settings, history behavior, retry UI, and generated operations. The validated
policy replaces retired loader data before render with `defaultGcTime: 0`,
`defaultStaleTime: 0`, and blocking stale reloads. See the
[3.1 Relay upgrade guide](upgrades/webapp-graphql-relay-3.1.md) for complete
loader/component examples and teardown rules.
