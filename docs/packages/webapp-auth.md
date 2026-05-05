# @omgjs/labkit-webapp-auth

Browser auth session helpers for memory access tokens and refresh/logout
flows.

## Install

```bash
npm install @omgjs/labkit-webapp-auth
```

Runtime: browser. Package format: CommonJS and ESM.

## Public API Groups

- auth state, session, hint, and transport types;
- `cookieRefreshTokenTransport`;
- `createAuthSessionHintStorage`;
- `createWebappAuthSession`;
- `createWebappAuthGraphqlApi`;
- `createWebappAuthSessionBootstrap`;
- auth-required GraphQL error helpers;
- `getPrincipalDisplayName` and
  `shouldShowAuthenticatedNavigation`.

## Owns

This package owns browser session mechanics: memory access token storage,
non-secret session hints, refresh/logout GraphQL requests, auth-required error
detection, and bootstrap de-duplication.

## App Still Owns

The app owns generated Relay mutations, forms, route guards, endpoint
resolution, React hooks, storage keys, and server auth policy.

## Minimal Usage

```ts
import {
  cookieRefreshTokenTransport,
  createAuthSessionHintStorage,
  createWebappAuthGraphqlApi,
  createWebappAuthSession,
} from "@omgjs/labkit-webapp-auth";

const authSession = createWebappAuthSession({
  refreshTokenTransport: cookieRefreshTokenTransport,
  sessionHintStorage: createAuthSessionHintStorage({
    storageKey: "webapp:auth-session-hint",
  }),
});

const authApi = createWebappAuthGraphqlApi({
  graphqlEndpoint: "/graphql",
  refreshTokenTransport: cookieRefreshTokenTransport,
  setAuthSessionFromPayload: authSession.setAuthSessionFromPayload,
  clearAuthSession: authSession.clearAuthSession,
});
```

## Runtime Notes

The session hint is not a secret. It only lets the browser show "unknown but
probably authenticated" UI while boot refresh is pending.

Package README and source:
[`../../packages/webapp-auth/README.md`](../../packages/webapp-auth/README.md),
[`../../packages/webapp-auth/src/index.ts`](../../packages/webapp-auth/src/index.ts).
