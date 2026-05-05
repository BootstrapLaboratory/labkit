# Auth And Sessions

Labkit auth is built around a small shared contract and runtime-specific
adapters.

The server issues short-lived access tokens and long-lived refresh sessions.
The browser stores the access token only in memory. Refresh tokens are
transported outside normal JavaScript-readable storage, usually as HttpOnly
cookies.

## Shared Contract

`@omgjs/labkit-auth-contract` defines:

- `Principal`: the authenticated actor shape used by server and browser code;
- `AuthPayload`: access token, expiry timestamps, optional refresh token, and
  principal;
- refresh-token transport names: `cookie` and `response_body`;
- GraphQL websocket auth parameter names;
- bearer token formatting and parsing helpers;
- auth-required GraphQL error codes.

That shared vocabulary keeps server and browser auth behavior aligned without
making either side import framework-specific code from the other.

## Server Runtime

`@omgjs/labkit-server-auth` owns the reusable server auth flow:

- public and role metadata decorators;
- GraphQL authentication and role guards;
- identity provider registry and local provider flow;
- access-token claim/principal mapping;
- refresh token generation, hashing, rotation, revocation, and expiry state;
- refresh-token cookie/body transport helpers;
- lifecycle event contracts and dispatcher helpers;
- GraphQL module integration helpers.

The app supplies the sensitive adapters: password hasher, access-token signing
service, config reader, persistence repositories, lifecycle handlers, and
GraphQL DTO/resolver names.

## Browser Runtime

`@omgjs/labkit-webapp-auth` owns the reusable browser auth flow:

- memory-only `AuthSession` store;
- non-secret session hint storage;
- refresh/logout GraphQL API helpers;
- auth-required GraphQL error parsing;
- auth request credential policy;
- auth boot orchestration.

The app wraps this with React hooks, route guards, forms, generated Relay
mutations, and endpoint selection.

## Cookie Refresh Transport

The default browser strategy is `cookieRefreshTokenTransport`. It sends
refresh/logout requests with `credentials: "include"` and passes no explicit
refresh token in the GraphQL input.

For this to work, the server must align:

- refresh cookie path;
- cookie `SameSite`;
- cookie `Secure`;
- CORS `origin`;
- CORS `credentials`;
- GraphQL HTTP path.

`@omgjs/labkit-server-config` derives CORS credentials from the refresh-token
transport so cookie transport does not silently drop browser cookies.

## Response Body Transport

`response_body` transport exists for environments that deliberately choose to
return refresh tokens in GraphQL payloads. It is not the recommended browser
default. If an app uses it, the app owns storage and clearing behavior because
JavaScript can see the token.

## Realtime Auth

GraphQL websocket auth is connection-scoped. When the browser access token
changes, the current websocket client must terminate so the next connection
uses fresh connection params. Labkit's Relay helper handles that termination
when wired to the auth session.
