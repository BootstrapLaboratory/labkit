import assert from "node:assert/strict";
import test from "node:test";
import { createEnvironmentConfigReader } from "@omgjs/labkit-server-config";
import type { StructuredLogger } from "@omgjs/labkit-server-observability";
import { GraphQLModule } from "@nestjs/graphql";
import { buildSchema, graphql, Kind, parse, type GraphQLSchema } from "graphql";
import {
  ComplexityPlugin,
  createServerGraphqlModule,
  createServerGraphqlOptions,
  createGraphqlWsConnectionId,
  DateScalar,
  DEFAULT_MAX_QUERY_COMPLEXITY,
  DEFAULT_QUERY_COMPLEXITY,
  getClientIp,
  getGraphqlContextParts,
  getGraphqlSubscriptionConnectDetails,
  getGraphqlSubscriptionDisconnectDetails,
  getGraphqlSubscriptionSubscribeDetails,
  getGraphqlWsExtra,
  LoggingPlugin,
  logGraphqlSubscriptionEvent,
  readGraphqlPath,
  type ServerGraphqlContext,
  type GraphqlWsExtra,
  upperDirectiveTransformer,
} from "../src/index";

type LoggedMessage = {
  level: "error" | "log" | "warn";
  payload: Record<string, unknown>;
};

