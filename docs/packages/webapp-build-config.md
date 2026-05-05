# @omgjs/labkit-webapp-build-config

Vite build configuration helpers for production environment validation and
package chunk grouping.

## Install

```bash
npm install -D @omgjs/labkit-webapp-build-config
```

Runtime: Vite config/tooling. Package format: CommonJS and ESM.

## Public API Groups

- `getMissingEnvNames`.
- `requireProductionBuildEnv`.
- `isPackageModule`.
- `createPackageModuleChunkGroups`.
- build env and chunk group types.

## Owns

This package owns small testable build constraints: fail production builds when
required env values are missing, and create package-name based chunk groups for
normal and pnpm module paths.

## App Still Owns

The app owns Vite plugin selection, Relay compiler config, Storybook config,
default vendor chunk strategy, analyze mode, deployment provider variable
mapping, and server build scripts.

## Minimal Usage

```ts
import {
  createPackageModuleChunkGroups,
  requireProductionBuildEnv,
} from "@omgjs/labkit-webapp-build-config";

requireProductionBuildEnv({
  appName: "webapp",
  command: configEnv.command,
  env: loadEnv(configEnv.mode, process.cwd(), ""),
  envFilePath: ".env.production",
  requiredEnvNames: ["VITE_GRAPHQL_HTTP", "VITE_GRAPHQL_WS"],
});

const chunks = createPackageModuleChunkGroups([
  {
    name: "react-vendor",
    packageNames: ["react", "react-dom"],
    priority: 30,
  },
]);
```

## Runtime Notes

This package runs at build configuration time. It does not read deployment
provider metadata or modify runtime server behavior.

Package README and source:
[`../../packages/webapp-build-config/README.md`](../../packages/webapp-build-config/README.md),
[`../../packages/webapp-build-config/src/index.ts`](../../packages/webapp-build-config/src/index.ts).
