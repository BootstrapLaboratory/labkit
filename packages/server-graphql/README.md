# @omgjs/labkit-server-graphql

`@omgjs/labkit-server-graphql` contains Nest GraphQL setup helpers and reusable
GraphQL runtime constraints.

## Owns

- GraphQL HTTP and websocket context creation helpers.
- GraphQL WS connection lifecycle payload helpers.
- Subscription authentication extraction integration.
- Apollo/Nest module factory helpers.
- Query complexity plugin.
- Request logging plugin.
- Date scalar.
- Upper-case schema directive.

## Does Not Own

- Product resolvers.
- Product DTOs and generated schema content.
- Access-token verification policy.
- Auth provider implementation.
- Database access.

## Usage

Most apps consume this package through `@omgjs/labkit-server-auth`, which layers auth
integration on top:

```ts
import { createServerAuthAccessTokenGraphqlModule } from "@omgjs/labkit-server-auth";

createServerAuthAccessTokenGraphqlModule({
  imports: [IdentityModule],
  accessTokenServiceToken: AccessTokenService,
  configReaderToken: ConfigService,
});
```

Use `createServerGraphqlModule` directly when a server app wants to provide its
own principal resolution and GraphQL auth integration without the server-auth
adapter.

## Release Channel

This package is published on npm as part of the Labkit release train. Patch
releases may include documentation-only clarifications, so consumers can update
within the same minor line without expecting runtime API changes.

## Package Format

This is a server-only CommonJS package.
