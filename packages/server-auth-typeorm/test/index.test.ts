import assert from "node:assert/strict";
import test from "node:test";
import {
  SERVER_AUTH_IDENTITY_ACCOUNT_REPOSITORY,
  SERVER_AUTH_REFRESH_SESSION_REPOSITORY,
  SERVER_AUTH_ROLE_REPOSITORY,
  SERVER_AUTH_TRANSACTION_RUNNER,
} from "@labkit/server-auth";
import { composeServerDatabaseManifests } from "@labkit/server-database";
import type { QueryRunner, Table } from "typeorm";
import "reflect-metadata";
import {
  CreateIdentityTables20260429143000,
  SERVER_AUTH_TYPEORM_ENTITIES,
  SERVER_AUTH_TYPEORM_MIGRATIONS,
  SERVER_AUTH_TYPEORM_PACKAGE_NAME,
  SERVER_AUTH_TYPEORM_REPOSITORY_EXPORTS,
  ServerAuthTypeormModule,
  TypeormServerAuthIdentityAccountRepository,
  TypeormServerAuthRefreshSessionRepository,
  TypeormServerAuthRoleRepository,
  TypeormServerAuthTransactionRunner,
  createServerAuthTypeormRepositoryProviders,
  serverAuthTypeormDatabaseManifest,
} from "../src/index";

type QueryRunnerMock = Pick<
  QueryRunner,
  "createForeignKey" | "createTable" | "dropTable"
>;

function createQueryRunnerMock(): QueryRunnerMock & {
  createdForeignKeys: unknown[];
  createdTables: Table[];
  droppedTables: string[];
} {
  const createdForeignKeys: unknown[] = [];
  const createdTables: Table[] = [];
  const droppedTables: string[] = [];

  return {
    createdForeignKeys,
    createdTables,
    droppedTables,
    async createForeignKey(_tableName, foreignKey) {
      createdForeignKeys.push(foreignKey);
    },
    async createTable(table) {
      createdTables.push(table);
    },
    async dropTable(tableName) {
      droppedTables.push(
        typeof tableName === "string" ? tableName : tableName.name,
      );
    },
  };
}

test("exports the package identity", () => {
  assert.equal(SERVER_AUTH_TYPEORM_PACKAGE_NAME, "@labkit/server-auth-typeorm");
});

test("exports the auth database manifest", () => {
  assert.deepEqual(
    SERVER_AUTH_TYPEORM_ENTITIES.map((entity) => entity.name),
    [
      "IdentityAccountEntity",
      "IdentityRefreshSessionEntity",
      "IdentityUserEntity",
      "IdentityUserRoleEntity",
    ],
  );
  assert.deepEqual(
    SERVER_AUTH_TYPEORM_MIGRATIONS.map((migration) => migration.name),
    ["CreateIdentityTables20260429143000"],
  );
  assert.deepEqual(
    composeServerDatabaseManifests([serverAuthTypeormDatabaseManifest]),
    {
      entities: [...SERVER_AUTH_TYPEORM_ENTITIES],
      migrations: [...SERVER_AUTH_TYPEORM_MIGRATIONS],
    },
  );
});

test("exports Nest providers for the auth repository contracts", () => {
  const providers = createServerAuthTypeormRepositoryProviders();

  assert.deepEqual(
    providers.map((provider) =>
      "provide" in provider ? provider.provide : null,
    ),
    [
      TypeormServerAuthIdentityAccountRepository,
      SERVER_AUTH_IDENTITY_ACCOUNT_REPOSITORY,
      TypeormServerAuthRoleRepository,
      SERVER_AUTH_ROLE_REPOSITORY,
      TypeormServerAuthRefreshSessionRepository,
      SERVER_AUTH_REFRESH_SESSION_REPOSITORY,
      TypeormServerAuthTransactionRunner,
      SERVER_AUTH_TRANSACTION_RUNNER,
    ],
  );
});

