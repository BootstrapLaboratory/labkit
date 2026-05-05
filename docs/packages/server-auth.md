# @omgjs/labkit-server-auth

Server-side auth orchestration for Nest GraphQL applications.

## Install

```bash
npm install @omgjs/labkit-server-auth
```

Runtime: server only. Package format: CommonJS.

## Public API Groups

- `Public`, `Roles`, `CurrentPrincipal`, `GraphqlAuthenticationGuard`, and
  `RolesGuard`.
- identity provider registry, local identity provider, provider capabilities.
- repository interfaces for accounts, roles, refresh sessions, and
  transactions.
- access-token claim/principal helpers.
- refresh-token generation, hashing, state, rotation, revocation, and
  cookie/body transport helpers.
- lifecycle event contracts and dispatcher.
- GraphQL integration and module factories.

## Owns

This package owns reusable auth flow. It defines how identities become
principals, how refresh sessions rotate, how refresh tokens move through
cookie/body transport, and how GraphQL contexts become authenticated.

## App Still Owns

The app owns password hashing, JWT signing, config reader implementation,
persistence adapters, GraphQL DTO/resolver names, lifecycle side effects, and
route/module layout.

## Minimal Usage

```ts
import {
  createIdentityProviderRegistryConfigProvider,
  createServerAuthLocalIdentityProviderProvider,
  createServerAuthRefreshTokenTransportProvider,
  IdentityProviderRegistry,
  IDENTITY_PROVIDERS,
  ServerAuthLocalIdentityProvider,
} from "@omgjs/labkit-server-auth";

@Module({
  providers: [
    IdentityConfigService,
    createIdentityProviderRegistryConfigProvider(IdentityConfigService),
    createServerAuthLocalIdentityProviderProvider({
      configReaderToken: IdentityConfigService,
      passwordHasherToken: PasswordService,
    }),
    createServerAuthRefreshTokenTransportProvider({
      configReaderToken: IdentityConfigService,
    }),
    IdentityProviderRegistry,
    {
      provide: IDENTITY_PROVIDERS,
      useFactory: (local: ServerAuthLocalIdentityProvider) => [local],
      inject: [ServerAuthLocalIdentityProvider],
    },
  ],
})
export class IdentityModule {}
```

## Runtime Notes

Cookie refresh transport requires a GraphQL context with request cookies and a
reply object that supports `setCookie` and `clearCookie`. The reference app
uses Fastify and `@fastify/cookie` for that shape.

Package README and source:
[`../../packages/server-auth/README.md`](../../packages/server-auth/README.md),
[`../../packages/server-auth/src/index.ts`](../../packages/server-auth/src/index.ts).
