# @omgjs/labkit-server-observability

`@omgjs/labkit-server-observability` contains server-side logging helpers that keep
structured logs consistent and safe to emit.

## Owns

- `logStructuredEvent` for JSON-style Nest logger events.
- Safe error detail serialization.
- Verbose pub/sub and GraphQL subscription logging flag helpers.
- Common structured log level and detail types.

## Does Not Own

- Product-specific event names.
- Log transport configuration outside Nest's logger surface.
- Tracing, metrics, or alerting providers.
- Browser logging.

## Usage

```ts
import { logStructuredEvent } from "@omgjs/labkit-server-observability";

logStructuredEvent(logger, "log", {
  event: "database_config_ready",
  ssl: "enabled",
});
```

Use this package when server code needs a stable event envelope or wants to log
errors without leaking secrets.

## Release Channel

This package is published on npm as part of the Labkit release train. Patch
releases may include documentation-only clarifications, so consumers can update
within the same minor line without expecting runtime API changes.

## Package Format

This is a server-only CommonJS package.
