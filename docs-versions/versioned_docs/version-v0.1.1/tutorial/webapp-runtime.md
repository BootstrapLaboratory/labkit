---
title: "Webapp Runtime"
sidebar_label: "Webapp Runtime"
---

The webapp wraps Labkit factories in app-owned adapter files.

## Adapter Stack

```text
auth/session.ts      -> createWebappAuthSession
auth/auth-api.ts     -> createWebappAuthGraphqlApi
graphql/endpoints.ts -> Vite endpoint resolution
realtime/*           -> createWebappRealtimeConnection
relay/environment.ts -> createWebappRelayEnvironment
theme/*              -> createWebappThemeController
```

Routes and components import those adapters. This keeps product code insulated
from package factory details and gives the app stable names for testing.

## Provider Stack

At the React root:

- create one Relay environment;
- create the router with that environment in context;
- bootstrap auth once;
- apply the selected theme class;
- render product routes.

The original webapp follows this shape in `apps/webapp/src/app/AppProviders.tsx`.
