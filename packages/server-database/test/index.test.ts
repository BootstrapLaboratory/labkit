import assert from "node:assert/strict";
import test from "node:test";
import { createEnvironmentConfigReader } from "@omgjs/labkit-server-config";
import {
  assertDatabaseMigrationSafety,
  composeServerDatabaseManifests,
  normalizePostgresConnectionUrl,
  readDatabaseRuntimeFlags,
  readPostgresConnectionUrl,
  readPostgresDiscreteConnectionOptions,
  readPostgresSslConfig,
  summarizePostgresConnection,
} from "../src/index";

class TestEntity {}

class OtherTestEntity {}

class TestMigration {}

test("normalizePostgresConnectionUrl pins sslmode require to verify-full", () => {
  assert.equal(
    normalizePostgresConnectionUrl(
      "postgres://user:pass@example.com/app?sslmode=require",
    ),
    "postgres://user:pass@example.com/app?sslmode=verify-full",
  );
  assert.equal(
    normalizePostgresConnectionUrl(
      "postgres://user:pass@example.com/app?sslmode=require&uselibpqcompat=true",
    ),
    "postgres://user:pass@example.com/app?sslmode=require&uselibpqcompat=true",
  );
  assert.equal(normalizePostgresConnectionUrl("not a url"), "not a url");
});

test("readPostgresConnectionUrl prefers direct URLs when requested", () => {
  const reader = createEnvironmentConfigReader({
    DATABASE_URL: "postgres://user:pass@pooler.example.com/app",
    DATABASE_URL_DIRECT:
      "postgres://user:pass@direct.example.com/app?sslmode=require",
  });

  assert.equal(
    readPostgresConnectionUrl(reader),
    "postgres://user:pass@pooler.example.com/app",
  );
  assert.equal(
    readPostgresConnectionUrl(reader, { preferDirectUrl: true }),
    "postgres://user:pass@direct.example.com/app?sslmode=verify-full",
  );
});

test("readPostgresSslConfig defaults to production SSL", () => {
  assert.deepEqual(
    readPostgresSslConfig(createEnvironmentConfigReader({}), {
      nodeEnv: "production",
    }),
    { rejectUnauthorized: false },
  );
  assert.equal(
    readPostgresSslConfig(createEnvironmentConfigReader({}), {
      nodeEnv: "development",
    }),
    false,
  );
  assert.deepEqual(
    readPostgresSslConfig(
      createEnvironmentConfigReader({
        DATABASE_SSL: "true",
        DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
      }),
      { nodeEnv: "development" },
    ),
    { rejectUnauthorized: true },
  );
});

test("readPostgresDiscreteConnectionOptions reads fallback fields", () => {
  assert.deepEqual(
    readPostgresDiscreteConnectionOptions(
      createEnvironmentConfigReader({
        DATABASE_HOST: " db.example.com ",
        DATABASE_PASSWORD: " pass with spaces ",
        DATABASE_PORT: "6543",
      }),
    ),
    {
      database: "chatdb",
      host: "db.example.com",
      password: " pass with spaces ",
      port: 6543,
      username: "chatuser",
    },
  );
});

test("readDatabaseRuntimeFlags enforces migration safety separately", () => {
  const flags = readDatabaseRuntimeFlags(
    createEnvironmentConfigReader({
      DATABASE_RUN_MIGRATIONS_ON_START: "true",
      DATABASE_SYNCHRONIZE: "true",
    }),
    { nodeEnv: "development" },
  );

  assert.deepEqual(flags, {
    runMigrationsOnStart: true,
    synchronize: true,
  });
  assert.throws(
    () => assertDatabaseMigrationSafety(flags),
    /DATABASE_SYNCHRONIZE=true cannot be used with DATABASE_RUN_MIGRATIONS_ON_START=true/,
  );
});

test("summarizePostgresConnection summarizes URL connections", () => {
  assert.deepEqual(
    summarizePostgresConnection({
      synchronize: false,
      url: "postgres://user:pass@app-pooler.example.com:6543/app?sslmode=verify-full",
    }),
    {
      connectionSource: "url",
      database: "app",
      host: "app-pooler.example.com",
      pooledConnection: true,
      port: 6543,
      sslMode: "verify-full",
      synchronize: false,
    },
  );
});

test("summarizePostgresConnection summarizes discrete field connections", () => {
  assert.deepEqual(
    summarizePostgresConnection({
      database: "chatdb",
      host: "localhost",
      synchronize: true,
    }),
    {
      connectionSource: "discrete_fields",
      database: "chatdb",
      host: "localhost",
      port: 5432,
      synchronize: true,
    },
  );
});

test("composeServerDatabaseManifests preserves ordered unique feature entries", () => {
  assert.deepEqual(
    composeServerDatabaseManifests([
      {
        entities: [TestEntity],
        migrations: [TestMigration],
      },
      {
        entities: [TestEntity, OtherTestEntity],
      },
      {},
    ]),
    {
      entities: [TestEntity, OtherTestEntity],
      migrations: [TestMigration],
    },
  );
});
