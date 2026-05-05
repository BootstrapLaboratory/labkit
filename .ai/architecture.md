# AI Architecture Notes

Labkit is a Rush-managed TypeScript package library extracted from server and
webapp code. The architecture goal is to keep reusable framework concerns in
small packages while leaving product-specific choices in consuming
applications.

## Core Shape

The repository has four main layers:

- Rush workspace metadata in [`../rush.json`](../rush.json) and
  [`../common/config/rush`](../common/config/rush).
- Public package APIs under [`../packages`](../packages).
- Shared, server, browser, and tooling package groups.
- CI and release configuration under [`../.github/workflows`](../.github/workflows)
  and [`../.dagger/release`](../.dagger/release).

## Package Groups

Shared packages sit at the bottom and must be safe for both server and browser
code:

- `@omgjs/labkit-runtime-config`
- `@omgjs/labkit-auth-contract`

Server packages may depend on shared packages and server frameworks:

- `@omgjs/labkit-server-config`
- `@omgjs/labkit-server-database`
- `@omgjs/labkit-server-graphql`
- `@omgjs/labkit-server-auth`
- `@omgjs/labkit-server-auth-typeorm`
- `@omgjs/labkit-server-observability`

Browser packages may depend on shared packages and browser frameworks:

- `@omgjs/labkit-webapp-external-store`
- `@omgjs/labkit-webapp-auth`
- `@omgjs/labkit-webapp-realtime`
- `@omgjs/labkit-webapp-graphql-relay`
- `@omgjs/labkit-webapp-ui`
- `@omgjs/labkit-webapp-build-config`

Tooling packages are repository support and do not publish as public Labkit
runtime libraries.

## Boundary Rules

Shared packages must not depend on NestJS, TypeORM, React, Relay, Vite, or
browser-only globals.

Server packages must not depend on browser packages. Browser packages must not
depend on server packages.

Applications may depend on Labkit packages; Labkit packages must not import from
application packages.

Labkit owns reusable policy and adapters. Applications own product API shape,
environment variable names, generated operations, concrete UI components,
concrete themes, migrations execution, and lifecycle side effects.

## Public API And Format

Package READMEs are part of the public contract. When a public export changes,
update the package README and any root documentation that describes the
package.

Browser-consumed and shared packages publish dual CommonJS/ESM entry points.
Server-only packages currently publish CommonJS output only.

Keep concrete app dependencies out of Labkit packages unless the dependency is
part of the reusable package contract.

## CI And Release

Pull requests run direct Rush validation:

- `rush install`
- `rush change --verify`
- `rush build`
- `rush lint`
- `rush test`
- `rush verify`

Package release uses `BootstrapLaboratory/rush-delivery@v0.6.6` through
[`../.github/workflows/package-release.yaml`](../.github/workflows/package-release.yaml)
with the `release-packages` entrypoint and
[`../.dagger/release/npm.yaml`](../.dagger/release/npm.yaml).

Treat Rush Delivery as an external CI release engine for this repository. Its
Dagger framework architecture, deploy-target model, and provider-adapter
patterns are not Labkit architecture.

## Invariants

Public package APIs must stay intentional and documented.

Dependency direction must keep shared, server, browser, and application
ownership separate.

Rush owns package graph, change verification, versioning, and publish lifecycle
commands. Rush Delivery only invokes the package release path in CI.

Completed task files are archives. Do not edit files under `tasks/completed`;
create a new task file for follow-up work.

Documentation should describe public contracts and architecture, not line-by-line
implementation details.
