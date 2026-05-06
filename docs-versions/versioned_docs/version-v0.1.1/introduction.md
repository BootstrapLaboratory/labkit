---
id: "introduction"
title: "Introduction"
sidebar_label: "Introduction"
description: "What Labkit is for and how the package family fits together."
---

Labkit is a small package family for building high-end TypeScript GraphQL
server/client applications. It captures reusable runtime constraints that are
easy to repeat badly: Nest GraphQL setup, auth contracts, refresh sessions,
TypeORM database manifests, Relay transport, GraphQL websocket reconnects,
browser auth state, theme mechanics, and Vite build validation.

The packages are published under the `@omgjs` npm scope as
`@omgjs/labkit-*`. Each package is intentionally narrow. Applications compose
the pieces they need and keep product-specific behavior in app code.

Labkit was extracted from the
[reference application](https://github.com/BootstrapLaboratory/typescript_monorepo_nestjs_relay_trunk).
That app is
[deployed here](https://bootlab-example-rush-delivery.pages.dev/) and is the
best place to see the whole system assembled.

## What Labkit Is For

Labkit helps when your application has these properties:

- A NestJS GraphQL server owns the schema and runtime auth context.
- A React/Vite webapp consumes the schema through Relay.
- Browser auth uses a memory-only access token and a refresh token transported
  outside JavaScript-readable storage, usually an HttpOnly cookie.
- Realtime features use `graphql-ws` subscriptions and must reconnect cleanly
  when auth changes.
- Server packages need explicit database manifests, migration safety, and
  reusable TypeORM auth persistence.
- The same concepts should be reusable across projects without copying a full
  application.

Labkit does not try to become your application framework. Your app still owns
routes, DTOs, resolvers, generated Relay operations, password hashing choices,
JWT secrets, deployment providers, visual design, and product features.

## Package Groups

| Group | Packages | Purpose |
| --- | --- | --- |
| Shared contracts | `@omgjs/labkit-auth-contract`, `@omgjs/labkit-runtime-config` | Framework-free shapes, protocol constants, and parsing helpers. |
| Server runtime | `@omgjs/labkit-server-config`, `@omgjs/labkit-server-database`, `@omgjs/labkit-server-graphql`, `@omgjs/labkit-server-observability` | Nest, GraphQL, config, logging, PostgreSQL, and TypeORM composition helpers. |
| Server auth | `@omgjs/labkit-server-auth`, `@omgjs/labkit-server-auth-typeorm` | Auth provider orchestration, guards, refresh sessions, token transport, and TypeORM persistence. |
| Browser runtime | `@omgjs/labkit-webapp-auth`, `@omgjs/labkit-webapp-realtime`, `@omgjs/labkit-webapp-graphql-relay`, `@omgjs/labkit-webapp-external-store`, `@omgjs/labkit-webapp-ui` | Auth state, Relay network, websocket reconnects, external-store mechanics, and theme helpers. |
| Tooling | `@omgjs/labkit-webapp-build-config` | Vite production env validation and package-based chunk grouping. |

Start with [Architecture](../architecture) for the boundary model, or go
straight to [Quick Start](../quick-start) for a plain Nest/Vite setup.
