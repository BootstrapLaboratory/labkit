# @labkit/webapp-build-config

`@labkit/webapp-build-config` contains small, tested helpers for Vite-style
webapp build configuration.

The package is intentionally narrow. It exists to centralize build constraints
that are easy to test outside `vite.config.ts`, while leaving app-specific
plugin selection and output policy in the app.

## Owns

- Production-only required environment validation.
- Actionable missing-env error messages.
- Package-name based module matching for normal and pnpm workspace paths.
- Rolldown/Vite package chunk group creation.

## Does Not Own

- Vite plugin selection.
- Relay compiler configuration.
- Storybook configuration.
- Default vendor chunk policy.
- Deployment-provider variable mapping.
- Server build or migration scripts.

## Usage

```ts
import {
  createPackageModuleChunkGroups,
  requireProductionBuildEnv,
} from "@labkit/webapp-build-config";

const vendorGroups = createPackageModuleChunkGroups([
  {
    name: "react-vendor",
    priority: 30,
    packageNames: ["react", "react-dom"],
  },
]);

requireProductionBuildEnv({
  appName: "webapp",
  command: configEnv.command,
  env: loadEnv(configEnv.mode, __dirname, ""),
  envFilePath: "apps/webapp/.env.production",
  requiredEnvNames: ["VITE_GRAPHQL_HTTP", "VITE_GRAPHQL_WS"],
});
```

Keep `vite.config.ts` as the place where the app declares plugin order, vendor
groups, analyze mode, and local dev-server filesystem access.

## Review Notes

Current review outcome:

- This package should stay limited to production env validation and package
  chunk grouping.
- Browser/shared Labkit packages already publish ESM import entries, so the
  webapp should not need Labkit-specific `optimizeDeps.include` workarounds.
- No server build-tools package is needed until schema or migration scripts are
  reused by another app or become complex enough to test independently.

## Package Format

This package publishes both CommonJS and ESM entry points. Vite should use the
ESM import entry automatically.
