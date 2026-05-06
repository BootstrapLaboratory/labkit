---
title: "Auth Contract"
sidebar_label: "Auth Contract"
---

Shared auth vocabulary for server and browser code.

## Install

```bash
npm install @omgjs/labkit-auth-contract
```

Runtime: server and browser. Package format: CommonJS and ESM.

## Public API Groups

- `Principal` and `AuthPayload`.
- Refresh-token transport constants: `cookie` and `response_body`.
- GraphQL websocket auth parameter constants.
- Auth-required error code helpers.
- `formatBearerToken`, `extractBearerToken`, and
  `extractGraphqlWsAuthorization`.

## Owns

This package owns the protocol names and boundary shapes that must stay aligned
between server and browser packages. It is deliberately framework-free.

## App Still Owns

The application owns password hashing, JWT signing and verification, refresh
session persistence, guards, React hooks, forms, routes, and generated GraphQL
operations.

## Minimal Usage

```ts
import {
  extractBearerToken,
  extractGraphqlWsAuthorization,
  formatBearerToken,
  isAuthRequiredErrorCode,
  type Principal,
} from "@omgjs/labkit-auth-contract";

const header = formatBearerToken(accessToken);
const token = extractBearerToken(header);
const wsAuthorization = extractGraphqlWsAuthorization(connectionParams);

function hasAuthCode(code: string | null | undefined): boolean {
  return isAuthRequiredErrorCode(code);
}
```

## Runtime Notes

Use this package whenever server and browser code need to agree on auth names
without importing Nest, React, Relay, or TypeORM.

Package README and source:
[`../../packages/auth-contract/README.md`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/auth-contract/README.md),
[`../../packages/auth-contract/src/index.ts`](https://github.com/BootstrapLaboratory/labkit/blob/v0.1.1/packages/auth-contract/src/index.ts).
