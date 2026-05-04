import assert from "node:assert/strict";
import test from "node:test";
import {
  createEnvironmentConfigReader,
  getEnvFilePaths,
  readConfigBoolean,
  readConfigList,
  readConfigLowercaseString,
  readConfigNumber,
  readConfigString,
  readCookieSameSite,
  readRefreshTokenTransport,
  readRequiredConfigString,
  readServerCorsOptions,
  readServerRuntimeOptions,
  summarizeServerCorsOrigin,
} from "../src/index";

test("createEnvironmentConfigReader exposes current environment values", () => {
  const env: Record<string, string | undefined> = {};
  const reader = createEnvironmentConfigReader(env);

  env.PORT = "4000";

  assert.equal(reader.get("PORT"), "4000");
});

test("readers trim strings and parse common scalar values", () => {
  const reader = createEnvironmentConfigReader({
    ENABLED: "yes",
    HOST: " 127.0.0.1 ",
    MODES: " local, external, ",
    PORT: "3001",
    PUBSUB_DRIVER: "Redis",
  });

  assert.equal(readConfigString(reader, "HOST"), "127.0.0.1");
  assert.equal(readConfigBoolean(reader, "ENABLED", false), true);
  assert.equal(readConfigNumber(reader, "PORT", 3000), 3001);
  assert.deepEqual(readConfigList(reader, "MODES"), ["local", "external"]);
  assert.equal(readConfigLowercaseString(reader, "PUBSUB_DRIVER"), "redis");
});

test("readRequiredConfigString validates required secret values", () => {
  const reader = createEnvironmentConfigReader({
    SECRET: "1234567890",
  });

  assert.equal(
    readRequiredConfigString(reader, "SECRET", { minLength: 10 }),
    "1234567890",
  );
  assert.throws(
    () =>
      readRequiredConfigString(reader, "SECRET", {
        message: "SECRET is too short",
        minLength: 11,
      }),
    /SECRET is too short/,
  );
});

test("getEnvFilePaths uses node environment specific files first", () => {
  assert.deepEqual(getEnvFilePaths("production"), [".env.production", ".env"]);
  assert.deepEqual(getEnvFilePaths(undefined), [".env.development", ".env"]);
});

test("readRefreshTokenTransport defaults to cookie transport", () => {
  assert.equal(
    readRefreshTokenTransport(createEnvironmentConfigReader({})),
    "cookie",
  );
  assert.equal(
    readRefreshTokenTransport(
      createEnvironmentConfigReader({
        AUTH_REFRESH_TOKEN_TRANSPORT: " response_body ",
      }),
    ),
    "response_body",
  );
});

test("readCookieSameSite accepts strict lax and none values", () => {
  assert.equal(
    readCookieSameSite(
      createEnvironmentConfigReader({
        AUTH_REFRESH_COOKIE_SAME_SITE: "none",
      }),
      "AUTH_REFRESH_COOKIE_SAME_SITE",
    ),
    "none",
  );
  assert.equal(
    readCookieSameSite(
      createEnvironmentConfigReader({
        AUTH_REFRESH_COOKIE_SAME_SITE: "cross-site",
      }),
      "AUTH_REFRESH_COOKIE_SAME_SITE",
    ),
    "lax",
  );
});

test("readServerCorsOptions enables credentials for cookie refresh transport", () => {
  const corsOptions = readServerCorsOptions(
    createEnvironmentConfigReader({
      CORS_ORIGIN: "https://app.example.com, https://admin.example.com",
    }),
  );

  assert.deepEqual(corsOptions, {
    credentials: true,
    origin: ["https://app.example.com", "https://admin.example.com"],
  });
  assert.deepEqual(summarizeServerCorsOrigin(corsOptions.origin), [
    "https://app.example.com",
    "https://admin.example.com",
  ]);
});

test("readServerCorsOptions supports wildcard and response body refresh transport", () => {
  const corsOptions = readServerCorsOptions(
    createEnvironmentConfigReader({
      AUTH_REFRESH_TOKEN_TRANSPORT: "response_body",
      CORS_ORIGIN: "*",
    }),
  );

  assert.deepEqual(corsOptions, {
    credentials: false,
    origin: true,
  });
  assert.equal(summarizeServerCorsOrigin(corsOptions.origin), "*");
});

test("readServerRuntimeOptions reads bootstrap runtime values", () => {
  assert.deepEqual(
    readServerRuntimeOptions(
      createEnvironmentConfigReader({
        GRAPHQL_PATH: "/api/graphql",
        HOST: "127.0.0.1",
        PORT: "4100",
        PUBSUB_DRIVER: "Redis",
      }),
    ),
    {
      graphqlPath: "/api/graphql",
      host: "127.0.0.1",
      port: 4100,
      pubsubDriver: "redis",
    },
  );
});
