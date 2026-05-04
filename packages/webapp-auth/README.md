# @omgjs/labkit-webapp-auth

`@omgjs/labkit-webapp-auth` contains browser auth runtime helpers for applications
that use short-lived access tokens and refresh-token transport handled outside
normal JavaScript-accessible storage.

The default transport is an HttpOnly refresh cookie, while response-body
transport remains available for environments that deliberately choose it.

## Owns

- Memory-only auth session store.
- Non-secret session hint storage.
- Refresh-token transport strategies.
- Auth request credential policy.
- Auth GraphQL API helper for refresh/logout mutations.
- Auth-required GraphQL error parsing.
- Auth API error creation.
- Auth session bootstrap orchestration.
- Principal display-name and navigation-state helpers.

## Does Not Own

- Generated Relay mutation artifacts.
- Product auth forms.
- React route guards.
- Endpoint selection.
- Storage keys chosen by the app.
- Server auth policy.

## Usage

```ts
import {
  cookieRefreshTokenTransport,
  createWebappAuthGraphqlApi,
  createWebappAuthSession,
} from "@omgjs/labkit-webapp-auth";

export const authSession = createWebappAuthSession({
  refreshTokenTransport: cookieRefreshTokenTransport,
});

const authApi = createWebappAuthGraphqlApi({
  graphqlEndpoint: "/graphql",
  refreshTokenTransport: cookieRefreshTokenTransport,
  setAuthSessionFromPayload: authSession.setAuthSessionFromPayload,
  clearAuthSession: authSession.clearAuthSession,
});
```

App-owned adapter files usually export stable names such as `getAccessToken`,
`setAuthSession`, `refreshStoredAuthSession`, and React hooks. Labkit provides
the store and policy; the app decides how routes and components use it.

## Package Format

This package publishes both CommonJS and ESM entry points. Browser bundlers
should use the ESM import entry automatically.