test("exports a Nest module for auth TypeORM persistence", () => {
  assert.deepEqual(SERVER_AUTH_TYPEORM_REPOSITORY_EXPORTS, [
    TypeormServerAuthIdentityAccountRepository,
    SERVER_AUTH_IDENTITY_ACCOUNT_REPOSITORY,
    TypeormServerAuthRoleRepository,
    SERVER_AUTH_ROLE_REPOSITORY,
    TypeormServerAuthRefreshSessionRepository,
    SERVER_AUTH_REFRESH_SESSION_REPOSITORY,
    TypeormServerAuthTransactionRunner,
    SERVER_AUTH_TRANSACTION_RUNNER,
  ]);
  assert.equal(typeof ServerAuthTypeormModule, "function");
  assert.equal(Reflect.getMetadata("imports", ServerAuthTypeormModule), void 0);
  assert.ok(Reflect.getMetadata("providers", ServerAuthTypeormModule));
  assert.deepEqual(Reflect.getMetadata("exports", ServerAuthTypeormModule), [
    ...SERVER_AUTH_TYPEORM_REPOSITORY_EXPORTS,
  ]);
});

test("TypeormServerAuthIdentityAccountRepository maps account records", async () => {
  const accountRepository = {
    async findOne() {
      return {
        passwordHash: "hashed-password",
        provider: "local",
        subject: "test@example.com",
        userId: 1,
        user: {
          displayName: "Test User",
          email: "test@example.com",
          id: 1,
          isActive: true,
        },
      };
    },
  };
  const repository = new TypeormServerAuthIdentityAccountRepository(
    accountRepository as never,
    {} as never,
    {} as never,
  );

  assert.deepEqual(
    await repository.findIdentityAccountByProviderSubject(
      "local",
      "test@example.com",
    ),
    {
      passwordHash: "hashed-password",
      provider: "local",
      subject: "test@example.com",
      user: {
        displayName: "Test User",
        email: "test@example.com",
        isActive: true,
        userId: "1",
      },
      userId: "1",
    },
  );
});

test("TypeormServerAuthRoleRepository reads roles by string user id", async () => {
  const repository = new TypeormServerAuthRoleRepository({
    async findBy(where: unknown) {
      assert.deepEqual(where, { userId: 1 });
      return [{ role: "user" }, { role: "admin" }];
    },
  } as never);

  assert.deepEqual(await repository.findRolesByUserId("1"), ["user", "admin"]);
});

test("TypeormServerAuthRefreshSessionRepository maps refresh sessions", async () => {
  const expiresAt = new Date("2026-05-03T12:00:00.000Z");
  const repository = new TypeormServerAuthRefreshSessionRepository({
    async findOne() {
      return {
        createdAt: new Date("2026-05-03T11:00:00.000Z"),
        expiresAt,
        id: "session-1",
        lastUsedAt: null,
        provider: "local",
        providerSubject: "test@example.com",
        replacedBySessionId: null,
        revokedAt: null,
        tokenHash: "hash",
        userId: 1,
        user: {
          displayName: null,
          email: "test@example.com",
          id: 1,
          isActive: true,
        },
      };
    },
  } as never);

  assert.deepEqual(await repository.findRefreshSessionByTokenHash("hash"), {
    createdAt: new Date("2026-05-03T11:00:00.000Z"),
    expiresAt,
    id: "session-1",
    lastUsedAt: null,
    provider: "local",
    providerSubject: "test@example.com",
    replacedBySessionId: null,
    revokedAt: null,
    tokenHash: "hash",
    user: {
      displayName: null,
      email: "test@example.com",
      isActive: true,
      userId: "1",
    },
    userId: "1",
  });
});

test("CreateIdentityTables20260429143000 creates the identity tables", async () => {
  const migration = new CreateIdentityTables20260429143000();
  const queryRunner = createQueryRunnerMock();

  await migration.up(queryRunner as unknown as QueryRunner);

  assert.deepEqual(
    queryRunner.createdTables.map((table) => table.name),
    [
      "identity_user",
      "identity_account",
      "identity_user_role",
      "identity_refresh_session",
    ],
  );
  assert.equal(queryRunner.createdForeignKeys.length, 3);
  assert.ok(
    queryRunner.createdTables
      .find((table) => table.name === "identity_account")
      ?.columns.some((column) => column.name === "password_hash"),
  );
  assert.ok(
    queryRunner.createdTables
      .find((table) => table.name === "identity_refresh_session")
      ?.columns.some((column) => column.name === "token_hash"),
  );
});

test("CreateIdentityTables20260429143000 drops tables in dependency order", async () => {
  const migration = new CreateIdentityTables20260429143000();
  const queryRunner = createQueryRunnerMock();

  await migration.down(queryRunner as unknown as QueryRunner);

  assert.deepEqual(queryRunner.droppedTables, [
    "identity_refresh_session",
    "identity_user_role",
    "identity_account",
    "identity_user",
  ]);
});
