# Quick Start

This path builds the smallest plain Nest/Vite shape that uses Labkit packages.
It does not start from Rush.

For production monorepos, Rush is still recommended. See the
[complete reference implementation](https://bootlab-example-rush-delivery.pages.dev/),
its
[source repository](https://github.com/BootstrapLaboratory/typescript_monorepo_nestjs_relay_trunk),
the [Rush Delivery tutorial](https://bootstraplaboratory.github.io/rush-delivery/docs/tutorial/),
and the [official Rush docs](https://rushjs.io/).

## Target Shape

```text
labkit-example/
  server/
    src/
  webapp/
    src/
```

The result is intentionally small:

- one Nest GraphQL endpoint at `/graphql`;
- one query/mutation/subscription path;
- optional PostgreSQL/TypeORM auth persistence;
- one React/Vite/Relay client;
- memory access token plus HttpOnly refresh cookie flow;
- websocket restart when auth changes;
- enough structure to extend into a real application.

## Create The Workspace

```bash
mkdir labkit-example
cd labkit-example
npm init -y
npm pkg set "workspaces[0]=server" "workspaces[1]=webapp"
mkdir server webapp
npm init -w server -y
npm create vite@latest webapp -- --template react-ts
```

The npm workspace is only for local convenience. It is not a Rush workspace.

## Install Server Packages

```bash
npm install -w server \
  @nestjs/apollo @nestjs/common @nestjs/config @nestjs/core \
  @nestjs/graphql @nestjs/platform-fastify @nestjs/typeorm \
  @apollo/server @fastify/cookie class-transformer class-validator \
  graphql graphql-ws reflect-metadata rxjs typeorm pg

npm install -w server \
  @omgjs/labkit-auth-contract \
  @omgjs/labkit-server-auth \
  @omgjs/labkit-server-auth-typeorm \
  @omgjs/labkit-server-config \
  @omgjs/labkit-server-database \
  @omgjs/labkit-server-graphql \
  @omgjs/labkit-server-observability
```

## Install Browser Packages

```bash
npm install -w webapp \
  graphql graphql-ws \
  react-relay@20.1.1 relay-runtime@20.1.1

npm install -w webapp -D \
  relay-compiler@20.1.1 \
  @types/react-relay@18.2.1 @types/relay-runtime@20.1.1

npm install -w webapp \
  @omgjs/labkit-webapp-auth \
  @omgjs/labkit-webapp-build-config \
  @omgjs/labkit-webapp-external-store \
  @omgjs/labkit-webapp-graphql-relay \
  @omgjs/labkit-webapp-realtime \
  @omgjs/labkit-webapp-ui
```

The two Relay runtime packages are direct, required application peers for
`@omgjs/labkit-webapp-graphql-relay`. Keep the exact `20.1.1` pair together;
the type packages and compiler are development-time tooling, and the compiler
must stay aligned with the runtime that executes its generated artifacts.

After installation, verify that the webapp resolves one pair and reports no
invalid or unmet peer:

```bash
npm ls -w webapp react-relay relay-runtime
```

Do not use force, legacy-peer, alias, or override settings to install a
different pair. Some package-manager modes warn or auto-install instead of
failing, but an unsupported graph is not compatible merely because installation
completed. See the
[Relay package reference](../packages/webapp-graphql-relay.md#required-relay-peers)
for pnpm inspection and migration guidance.

Then continue through the pages in order. Each page gives complete file bodies
for the Labkit adapter files it introduces.
