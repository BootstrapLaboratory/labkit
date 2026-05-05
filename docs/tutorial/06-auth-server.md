# Auth Server

Server auth has reusable flow and app-owned adapters.

## Reusable Flow

Labkit owns:

- identity provider registry;
- local identity provider behavior;
- repository interfaces;
- refresh-session creation, rotation, and revocation;
- refresh-token hashing and expiry;
- cookie/body refresh transport;
- auth lifecycle event contracts;
- GraphQL guards and module helpers.

## App Adapters

The app supplies:

- `PasswordService`;
- `AccessTokenService`;
- `IdentityConfigService`;
- TypeORM or custom repositories;
- GraphQL DTOs and resolver methods;
- lifecycle handlers.

The local provider normalizes email subjects, verifies password hashes, creates
accounts, and attaches default roles. The access-token service signs the
principal plus session id into a short-lived JWT.

## Resolver Shape

Expose product GraphQL fields such as `login`, `register`, `refresh`, and
`logout`. Inside those resolvers, delegate the repeated mechanics to Labkit
services and app-owned orchestration services.
