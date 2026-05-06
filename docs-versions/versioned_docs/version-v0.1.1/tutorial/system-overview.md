---
title: "System Overview"
sidebar_label: "System Overview"
---

A Labkit application has three contracts:

- server runtime contract: Nest GraphQL, auth, config, database, logging;
- browser runtime contract: Relay, auth state, realtime, theme, routes;
- GraphQL contract: generated schema plus browser-owned Relay operations.

The server and browser never import each other's implementation files. They
meet at GraphQL.

## Ownership Map

| Area | Labkit owns | App owns |
| --- | --- | --- |
| Auth contract | principal/payload shapes, bearer helpers, websocket auth names | business auth policy |
| Server auth | provider contracts, guards, sessions, transport helpers | password hasher, JWT service, resolvers |
| Database | config parsing, manifests, migration safety | DataSource, feature entities, migration execution |
| GraphQL | Nest module/context helpers | DTOs, resolvers, schema publishing |
| Relay | network, subscription, route preload helpers | generated operations and route files |
| Realtime | reconnect/watchdog state | pub/sub backend and UI |
| UI | theme mechanics, class helper | components, tokens, visual design |

The reference app demonstrates this split with `apps/server`, `apps/webapp`,
and a generated GraphQL contract package. Labkit extracts the reusable parts so
new apps can start from the same constraints.
