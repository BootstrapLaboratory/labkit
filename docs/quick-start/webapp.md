# Webapp

Create browser adapter files over Labkit auth, realtime, and Relay packages.

## `webapp/.env.development`

```dotenv
VITE_GRAPHQL_HTTP=http://localhost:3000/graphql
VITE_GRAPHQL_WS=ws://localhost:3000/graphql
VITE_GRAPHQL_LOG_RECONNECTS=true
VITE_GRAPHQL_RECONNECT_WATCHDOG_MS=30000
```

## `webapp/src/shared/graphql/endpoints.ts`

```ts
const HTTP_CONFIG = import.meta.env.VITE_GRAPHQL_HTTP!;
const WS_CONFIG = import.meta.env.VITE_GRAPHQL_WS!;

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(value);
}

export const HTTP_ENDPOINT = isAbsoluteUrl(HTTP_CONFIG)
  ? HTTP_CONFIG
  : new URL(HTTP_CONFIG, window.location.origin).toString();

export const WS_ENDPOINT = isAbsoluteUrl(WS_CONFIG)
  ? WS_CONFIG
  : new URL(
      WS_CONFIG,
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`,
    ).toString();
```

## `webapp/src/shared/auth/session.ts`

```ts
import { useSyncExternalStore } from "react";
import {
  cookieRefreshTokenTransport,
  createAuthSessionHintStorage,
  createWebappAuthSession,
  type AuthState,
} from "@omgjs/labkit-webapp-auth";

const authSession = createWebappAuthSession({
  refreshTokenTransport: cookieRefreshTokenTransport,
  sessionHintStorage: createAuthSessionHintStorage({
    storageKey: "webapp:auth-session-hint",
  }),
});

export const getAuthState = authSession.getAuthState;
export const getAccessToken = authSession.getAccessToken;
export const setAuthSessionFromPayload = authSession.setAuthSessionFromPayload;
export const clearAuthSession = authSession.clearAuthSession;
export const subscribeAuthState = authSession.subscribeAuthState;

export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribeAuthState, getAuthState, getAuthState);
}
```

## `webapp/src/shared/auth/auth-api.ts`

```ts
import {
  cookieRefreshTokenTransport,
  createWebappAuthGraphqlApi,
  getAuthRequestCredentials,
  hasAuthRequiredGraphqlErrors,
} from "@omgjs/labkit-webapp-auth";
import { HTTP_ENDPOINT } from "../graphql/endpoints";
import { clearAuthSession, setAuthSessionFromPayload } from "./session";

const authApi = createWebappAuthGraphqlApi({
  graphqlEndpoint: HTTP_ENDPOINT,
  refreshTokenTransport: cookieRefreshTokenTransport,
  setAuthSessionFromPayload,
  clearAuthSession,
});

export const refreshStoredAuthSession = authApi.refreshStoredAuthSession;
export const logoutCurrentSession = authApi.logoutCurrentSession;
export const getRelayAuthRequestCredentials = () =>
  getAuthRequestCredentials(cookieRefreshTokenTransport);
export { hasAuthRequiredGraphqlErrors };
```

## `webapp/src/shared/relay/environment.ts`

```ts
import { createWebappRelayEnvironment } from "@omgjs/labkit-webapp-graphql-relay";
import { HTTP_ENDPOINT } from "../graphql/endpoints";
import {
  getRelayAuthRequestCredentials,
  hasAuthRequiredGraphqlErrors,
  refreshStoredAuthSession,
} from "../auth/auth-api";
import { getAccessToken, subscribeAuthState } from "../auth/session";
import { realtimeConnection } from "../realtime/realtime-connection";

export function createRelayEnvironment() {
  return createWebappRelayEnvironment({
    httpEndpoint: HTTP_ENDPOINT,
    auth: {
      getAccessToken,
      subscribeAuthState,
      refreshStoredAuthSession,
      getAuthRequestCredentials: getRelayAuthRequestCredentials,
      hasAuthRequiredGraphqlErrors,
    },
    realtime: realtimeConnection,
  });
}
```

## `webapp/src/App.tsx`

```tsx
import { useMemo } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { createRelayEnvironment } from "./shared/relay/environment";

export function App() {
  const environment = useMemo(() => createRelayEnvironment(), []);

  return (
    <RelayEnvironmentProvider environment={environment}>
      <main>
        <h1>Labkit example</h1>
      </main>
    </RelayEnvironmentProvider>
  );
}
```

Relay operation files and generated artifacts are app-owned. Add them once the
server schema is generated.
