# @omgjs/labkit-runtime-config

Framework-free parsing helpers for runtime configuration values.

## Install

```bash
npm install @omgjs/labkit-runtime-config
```

Runtime: server and browser. Package format: CommonJS and ESM.

## Public API Groups

- `parseBoolean`.
- `parseNumber`.
- `parseFiniteNumber`.
- `parseList`.
- `NumberParseOptions`.

## Owns

This package owns small, predictable parsing behavior with fallbacks. It parses
values that are passed to it.

## App Still Owns

The application owns where values come from: `process.env`, Nest
`ConfigService`, Vite `import.meta.env`, files, secrets managers, or provider
metadata.

## Minimal Usage

```ts
import {
  parseBoolean,
  parseFiniteNumber,
  parseList,
  parseNumber,
} from "@omgjs/labkit-runtime-config";

const enableLogs = parseBoolean(env.LOG_GRAPHQL_SUBSCRIPTIONS, false);
const port = parseNumber(env.PORT, 3000);
const reconnectMs = parseFiniteNumber(env.RECONNECT_MS, 30000, { min: 0 });
const allowedOrigins = parseList(env.CORS_ORIGIN);
```

## Runtime Notes

`parseFiniteNumber` rejects blank values, non-finite values, and values outside
optional `min`/`max` bounds. When parsing fails, it returns the fallback.

Package README and source:
[`../../packages/runtime-config/README.md`](../../packages/runtime-config/README.md),
[`../../packages/runtime-config/src/index.ts`](../../packages/runtime-config/src/index.ts).
