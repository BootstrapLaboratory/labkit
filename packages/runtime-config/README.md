# @labkit/runtime-config

`@labkit/runtime-config` contains small, framework-free parsing helpers for
runtime configuration values.

The package deliberately parses values that are passed into it. It does not
read `process.env`, `import.meta.env`, files, or deployment-provider state on
its own.

## Owns

- Boolean parsing.
- Number and finite-number parsing.
- Comma-separated list parsing.
- Consistent fallback handling for blank or missing values.

## Does Not Own

- Environment source selection.
- Required-secret validation.
- Deployment-provider mapping.
- Server or browser framework integration.

## Usage

```ts
import {
  parseBoolean,
  parseFiniteNumber,
  parseList,
} from "@labkit/runtime-config";

const logReconnects = parseBoolean(env.VITE_GRAPHQL_LOG_RECONNECTS, false);
const watchdogMs = parseFiniteNumber(env.VITE_GRAPHQL_RECONNECT_WATCHDOG_MS, {
  fallback: 30_000,
  minimum: 1_000,
});
const allowedOrigins = parseList(env.CORS_ORIGIN);
```

Server packages usually wrap these helpers with a config reader. Browser
packages usually pass Vite values from app-owned adapter files.

## Package Format

This package publishes both CommonJS and ESM entry points. Use the package root
import; do not import from `dist`.
