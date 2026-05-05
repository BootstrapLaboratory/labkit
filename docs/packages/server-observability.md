# @omgjs/labkit-server-observability

Structured server logging helpers for Nest/Node runtimes.

## Install

```bash
npm install @omgjs/labkit-server-observability
```

Runtime: server only. Package format: CommonJS.

## Public API Groups

- `logStructuredEvent`.
- `StructuredLogger`, `StructuredLogLevel`, and `StructuredLogDetails`.
- `isVerbosePubSubLoggingEnabled`.
- `isGraphqlSubscriptionLoggingEnabled`.

## Owns

This package owns a safe JSON event envelope and error detail serialization.
It also owns two generic verbose logging flags used by server runtime helpers.

## App Still Owns

The app owns event names, log transport, tracing, metrics, alerting, retention,
and sensitive-data policy outside the event envelope.

## Minimal Usage

```ts
import { Logger } from "@nestjs/common";
import { logStructuredEvent } from "@omgjs/labkit-server-observability";

const logger = new Logger("Bootstrap");

logStructuredEvent(logger, "log", "app_bootstrap_configured", {
  host: "0.0.0.0",
  port: 3000,
});
```

## Runtime Notes

`logStructuredEvent` writes one JSON string through the supplied Nest-like
logger. Error objects are converted into name, message, code, and stack fields
when available.

Package README and source:
[`../../packages/server-observability/README.md`](../../packages/server-observability/README.md),
[`../../packages/server-observability/src/index.ts`](../../packages/server-observability/src/index.ts).
