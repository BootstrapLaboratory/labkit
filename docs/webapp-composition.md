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
import { createWebappRelayEnvironment } from "@omgjs/labkit-webapp-graphql-relay";
import { realtimeConnection } from "../realtime/realtime-connection";

export function createRelayEnvironment() {
  return createWebappRelayEnvironment({
    httpEndpoint: HTTP_ENDPOINT,
    auth,
    realtime: realtimeConnection,
  });
}
```

The `auth` adapter provides access-token reads, auth-state subscription,
refresh, credentials, and auth-required error checks. The `realtime` instance
provides a stable websocket client and observable connection state.

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

Labkit owns the mechanics. The app owns routes, generated operations, hooks,
UI, and visual design.
