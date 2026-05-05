# GraphQL Contract

The server owns schema generation. The browser owns Relay operations.

Do not make the browser import server DTO classes. DTOs are implementation
details of the Nest process. Relay needs the executable GraphQL schema and
operation text.

## Workflow

1. Server defines DTOs and resolvers.
2. Server generates `schema.graphql`.
3. The schema is committed or published as the app contract.
4. Webapp Relay compiler reads the schema and feature operation files.
5. Webapp imports generated Relay artifacts from its own source tree.

Labkit packages support this workflow without owning the product schema.

## Runtime Context

HTTP GraphQL requests and websocket subscriptions should both resolve a
Labkit-style `Principal | null`. Server auth helpers can verify bearer tokens
for both transports and place the principal in GraphQL context.

This is why the auth contract package is shared, while the server-specific
GraphQL and auth packages stay server-only.