type TestPrincipal = {
  userId: string;
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

test("readGraphqlPath returns configured GraphQL path or default", () => {
  assert.equal(readGraphqlPath(createEnvironmentConfigReader({})), "/graphql");
  assert.equal(
    readGraphqlPath(
      createEnvironmentConfigReader({
        GRAPHQL_PATH: "/api/graphql",
      }),
    ),
    "/api/graphql",
  );
});

test("createGraphqlWsConnectionId creates unique string identifiers", () => {
  const firstId = createGraphqlWsConnectionId();
  const secondId = createGraphqlWsConnectionId();

  assert.equal(typeof firstId, "string");
  assert.notEqual(firstId, secondId);
});

test("getGraphqlWsExtra preserves mutable websocket extra objects", () => {
  const extra: GraphqlWsExtra = {
    request: { headers: {}, socket: {}, url: "/graphql" },
  };

  const normalized = getGraphqlWsExtra(extra);
  normalized.connectionId = "connection-1";

  assert.equal(extra.connectionId, "connection-1");
  assert.deepEqual(getGraphqlWsExtra(null), {});
});

test("getGraphqlContextParts supports wrapper contexts and request-only contexts", () => {
  const request = { headers: { authorization: "Bearer token" } };
  const reply = { statusCode: 200 };

  assert.deepEqual(
    getGraphqlContextParts(
      { extra: { connectionId: "1" }, req: request },
      reply,
    ),
    {
      extra: { connectionId: "1" },
      reply,
      req: request,
    },
  );
  assert.deepEqual(getGraphqlContextParts(request, reply), {
    reply,
    req: request,
  });
});

test("getClientIp prefers forwarded addresses before socket address", () => {
  assert.equal(
    getClientIp({
      headers: { "x-forwarded-for": "203.0.113.10, 203.0.113.11" },
      socket: { remoteAddress: "127.0.0.1" },
    }),
    "203.0.113.10",
  );
  assert.equal(
    getClientIp({
      headers: { "x-forwarded-for": ["203.0.113.12"] },
      socket: { remoteAddress: "127.0.0.1" },
    }),
    "203.0.113.12",
  );
  assert.equal(
    getClientIp({
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    }),
    "127.0.0.1",
  );
});

test("subscription detail helpers build stable log payloads", () => {
  const extra = {
    connectionId: "connection-1",
    principal: { userId: "user-1" },
    request: {
      headers: { "x-forwarded-for": "203.0.113.10" },
      socket: { remoteAddress: "127.0.0.1" },
      url: "/graphql",
    },
  };

  assert.deepEqual(getGraphqlSubscriptionConnectDetails(extra), {
    connectionId: "connection-1",
    ip: "203.0.113.10",
    path: "/graphql",
    principalUserId: "user-1",
  });
  assert.deepEqual(
    getGraphqlSubscriptionDisconnectDetails(extra, 1000, "normal"),
    {
      connectionId: "connection-1",
      code: 1000,
      reason: "normal",
    },
  );
  assert.deepEqual(
    getGraphqlSubscriptionSubscribeDetails(extra, "operation-1", {
      operationName: "Messages",
    }),
    {
      connectionId: "connection-1",
      operationId: "operation-1",
      operationName: "Messages",
    },
  );
});

test("logGraphqlSubscriptionEvent respects subscription logging config", () => {
  const logger = createLogger();

  withEnv(
    {
      LOG_GRAPHQL_SUBSCRIPTIONS: "false",
      NODE_ENV: "production",
    },
    () => {
      logGraphqlSubscriptionEvent(logger, "graphql_subscription_connect", {
        connectionId: "connection-1",
      });
    },
  );
  assert.deepEqual(logger.messages, []);

  withEnv(
    {
      LOG_GRAPHQL_SUBSCRIPTIONS: "true",
      NODE_ENV: "production",
    },
    () => {
      logGraphqlSubscriptionEvent(logger, "graphql_subscription_connect", {
        connectionId: "connection-1",
      });
    },
  );
  assert.deepEqual(logger.messages, [
    {
      level: "log",
      payload: {
        connectionId: "connection-1",
        event: "graphql_subscription_connect",
      },
    },
  ]);
});

test("createServerGraphqlOptions builds the standard Apollo options", async () => {
  const principal: TestPrincipal = { userId: "user-1" };
  const logger = createLogger();
  const request = { headers: { authorization: "Bearer access-token" } };
  const reply = { statusCode: 200 };
  const options = createServerGraphqlOptions<
    TestPrincipal,
    typeof request,
    typeof reply
  >({
    configReader: createEnvironmentConfigReader({
      GRAPHQL_PATH: "/api/graphql",
    }),
    resolvePrincipalFromAuthorization: (authorizationHeader) =>
      authorizationHeader === "Bearer access-token" ? principal : null,
    subscriptionLogger: logger,
  });

  assert.equal(options.path, "/api/graphql");
  assert.equal(options.autoSchemaFile, true);
  assert.equal(options.introspection, true);
  assert.equal(options.playground, false);
  assert.equal(options.sortSchema, true);
  assert.equal(options.plugins?.length, 1);

  const context = (await options.context?.({
    req: request,
    reply,
  })) as ServerGraphqlContext<TestPrincipal, typeof request, typeof reply>;

  assert.deepEqual(context, {
    principal,
    reply,
    req: request,
  });
});

test("createServerGraphqlOptions authenticates websocket connection params", async () => {
  const principal: TestPrincipal = { userId: "user-1" };
  const options = createServerGraphqlOptions<TestPrincipal>({
    configReader: createEnvironmentConfigReader({}),
    createConnectionId: () => "connection-1",
    resolvePrincipalFromAuthorization: (authorizationHeader) =>
      authorizationHeader === "Bearer access-token" ? principal : null,
    subscriptionLogger: createLogger(),
  });
  const subscriptionOptions = options.subscriptions?.["graphql-ws"];
  const extra: GraphqlWsExtra<TestPrincipal> = {
    request: { headers: {}, socket: {}, url: "/graphql" },
  };

  if (typeof subscriptionOptions !== "object" || subscriptionOptions === null) {
    throw new Error("GraphQL WS subscription options were not configured");
  }

  assert.equal(subscriptionOptions.connectionInitWaitTimeout, 15_000);

  await subscriptionOptions.onConnect?.({
    connectionParams: { accessToken: "access-token" },
    extra,
  } as never);

  assert.equal(extra.connectionId, "connection-1");
  assert.deepEqual(extra.principal, principal);
});

test("createServerGraphqlModule wraps the standard options factory in Nest GraphQL", () => {
  const module = createServerGraphqlModule<
    [ReturnType<typeof createEnvironmentConfigReader>],
    TestPrincipal
  >({
    inject: ["CONFIG"],
    useFactory: (configReader) => ({
      configReader,
      resolvePrincipalFromAuthorization: () => null,
    }),
  });

  assert.equal(module.module, GraphQLModule);
});

test("DateScalar parses and serializes epoch milliseconds", () => {
  const scalar = new DateScalar();

  assert.equal(scalar.parseValue(123)?.getTime(), 123);
  assert.equal(scalar.parseValue("123"), null);
  assert.equal(scalar.serialize(new Date(456)), 456);
  assert.equal(
    scalar.parseLiteral({ kind: Kind.INT, value: "789" })?.getTime(),
    789,
  );
  assert.equal(scalar.parseLiteral({ kind: Kind.STRING, value: "789" }), null);
  assert.throws(() => scalar.serialize("bad"), /DateScalar/);
});

test("upperDirectiveTransformer uppercases string field results", async () => {
  const schema = upperDirectiveTransformer(
    buildSchema(`
      directive @upper on FIELD_DEFINITION

      type Query {
        greeting: String @upper
        count: Int
      }
    `),
    "upper",
  );

  const result = await graphql({
    schema,
    source: "{ greeting count }",
    rootValue: { count: 3, greeting: "hello" },
  });

  assert.equal(result.errors, undefined);
  assert.equal(result.data?.greeting, "HELLO");
  assert.equal(result.data?.count, 3);
});

test("LoggingPlugin keeps the Apollo request lifecycle log hooks", async () => {
  const plugin = new LoggingPlugin();
  const messages: string[] = [];
  const originalLog = console.log;

  console.log = (...values: unknown[]) => {
    messages.push(values.map(String).join(" "));
  };

  try {
    const listener = await plugin.requestDidStart();
    await listener.willSendResponse?.({} as never);
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(messages, ["Request started", "Will send response"]);
});

test("ComplexityPlugin rejects operations at the default threshold", async () => {
  const schema: GraphQLSchema = buildSchema(`
    type Query {
      value: String
    }
  `);
  const plugin = new ComplexityPlugin({ schema } as never);
  const listener = await plugin.requestDidStart();
  const selectedFields = Array.from(
    { length: DEFAULT_MAX_QUERY_COMPLEXITY },
    (_, index) => `field${index}: value`,
  ).join("\n");
  const document = parse(`query TooLarge {\n${selectedFields}\n}`);

  await assert.rejects(
    async () => {
      if (!listener.didResolveOperation) {
        throw new Error("Complexity listener is missing didResolveOperation");
      }

      await listener.didResolveOperation({
        document,
        request: {
          operationName: "TooLarge",
          variables: {},
        },
      } as never);
    },
    new RegExp(
      `Query is too complex: ${DEFAULT_MAX_QUERY_COMPLEXITY}. Maximum allowed complexity: ${DEFAULT_MAX_QUERY_COMPLEXITY}`,
    ),
  );
});

test("ComplexityPlugin keeps the default estimator below the threshold", async () => {
  assert.equal(DEFAULT_QUERY_COMPLEXITY, 1);
});
