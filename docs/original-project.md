# Original Project

Labkit was extracted from the Anonymous Chat reference application:

- Deployed app: [Anonymous Chat](https://bootlab-example-rush-delivery.pages.dev/)
- Source repository:
  [typescript_monorepo_nestjs_relay_trunk](https://github.com/BootstrapLaboratory/typescript_monorepo_nestjs_relay_trunk)

That repository is the complete reference implementation for the concepts in
these docs. Labkit keeps the reusable pieces; the reference app keeps product
behavior and deployment-specific decisions.

## Server Reference Paths

Useful server paths in the original repository:

- `apps/server/src/app.module.ts`: composes Nest config, GraphQL, TypeORM, chat,
  identity, and access-control modules.
- `apps/server/src/main.ts`: Fastify bootstrap, cookie support, CORS, validation
  pipe, structured bootstrap logs, and runtime host/port/path reads.
- `apps/server/src/config/database.config.ts`: app-owned TypeORM options that
  compose Labkit database manifests.
- `apps/server/src/modules/identity`: GraphQL auth resolver, local identity
  provider wiring, token service, session service, password hashing, and
  lifecycle events.
- `apps/server/src/modules/chat`: product feature entities, resolver, pub/sub,
  and database manifest.
- `apps/server/src/scripts/generate-schema.ts`: server-owned GraphQL schema
  generation.

## Webapp Reference Paths

Useful browser paths in the original repository:

- `apps/webapp/src/app/AppProviders.tsx`: Relay environment provider, router,
  auth boot, and theme class application.
- `apps/webapp/src/shared/auth`: app-owned adapter files over
  `@omgjs/labkit-webapp-auth`.
- `apps/webapp/src/shared/graphql/endpoints.ts`: Vite endpoint resolution.
- `apps/webapp/src/shared/realtime/realtime-connection.ts`: app wrapper over
  Labkit realtime connection state.
- `apps/webapp/src/shared/relay/environment.ts`: app wrapper over Labkit Relay
  environment creation.
- `apps/webapp/src/ui`: product-owned components and theme values.
- `apps/webapp/src/features/chat/relay`: generated Relay operation sources for
  the product feature.

## What To Copy

Copy the shape, not the product. Good reusable lessons from the reference app:

- keep GraphQL schema generation server-owned;
- keep generated Relay artifacts browser-owned;
- keep auth access tokens in memory;
- transport refresh tokens through HttpOnly cookies by default;
- restart websocket clients when auth changes;
- compose TypeORM manifests from feature packages;
- keep product UI outside Labkit.

Do not copy provider deployment details into Labkit docs. Deployment belongs to
the application and Rush Delivery documentation. Link out when deployment
context helps explain a runtime constraint.
