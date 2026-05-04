# @labkit/server-auth

`@labkit/server-auth` contains server-side auth framework helpers. It owns the
reusable auth concepts, while applications still own product API shape and
security-sensitive adapters.

The package is auth-system oriented rather than persistence-provider oriented:
it exposes storage interfaces and orchestration, then adapter packages such as
`@labkit/server-auth-typeorm` provide concrete repositories.

## Owns

- Public and role metadata decorators.
- GraphQL authentication and roles guards.
- Identity provider capabilities, registry, and provider factory helpers.
- Local identity provider flow with app-supplied password hashing.
- Access-token claim and principal mapping helpers.
- Access-token verifier adapters.
- Refresh-token generation, hashing, expiry, state, rotation, and revocation
  helpers.
- Refresh-token cookie/body transport helpers and Nest provider factory.
- Refresh-session orchestration over app-supplied persistence repositories.
- Auth lifecycle event contracts and dispatcher helpers.
- GraphQL auth integration helpers and Nest module factories.

## Does Not Own

- Password hashing implementation.
- JWT signing secret and concrete token service configuration.
- TypeORM entities or migrations.
- GraphQL DTO classes and resolver field names.
- Lifecycle side effects such as notifications, audit sinks, or risk checks.
- Application route/module layout.

## Typical Server Wiring

```ts
import {
  createIdentityProviderRegistryConfigProvider,
  createServerAuthLocalIdentityProviderProvider,
  createServerAuthRefreshTokenTransportProvider,
} from "@labkit/server-auth";
import { ServerAuthTypeormModule } from "@labkit/server-auth-typeorm";

@Module({
  imports: [ServerAuthTypeormModule],
  providers: [
    createIdentityProviderRegistryConfigProvider(IdentityConfigService),
    createServerAuthLocalIdentityProviderProvider({
      configReaderToken: IdentityConfigService,
      passwordHasherToken: PasswordService,
    }),
    createServerAuthRefreshTokenTransportProvider({
      configReaderToken: IdentityConfigService,
    }),
  ],
})
export class IdentityModule {}
```

For GraphQL setup, prefer the named access-token helper when your app follows
the Labkit access-token service shape:

```ts
createServerAuthAccessTokenGraphqlModule({
  imports: [IdentityModule],
  accessTokenServiceToken: AccessTokenService,
  configReaderToken: ConfigService,
});
```

Use `createServerAuthGraphqlModule` when an app needs a custom factory and more
direct control over the GraphQL integration.

## Extension Model

Applications extend behavior by supplying adapters:

- `ServerAuthPasswordHasher` for password hashing and verification.
- `ServerAuthAccessTokenService` or verifier functions for JWT behavior.
- Repository interfaces for users, identity accounts, roles, refresh sessions,
  and transactions.
- Lifecycle event handlers for logging, notifications, auditing, or custom
  provider side effects.

This keeps Labkit opinionated about auth flow while leaving persistence,
cryptographic configuration, and product events app-owned.

## Package Format

This is a server-only CommonJS package.
