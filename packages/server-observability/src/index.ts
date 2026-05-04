import { parseBoolean } from "@labkit/runtime-config";

export type StructuredLogLevel = "log" | "warn" | "error";
export type StructuredLogDetails = Record<string, unknown>;

export type StructuredLogger = {
  error(message: string): void;
  log(message: string): void;
  warn(message: string): void;
};

function getVerboseLoggingFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

function getErrorDetails(error: unknown): StructuredLogDetails {
  if (error instanceof Error) {
    const details: StructuredLogDetails = {
      errorName: error.name,
      errorMessage: error.message,
    };

    if ("code" in error) {
      const errorCode = (
        error as Error & {
          code?: unknown;
        }
      ).code;

      if (typeof errorCode === "string" || typeof errorCode === "number") {
        details.errorCode = errorCode;
      }
    }

    if (error.stack) {
      details.errorStack = error.stack;
    }

    return details;
  }

  if (typeof error === "object" && error !== null) {
    const details: StructuredLogDetails = {};
    const name: unknown = Reflect.get(error, "name");
    const message: unknown = Reflect.get(error, "message");
    const code: unknown = Reflect.get(error, "code");
    const stack: unknown = Reflect.get(error, "stack");

    if (typeof name === "string") {
      details.errorName = name;
    }

    if (typeof message === "string") {
      details.errorMessage = message;
    }

    if (typeof code === "string" || typeof code === "number") {
      details.errorCode = code;
    }

    if (typeof stack === "string") {
      details.errorStack = stack;
    }

    if (Object.keys(details).length > 0) {
      return details;
    }
  }

  return {
    errorMessage: String(error),
  };
}

export function logStructuredEvent(
  logger: StructuredLogger,
  level: StructuredLogLevel,
  event: string,
  details: StructuredLogDetails = {},
  error?: unknown,
): void {
  const payload: StructuredLogDetails = {
    event,
    ...details,
  };

  if (error !== undefined) {
    Object.assign(payload, getErrorDetails(error));
  }

  const message = JSON.stringify(payload);

  if (level === "error") {
    logger.error(message);
    return;
  }

  if (level === "warn") {
    logger.warn(message);
    return;
  }

  logger.log(message);
}

export function isVerbosePubSubLoggingEnabled(): boolean {
  return parseBoolean(
    process.env.LOG_VERBOSE_PUBSUB,
    getVerboseLoggingFallback(),
  );
}

export function isGraphqlSubscriptionLoggingEnabled(): boolean {
  return parseBoolean(
    process.env.LOG_GRAPHQL_SUBSCRIPTIONS,
    getVerboseLoggingFallback(),
  );
}
