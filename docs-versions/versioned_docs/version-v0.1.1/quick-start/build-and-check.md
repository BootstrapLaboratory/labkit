---
title: "Build And Check"
sidebar_label: "Build And Check"
description: "Local checks and production build env validation."
---

Finish the minimal app with local checks and production build validation.

## Server Scripts

Add scripts in `server/package.json`:

```json
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js"
  }
}
```

If you do not use the Nest CLI, replace those with your TypeScript build tool
of choice. Labkit does not require a specific compiler wrapper.

## Webapp Build Env Guard

Use Labkit in `webapp/vite.config.ts`:

```ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { requireProductionBuildEnv } from "@omgjs/labkit-webapp-build-config";

export default defineConfig((configEnv) => {
  const env = loadEnv(configEnv.mode, process.cwd(), "");

  requireProductionBuildEnv({
    appName: "webapp",
    command: configEnv.command,
    env,
    envFilePath: ".env.production",
    requiredEnvNames: ["VITE_GRAPHQL_HTTP", "VITE_GRAPHQL_WS"],
  });

  return {
    plugins: [react()],
  };
});
```

## Root Scripts

```json
{
  "scripts": {
    "dev:server": "npm run dev -w server",
    "dev:webapp": "npm run dev -w webapp",
    "build": "npm run build -w server && npm run build -w webapp"
  }
}
```

## What You Now Own

- GraphQL schema generation and Relay compiler wiring.
- Product DTOs, resolvers, routes, forms, and UI.
- JWT signing secret and password hashing policy.
- Database migration execution.
- Endpoint values for each runtime.
- CORS and cookie alignment for refresh-token transport.
- Redis or another shared pub/sub backend when server subscriptions scale past
  one process.

For a production monorepo, move this shape into Rush and use Rush Delivery or
your app's delivery tooling for validation and deployment.
