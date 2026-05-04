import assert from "node:assert/strict";
import test from "node:test";
import {
  isGraphqlSubscriptionLoggingEnabled,
  isVerbosePubSubLoggingEnabled,
  logStructuredEvent,
  type StructuredLogger,
} from "../src/index";

type LoggedMessage = {
  level: "error" | "log" | "warn";
  payload: Record<string, unknown>;
};

function createLogger(): StructuredLogger & { messages: LoggedMessage[] } {
  const messages: LoggedMessage[] = [];

  function push(level: LoggedMessage["level"], message: string): void {
    messages.push({
      level,
      payload: JSON.parse(message) as Record<string, unknown>,
    });
  }

  return {
    messages,
    error: (message) => push("error", message),
    log: (message) => push("log", message),
    warn: (message) => push("warn", message),
  };
}

function withEnv<T>(
  patch: Record<string, string | undefined>,
  callback: () => T,
): T {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(patch)) {
    previousValues.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("logStructuredEvent writes JSON payloads at the requested level", () => {
  const logger = createLogger();

  logStructuredEvent(logger, "warn", "redis_client_closed", {
    role: "subscriber",
  });

  assert.deepEqual(logger.messages, [
    {
      level: "warn",
      payload: {
        event: "redis_client_closed",
        role: "subscriber",
      },
    },
  ]);
});

test("logStructuredEvent includes Error details", () => {
  const logger = createLogger();
  const error = new Error("Connection failed") as Error & { code: string };
  error.code = "ECONNREFUSED";

  logStructuredEvent(logger, "error", "database_connect_failed", {}, error);

  assert.equal(logger.messages[0]?.level, "error");
  assert.equal(logger.messages[0]?.payload.event, "database_connect_failed");
  assert.equal(logger.messages[0]?.payload.errorName, "Error");
  assert.equal(logger.messages[0]?.payload.errorMessage, "Connection failed");
  assert.equal(logger.messages[0]?.payload.errorCode, "ECONNREFUSED");
  assert.equal(typeof logger.messages[0]?.payload.errorStack, "string");
});

test("verbose pubsub logging follows environment configuration", () => {
  withEnv(
    {
      LOG_VERBOSE_PUBSUB: "false",
      NODE_ENV: "development",
    },
    () => {
      assert.equal(isVerbosePubSubLoggingEnabled(), false);
    },
  );

  withEnv(
    {
      LOG_VERBOSE_PUBSUB: undefined,
      NODE_ENV: "production",
    },
    () => {
      assert.equal(isVerbosePubSubLoggingEnabled(), false);
    },
  );
});

test("GraphQL subscription logging follows environment configuration", () => {
  withEnv(
    {
      LOG_GRAPHQL_SUBSCRIPTIONS: "true",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(isGraphqlSubscriptionLoggingEnabled(), true);
    },
  );
});
