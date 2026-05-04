# @labkit/auth-contract

`@labkit/auth-contract` contains auth vocabulary that must be shared by server
and browser code without importing framework-specific dependencies.

It is safe to use from NestJS code, Vite/browser code, tests, and other shared
packages.

## Owns

- `Principal` and `AuthPayload` boundary shapes.
- Refresh-token transport names: `cookie` and `response_body`.
- Auth-related GraphQL error codes.
- GraphQL WS authorization connection parameter names.
- Bearer token formatting/parsing helpers.
- GraphQL WS authorization extraction from connection params.

## Does Not Own

- Password hashing.
- JWT signing or verification.
- Refresh-token persistence.
- Nest guards, decorators, or modules.
- React hooks, Relay runtime behavior, or browser storage.

## Usage

```ts
import {
  extractBearerToken,
  extractGraphqlWsAuthorization,
  formatBearerToken,
  isAuthRequiredErrorCode,
  type Principal,
} from "@labkit/auth-contract";

const authorization = formatBearerToken(accessToken);
const token = extractBearerToken(authorization);
```

Server packages use the same constants as browser packages, so websocket auth
params, bearer token handling, and auth-required error checks do not drift.

## Package Format

This package publishes both CommonJS and ESM entry points. Use the package root
import; do not import from `dist`.
