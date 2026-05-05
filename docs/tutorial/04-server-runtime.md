# Server Runtime

The server runtime begins with config, Fastify, cookies, CORS, validation, and
GraphQL module construction.

The reference app uses Fastify because refresh-cookie transport needs reply
objects with `setCookie` and `clearCookie`. Express can work only if the app
adapts the GraphQL context to that transport shape.

## Runtime Layers

1. `@omgjs/labkit-server-config` reads host, port, GraphQL path, CORS, and
   refresh transport choices.
2. `@omgjs/labkit-server-observability` logs structured startup and runtime
   events.
3. `@omgjs/labkit-server-graphql` creates the Nest Apollo module and HTTP/WS
   context.
4. `@omgjs/labkit-server-auth` plugs access-token verification into GraphQL
   context.

The app supplies modules, DTOs, resolvers, and token services.

## Context Rule

Every resolver should be able to answer: is this request anonymous or does it
have a principal? Public routes allow `null`. Protected routes require a
principal through guards or resolver-level checks.
