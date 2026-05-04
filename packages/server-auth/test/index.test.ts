import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBearerToken,
  REFRESH_TOKEN_TRANSPORT_COOKIE,
  REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY,
  type Principal,
} from "@omgjs/labkit-auth-contract";
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import "reflect-metadata";
import {
  GraphqlAuthenticationGuard,
  IDENTITY_PROVIDER_REGISTRY_CONFIG,
  IS_PUBLIC_KEY,
  IdentityProviderCapability,
  IdentityProviderRegistry,
  Public,
  Roles,
  ROLES_KEY,
  RolesGuard,
  SERVER_AUTH_LOCAL_IDENTITY_PROVIDER_ID,
  SERVER_AUTH_EVENT_LOGIN_FAILED,
  SERVER_AUTH_EVENT_LOGIN_SUCCEEDED,
  SERVER_AUTH_IDENTITY_ACCOUNT_REPOSITORY,
  SERVER_AUTH_EVENT_REFRESH_SUCCEEDED,
  SERVER_AUTH_REFRESH_SESSION_REPOSITORY,
  SERVER_AUTH_REFRESH_SESSION_STATE_EXPIRED,
  SERVER_AUTH_REFRESH_SESSION_STATE_MISSING,
  SERVER_AUTH_REFRESH_SESSION_STATE_REVOKED,
  SERVER_AUTH_REFRESH_SESSION_STATE_VALID,
  SERVER_AUTH_REFRESH_TOKEN_BYTE_LENGTH,
  SERVER_AUTH_REFRESH_TOKEN_HASH_ALGORITHM,
  SERVER_AUTH_ROLE_REPOSITORY,
  SERVER_AUTH_TRANSACTION_RUNNER,
  clearServerAuthRefreshToken,
  createIdentityProviderRegistryConfigProvider,
  createServerAuthAccessTokenClaims,
  createServerAuthAccessTokenGraphqlIntegration,
  createServerAuthAccessTokenGraphqlModule,
  createServerAuthAccessTokenVerifier,
  createServerAuthLifecycleEvent,
  createServerAuthLifecycleEventDispatcher,
  createServerAuthLocalIdentityProviderProvider,
  createServerAuthPrincipalFromProviderIdentity,
  createServerAuthPrincipalFromAccessTokenPayload,
  createServerAuthRefreshSessionRevocation,
  createServerAuthRefreshSessionRotation,
  createServerAuthRefreshCookieClearOptions,
  createServerAuthRefreshCookieSetOptions,
  createServerAuthRefreshTokenTransportProvider,
  createServerAuthGraphqlIntegration,
  createServerAuthGraphqlModule,
  deliverServerAuthRefreshToken,
  extractServerAuthRefreshToken,
  generateServerAuthRefreshToken,
  getServerAuthAccessTokenExpiresAt,
  getServerAuthAccessTokenExpiresInSeconds,
  getServerAuthRefreshSessionState,
  getServerAuthRefreshTokenExpiresAt,
  hashServerAuthRefreshToken,
  isServerAuthRefreshSessionExpired,
  normalizeServerAuthLocalIdentitySubject,
  type IdentityProvider,
  ServerAuthLocalIdentityProvider,
  ServerAuthRefreshTokenTransportService,
  ServerAuthSessionOrchestrator,
  type ServerAuthIdentityAccountRepository,
  type ServerAuthGraphqlContext,
  type ServerAuthIssueAccessTokenInput,
  type ServerAuthLoginFailedEvent,
  type ServerAuthLoginSucceededEvent,
  type ServerAuthPersistenceRepositories,
  type ServerAuthRefreshSucceededEvent,
  type ServerAuthRefreshSessionRecord,
  type ServerAuthRefreshSessionRepository,
  type ServerAuthRefreshTokenTransportConfig,
  type ServerAuthRoleRepository,
  type ServerAuthTransactionRunner,
} from "../src/index";

const configReader = {
  get: <T = string>(): T | undefined => undefined,
};

const principal: Principal = {
  permissions: ["chat:read"],
  provider: "local",
  roles: ["user"],
  sessionId: "session-1",
  subject: "local:user-1",
  userId: "user-1",
};

const localProvider: IdentityProvider = {
  capabilities: [
    IdentityProviderCapability.Login,
    IdentityProviderCapability.Registration,
  ],
  id: "local",
};

const oidcProvider: IdentityProvider = {
  capabilities: [IdentityProviderCapability.Login],
  id: "oidc",
};

const localIdentityProviderConfigReader = {
  getDefaultRole: () => "user",
};

const refreshTokenTransportConfig: ServerAuthRefreshTokenTransportConfig = {
  cookieName: "refresh_token",
  cookiePath: "/graphql",
  cookieSameSite: "lax",
  cookieSecure: true,
  refreshTokenTtlSeconds: 120,
  transport: REFRESH_TOKEN_TRANSPORT_COOKIE,
};

const refreshTokenTransportConfigReader = {
  getRefreshCookieName: () => refreshTokenTransportConfig.cookieName,
  getRefreshCookiePath: () => refreshTokenTransportConfig.cookiePath,
  getRefreshCookieSameSite: () => refreshTokenTransportConfig.cookieSameSite,
  getRefreshTokenTransport: () => refreshTokenTransportConfig.transport,
  getRefreshTokenTtlSeconds: () =>
    refreshTokenTransportConfig.refreshTokenTtlSeconds,
  isRefreshCookieSecure: () => refreshTokenTransportConfig.cookieSecure,
};

test("createServerAuthGraphqlIntegration verifies bearer access tokens", async () => {
  let verifiedToken: string | null = null;
  const integration = createServerAuthGraphqlIntegration({
    configReader,
    verifyAccessToken: (accessToken) => {
      verifiedToken = accessToken;
      return principal;
    },
  });

  assert.equal(
    await integration.resolvePrincipalFromAuthorization(
      formatBearerToken("access-token"),
    ),
    principal,
  );
  assert.equal(verifiedToken, "access-token");
});

test("createServerAuthGraphqlIntegration reads the first authorization header", async () => {
  const integration = createServerAuthGraphqlIntegration({
    configReader,
    verifyAccessToken: (accessToken) =>
      accessToken === "first-token" ? principal : null,
  });

  assert.equal(
    await integration.resolvePrincipalFromAuthorization([
      formatBearerToken("first-token"),
      formatBearerToken("second-token"),
    ]),
    principal,
  );
});

test("createServerAuthGraphqlIntegration ignores missing or invalid bearer headers", async () => {
  const integration = createServerAuthGraphqlIntegration({
    configReader,
    verifyAccessToken: () => {
      throw new Error("Verifier should not run");
    },
  });

  assert.equal(
    await integration.resolvePrincipalFromAuthorization(undefined),
    null,
  );
  assert.equal(
    await integration.resolvePrincipalFromAuthorization("Basic token"),
    null,
  );
});

test("createServerAuthGraphqlIntegration preserves GraphQL integration options", () => {
  const integration = createServerAuthGraphqlIntegration({
    configReader,
    graphqlOptions: {
      introspection: false,
    },
    verifyAccessToken: () => null,
  });

  assert.equal(integration.configReader, configReader);
  assert.deepEqual(integration.graphqlOptions, {
    introspection: false,
  });
});

test("createServerAuthAccessTokenVerifier adapts access token services", async () => {
  let verifiedToken: string | null = null;
  const verifyAccessToken = createServerAuthAccessTokenVerifier({
    verifyAccessToken: (accessToken) => {
      verifiedToken = accessToken;
      return principal;
    },
  });

  assert.equal(await verifyAccessToken("access-token"), principal);
  assert.equal(verifiedToken, "access-token");
});

test("getServerAuthAccessTokenExpiresAt adds ttl seconds to the clock", () => {
  const now = new Date("2026-05-03T00:00:00.000Z");

  assert.equal(
    getServerAuthAccessTokenExpiresAt(90, now).toISOString(),
    "2026-05-03T00:01:30.000Z",
  );
});

test("getServerAuthAccessTokenExpiresInSeconds floors and clamps expiry seconds", () => {
  const now = new Date("2026-05-03T00:00:00.500Z");

  assert.equal(
    getServerAuthAccessTokenExpiresInSeconds(
      new Date("2026-05-03T00:00:10.900Z"),
      now,
    ),
    10,
  );
  assert.equal(
    getServerAuthAccessTokenExpiresInSeconds(
      new Date("2026-05-02T23:59:59.000Z"),
      now,
    ),
    1,
  );
});

test("createServerAuthAccessTokenClaims maps principals into JWT claims", () => {
  const roles = ["user"];
  const permissions = ["chat:read"];
  const claims = createServerAuthAccessTokenClaims(
    {
      displayName: "Test User",
      permissions,
      provider: "local",
      roles,
      subject: "local:user-1",
      userId: "user-1",
    },
    "session-1",
  );

  assert.deepEqual(claims, {
    displayName: "Test User",
    permissions: ["chat:read"],
    provider: "local",
    providerSubject: "local:user-1",
    roles: ["user"],
    sessionId: "session-1",
  });
  assert.notEqual(claims.permissions, permissions);
  assert.notEqual(claims.roles, roles);
});

test("createServerAuthAccessTokenClaims omits non-string display names", () => {
  const claims = createServerAuthAccessTokenClaims(
    {
      displayName: null,
      permissions: [],
      provider: "local",
      roles: [],
      subject: "local:user-1",
      userId: "user-1",
    },
    "session-1",
  );

  assert.equal("displayName" in claims, false);
});

test("createServerAuthPrincipalFromProviderIdentity maps provider identities into principals", () => {
  const roles = ["user"];
  const permissions = ["chat:read"];
  const mappedPrincipal = createServerAuthPrincipalFromProviderIdentity(
    {
      displayName: "Test User",
      permissions,
      provider: "local",
      roles,
      subject: "test@example.com",
      userId: "1",
    },
    "session-1",
  );

  assert.deepEqual(mappedPrincipal, {
    displayName: "Test User",
    permissions: ["chat:read"],
    provider: "local",
    roles: ["user"],
    sessionId: "session-1",
    subject: "test@example.com",
    userId: "1",
  });
  assert.notEqual(mappedPrincipal.permissions, permissions);
  assert.notEqual(mappedPrincipal.roles, roles);
});

test("storage-facing contracts model identity and refresh persistence", async () => {
  const accountRepository: ServerAuthIdentityAccountRepository = {
    async createIdentityAccount(input) {
      return {
        passwordHash: input.passwordHash,
        provider: input.provider,
        subject: input.subject,
        user: {
          displayName: input.displayName,
          email: input.email,
          isActive: true,
          userId: "user-1",
        },
        userId: "user-1",
      };
    },
    async findIdentityAccountByProviderSubject(provider, subject) {
      return {
        passwordHash: "hashed-password",
        provider,
        subject,
        user: {
          email: subject,
          isActive: true,
          userId: "user-1",
        },
        userId: "user-1",
      };
    },
  };
  const roleRepository: ServerAuthRoleRepository = {
    async findRolesByUserId(userId) {
      return userId === "user-1" ? ["user"] : [];
    },
  };
  const refreshSessions = new Map<string, ServerAuthRefreshSessionRecord>();
  const refreshSessionRepository: ServerAuthRefreshSessionRepository = {
    async createRefreshSession(input) {
      const session: ServerAuthRefreshSessionRecord = {
        ...input,
        revokedAt: null,
      };
      refreshSessions.set(input.tokenHash, session);
      return session;
    },
    async findRefreshSessionByTokenHash(tokenHash) {
      return refreshSessions.get(tokenHash) ?? null;
    },
    async revokeActiveRefreshSessionsForUser(input) {
      for (const [tokenHash, session] of refreshSessions) {
        if (session.userId === input.userId && !session.revokedAt) {
          refreshSessions.set(tokenHash, {
            ...session,
            revokedAt: input.revokedAt,
          });
        }
      }
    },
    async revokeRefreshSession(input) {
      const tokenHash =
        "tokenHash" in input
          ? input.tokenHash
          : [...refreshSessions].find(
              ([, session]) => session.id === input.sessionId,
            )?.[0];

      if (!tokenHash) {
        return false;
      }

      const session = refreshSessions.get(tokenHash);
      if (!session || session.revokedAt) {
        return false;
      }

      refreshSessions.set(tokenHash, {
        ...session,
        revokedAt: input.revokedAt,
      });
      return true;
    },
    async rotateRefreshSession(input) {
      for (const [tokenHash, session] of refreshSessions) {
        if (session.id === input.sessionId) {
          refreshSessions.set(tokenHash, {
            ...session,
            lastUsedAt: input.lastUsedAt,
            replacedBySessionId: input.replacedBySessionId,
            revokedAt: input.revokedAt,
          });
        }
      }
    },
  };
  const repositories: ServerAuthPersistenceRepositories = {
    identityAccounts: accountRepository,
    refreshSessions: refreshSessionRepository,
    roles: roleRepository,
  };
  const transactionRunner: ServerAuthTransactionRunner = {
    async runInTransaction(operation) {
      return operation(repositories);
    },
  };

  const account = await transactionRunner.runInTransaction((repos) =>
    repos.identityAccounts.createIdentityAccount({
      displayName: "Test User",
      email: "test@example.com",
      passwordHash: "hashed-password",
      provider: "local",
      roles: ["user"],
      subject: "test@example.com",
    }),
  );
  assert.equal(account.userId, "user-1");
  assert.deepEqual(await roleRepository.findRolesByUserId(account.userId), [
    "user",
  ]);

  const expiresAt = new Date("2026-05-03T12:00:00.000Z");
  await refreshSessionRepository.createRefreshSession({
    expiresAt,
    id: "session-1",
    provider: "local",
    providerSubject: "test@example.com",
    tokenHash: "refresh-hash",
    userId: account.userId,
  });

  assert.deepEqual(
    await refreshSessionRepository.findRefreshSessionByTokenHash(
      "refresh-hash",
    ),
    {
      expiresAt,
      id: "session-1",
      provider: "local",
      providerSubject: "test@example.com",
      revokedAt: null,
      tokenHash: "refresh-hash",
      userId: "user-1",
    },
  );
});

test("storage-facing repository tokens are stable symbols", () => {
  assert.equal(typeof SERVER_AUTH_IDENTITY_ACCOUNT_REPOSITORY, "symbol");
  assert.equal(typeof SERVER_AUTH_ROLE_REPOSITORY, "symbol");
  assert.equal(typeof SERVER_AUTH_REFRESH_SESSION_REPOSITORY, "symbol");
  assert.equal(typeof SERVER_AUTH_TRANSACTION_RUNNER, "symbol");
});

test("normalizeServerAuthLocalIdentitySubject normalizes email subjects", () => {
  assert.equal(
    normalizeServerAuthLocalIdentitySubject("  Test.User@Example.COM  "),
    "test.user@example.com",
  );
});

test("ServerAuthLocalIdentityProvider logs in active local accounts", async () => {
  const provider = new ServerAuthLocalIdentityProvider({
    accountRepository: {
      async createIdentityAccount() {
        throw new Error("createIdentityAccount should not run");
      },
      async findIdentityAccountByProviderSubject(providerId, subject) {
        assert.equal(providerId, SERVER_AUTH_LOCAL_IDENTITY_PROVIDER_ID);
        assert.equal(subject, "test@example.com");
        return {
          passwordHash: "hashed-password",
          provider: providerId,
          subject,
          user: {
            displayName: "Test User",
            email: subject,
            isActive: true,
            userId: "1",
          },
          userId: "1",
        };
      },
    },
    configReader: localIdentityProviderConfigReader,
    passwordHasher: {
      async hashPassword() {
        throw new Error("hashPassword should not run");
      },
      async verifyPassword(hash, password) {
        assert.equal(hash, "hashed-password");
        assert.equal(password, "secret");
        return true;
      },
    },
    roleRepository: {
      async findRolesByUserId(userId) {
        assert.equal(userId, "1");
        return ["user", "admin"];
      },
    },
  });

  assert.deepEqual(
    await provider.login({
      email: " Test@Example.COM ",
      password: "secret",
    }),
    {
      displayName: "Test User",
      permissions: [],
      provider: "local",
      roles: ["user", "admin"],
      subject: "test@example.com",
      userId: "1",
    },
  );
});

test("ServerAuthLocalIdentityProvider rejects invalid local credentials", async () => {
  const provider = new ServerAuthLocalIdentityProvider({
    accountRepository: {
      async createIdentityAccount() {
        throw new Error("createIdentityAccount should not run");
      },
      async findIdentityAccountByProviderSubject() {
        return {
          passwordHash: "hashed-password",
          provider: "local",
          subject: "test@example.com",
          user: {
            displayName: null,
            email: "test@example.com",
            isActive: true,
            userId: "1",
          },
          userId: "1",
        };
      },
    },
    configReader: localIdentityProviderConfigReader,
    passwordHasher: {
      async hashPassword() {
        throw new Error("hashPassword should not run");
      },
      async verifyPassword() {
        return false;
      },
    },
    roleRepository: {
      async findRolesByUserId() {
        throw new Error("findRolesByUserId should not run");
      },
    },
  });

  await assert.rejects(
    () =>
      provider.login({
        email: "test@example.com",
        password: "wrong",
      }),
    UnauthorizedException,
  );
});

test("ServerAuthLocalIdentityProvider registers local accounts", async () => {
  let createdAccount:
    | Parameters<
        ServerAuthIdentityAccountRepository["createIdentityAccount"]
      >[0]
    | null = null;
  const provider = new ServerAuthLocalIdentityProvider({
    accountRepository: {
      async createIdentityAccount(input) {
        createdAccount = input;
        return {
          passwordHash: input.passwordHash,
          provider: input.provider,
          subject: input.subject,
          user: {
            displayName: input.displayName,
            email: input.email,
            isActive: true,
            userId: "1",
          },
          userId: "1",
        };
      },
      async findIdentityAccountByProviderSubject(providerId, subject) {
        assert.equal(providerId, "local");
        assert.equal(subject, "test@example.com");
        return null;
      },
    },
    configReader: localIdentityProviderConfigReader,
    passwordHasher: {
      async hashPassword(password) {
        assert.equal(password, "secret");
        return "hashed-password";
      },
      async verifyPassword() {
        throw new Error("verifyPassword should not run");
      },
    },
    roleRepository: {
      async findRolesByUserId() {
        throw new Error("findRolesByUserId should not run");
      },
    },
  });

  assert.deepEqual(
    await provider.register({
      displayName: "Test User",
      email: " Test@Example.COM ",
      password: "secret",
    }),
    {
      displayName: "Test User",
      permissions: [],
      provider: "local",
      roles: ["user"],
      subject: "test@example.com",
      userId: "1",
    },
  );
  assert.deepEqual(createdAccount, {
    displayName: "Test User",
    email: "test@example.com",
    passwordHash: "hashed-password",
    provider: "local",
    roles: ["user"],
    subject: "test@example.com",
  });
});

test("ServerAuthLocalIdentityProvider rejects duplicate registrations", async () => {
  const provider = new ServerAuthLocalIdentityProvider({
    accountRepository: {
      async createIdentityAccount() {
        throw new Error("createIdentityAccount should not run");
      },
      async findIdentityAccountByProviderSubject() {
        return {
          passwordHash: "hashed-password",
          provider: "local",
          subject: "test@example.com",
          user: {
            displayName: null,
            email: "test@example.com",
            isActive: true,
            userId: "1",
          },
          userId: "1",
        };
      },
    },
    configReader: localIdentityProviderConfigReader,
    passwordHasher: {
      async hashPassword() {
        throw new Error("hashPassword should not run");
      },
      async verifyPassword() {
        throw new Error("verifyPassword should not run");
      },
    },
    roleRepository: {
      async findRolesByUserId() {
        throw new Error("findRolesByUserId should not run");
      },
    },
  });

  await assert.rejects(
    () =>
      provider.register({
        email: "test@example.com",
        password: "secret",
      }),
    BadRequestException,
  );
});

test("createServerAuthLocalIdentityProviderProvider creates a Nest provider", () => {
  const provider = createServerAuthLocalIdentityProviderProvider({
    configReaderToken: "identity-config",
    passwordHasherToken: "password-hasher",
  });

  if (!("provide" in provider) || !("useFactory" in provider)) {
    assert.fail("Expected a factory provider");
  }

  assert.equal(provider.provide, ServerAuthLocalIdentityProvider);
  assert.deepEqual(provider.inject, [
    "identity-config",
    "password-hasher",
    SERVER_AUTH_IDENTITY_ACCOUNT_REPOSITORY,
    SERVER_AUTH_ROLE_REPOSITORY,
  ]);
  assert.ok(
    provider.useFactory(
      localIdentityProviderConfigReader,
      {
        async hashPassword() {
          return "hashed-password";
        },
        async verifyPassword() {
          return true;
        },
      },
      {
        async createIdentityAccount() {
          throw new Error("createIdentityAccount should not run");
        },
        async findIdentityAccountByProviderSubject() {
          return null;
        },
      },
      {
        async findRolesByUserId() {
          return [];
        },
      },
    ) instanceof ServerAuthLocalIdentityProvider,
  );
});

test("ServerAuthSessionOrchestrator creates sessions through storage and access-token adapters", async () => {
  const now = new Date("2026-05-03T12:00:00.000Z");
  const accessTokenExpiresAt = new Date("2026-05-03T12:15:00.000Z");
  let createdSession:
    | Parameters<ServerAuthRefreshSessionRepository["createRefreshSession"]>[0]
    | null = null;
  let issuedAccessTokenInput: ServerAuthIssueAccessTokenInput | null = null;

  const orchestrator = new ServerAuthSessionOrchestrator({
    generateRefreshToken: () => "refresh-token",
    generateSessionId: () => "session-1",
    getAccessTokenExpiresAt: () => accessTokenExpiresAt,
    getNow: () => now,
    getRefreshTokenTtlSeconds: () => 120,
    hashRefreshToken: (refreshToken) => `hash:${refreshToken}`,
    issueAccessToken: (input) => {
      issuedAccessTokenInput = input;
      return "access-token";
    },
    refreshSessionRepository: {
      async createRefreshSession(input) {
        createdSession = input;
        return {
          ...input,
          revokedAt: null,
        };
      },
      async findRefreshSessionByTokenHash() {
        return null;
      },
      async revokeActiveRefreshSessionsForUser() {},
      async revokeRefreshSession() {
        return false;
      },
      async rotateRefreshSession() {},
    },
    roleRepository: {
      async findRolesByUserId() {
        return [];
      },
    },
  });

  const result = await orchestrator.createSession({
    displayName: "Test User",
    permissions: ["chat:read"],
    provider: "local",
    roles: ["user"],
    subject: "test@example.com",
    userId: "1",
  });

  assert.deepEqual(createdSession, {
    expiresAt: new Date("2026-05-03T12:02:00.000Z"),
    id: "session-1",
    provider: "local",
    providerSubject: "test@example.com",
    tokenHash: "hash:refresh-token",
    userId: "1",
  });
  assert.deepEqual(issuedAccessTokenInput, {
    accessTokenExpiresAt,
    principal: result.principal,
    sessionId: "session-1",
  });
  assert.deepEqual(result, {
    accessToken: "access-token",
    accessTokenExpiresAt,
    principal: {
      displayName: "Test User",
      permissions: ["chat:read"],
      provider: "local",
      roles: ["user"],
      sessionId: "session-1",
      subject: "test@example.com",
      userId: "1",
    },
    refreshToken: "refresh-token",
    refreshTokenExpiresAt: new Date("2026-05-03T12:02:00.000Z"),
  });
});

test("ServerAuthSessionOrchestrator refreshes sessions and rotates the old session", async () => {
  const now = new Date("2026-05-03T12:00:00.000Z");
  const accessTokenExpiresAt = new Date("2026-05-03T12:15:00.000Z");
  const createdSessions: Parameters<
    ServerAuthRefreshSessionRepository["createRefreshSession"]
  >[0][] = [];
  const rotations: Parameters<
    ServerAuthRefreshSessionRepository["rotateRefreshSession"]
  >[0][] = [];

  const orchestrator = new ServerAuthSessionOrchestrator({
    generateRefreshToken: () => "new-refresh-token",
    generateSessionId: () => "new-session",
    getAccessTokenExpiresAt: () => accessTokenExpiresAt,
    getNow: () => now,
    getRefreshTokenTtlSeconds: () => 120,
    hashRefreshToken: (refreshToken) => `hash:${refreshToken}`,
    issueAccessToken: ({ sessionId }) => `access:${sessionId}`,
    refreshSessionRepository: {
      async createRefreshSession(input) {
        createdSessions.push(input);
        return {
          ...input,
          revokedAt: null,
        };
      },
      async findRefreshSessionByTokenHash(tokenHash) {
        assert.equal(tokenHash, "hash:old-refresh-token");
        return {
          expiresAt: new Date("2026-05-03T12:30:00.000Z"),
          id: "old-session",
          provider: "local",
          providerSubject: "test@example.com",
          revokedAt: null,
          tokenHash,
          user: {
            displayName: "Test User",
            email: "test@example.com",
            isActive: true,
            userId: "1",
          },
          userId: "1",
        };
      },
      async revokeActiveRefreshSessionsForUser() {},
      async revokeRefreshSession() {
        return false;
      },
      async rotateRefreshSession(input) {
        rotations.push(input);
      },
    },
    roleRepository: {
      async findRolesByUserId(userId) {
        assert.equal(userId, "1");
        return ["user"];
      },
    },
  });

  const result = await orchestrator.refreshSession("old-refresh-token");

  assert.equal(result.accessToken, "access:new-session");
  assert.equal(result.refreshToken, "new-refresh-token");
  assert.equal(result.principal.sessionId, "new-session");
  assert.deepEqual(createdSessions, [
    {
      expiresAt: new Date("2026-05-03T12:02:00.000Z"),
      id: "new-session",
      provider: "local",
      providerSubject: "test@example.com",
      tokenHash: "hash:new-refresh-token",
      userId: "1",
    },
  ]);
  assert.deepEqual(rotations, [
    {
      lastUsedAt: now,
      replacedBySessionId: "new-session",
      revokedAt: now,
      sessionId: "old-session",
    },
  ]);
});

test("ServerAuthSessionOrchestrator revokes expired refresh sessions before rejecting them", async () => {
  const now = new Date("2026-05-03T12:00:00.000Z");
  const revocations: Parameters<
    ServerAuthRefreshSessionRepository["revokeRefreshSession"]
  >[0][] = [];

  const orchestrator = new ServerAuthSessionOrchestrator({
    generateRefreshToken: () => "new-refresh-token",
    generateSessionId: () => "new-session",
    getAccessTokenExpiresAt: () => new Date("2026-05-03T12:15:00.000Z"),
    getNow: () => now,
    getRefreshTokenTtlSeconds: () => 120,
    hashRefreshToken: (refreshToken) => `hash:${refreshToken}`,
    issueAccessToken: () => "access-token",
    refreshSessionRepository: {
      async createRefreshSession(input) {
        return {
          ...input,
          revokedAt: null,
        };
      },
      async findRefreshSessionByTokenHash() {
        return {
          expiresAt: now,
          id: "expired-session",
          provider: "local",
          providerSubject: "test@example.com",
          revokedAt: null,
          tokenHash: "hash:expired-refresh-token",
          userId: "1",
        };
      },
      async revokeActiveRefreshSessionsForUser() {},
      async revokeRefreshSession(input) {
        revocations.push(input);
        return true;
      },
      async rotateRefreshSession() {},
    },
    roleRepository: {
      async findRolesByUserId() {
        return [];
      },
    },
  });

  await assert.rejects(
    () => orchestrator.refreshSession("expired-refresh-token"),
    /Refresh token has expired/,
  );
  assert.deepEqual(revocations, [
    {
      revokedAt: now,
      sessionId: "expired-session",
    },
  ]);
});

test("createServerAuthPrincipalFromAccessTokenPayload maps valid claims into principals", () => {
  assert.deepEqual(
    createServerAuthPrincipalFromAccessTokenPayload({
      displayName: "Test User",
      permissions: ["chat:read", false],
      provider: "local",
      providerSubject: "local:user-1",
      roles: ["user", 1],
      sessionId: "session-1",
      sub: "user-1",
    }),
    {
      displayName: "Test User",
      permissions: ["chat:read"],
      provider: "local",
      roles: ["user"],
      sessionId: "session-1",
      subject: "local:user-1",
      userId: "user-1",
    },
  );
});

test("createServerAuthPrincipalFromAccessTokenPayload rejects invalid claim shapes", () => {
  assert.equal(
    createServerAuthPrincipalFromAccessTokenPayload({
      permissions: [],
      provider: "local",
      providerSubject: "local:user-1",
      roles: [],
      sessionId: "session-1",
    }),
    null,
  );
  assert.equal(
    createServerAuthPrincipalFromAccessTokenPayload({
      displayName: null,
      permissions: [],
      provider: "local",
      providerSubject: "local:user-1",
      roles: [],
      sessionId: "session-1",
      sub: "user-1",
    }),
    null,
  );
});

test("generateServerAuthRefreshToken creates url-safe refresh tokens", () => {
  const token = generateServerAuthRefreshToken();

  assert.equal(typeof token, "string");
  assert.equal(token.length > 32, true);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(token, generateServerAuthRefreshToken());
  assert.equal(SERVER_AUTH_REFRESH_TOKEN_BYTE_LENGTH, 32);
});

test("generateServerAuthRefreshToken supports explicit byte lengths", () => {
  const token = generateServerAuthRefreshToken(16);

  assert.equal(token.length > 16, true);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test("hashServerAuthRefreshToken hashes refresh tokens with the stable algorithm", () => {
  assert.equal(SERVER_AUTH_REFRESH_TOKEN_HASH_ALGORITHM, "sha256");
  assert.equal(
    hashServerAuthRefreshToken("refresh-token"),
    "0eb17643d4e9261163783a420859c92c7d212fa9624106a12b510afbec266120",
  );
  assert.equal(hashServerAuthRefreshToken("refresh-token").length, 64);
});

test("getServerAuthRefreshTokenExpiresAt adds ttl seconds to the clock", () => {
  const now = new Date("2026-05-03T00:00:00.000Z");

  assert.equal(
    getServerAuthRefreshTokenExpiresAt(120, now).toISOString(),
    "2026-05-03T00:02:00.000Z",
  );
});

test("isServerAuthRefreshSessionExpired treats the exact boundary as expired", () => {
  const now = new Date("2026-05-03T00:00:00.000Z");

  assert.equal(
    isServerAuthRefreshSessionExpired(
      new Date("2026-05-03T00:00:00.000Z"),
      now,
    ),
    true,
  );
  assert.equal(
    isServerAuthRefreshSessionExpired(
      new Date("2026-05-03T00:00:00.001Z"),
      now,
    ),
    false,
  );
});

test("getServerAuthRefreshSessionState classifies refresh sessions", () => {
  const now = new Date("2026-05-03T00:00:00.000Z");

  assert.equal(
    getServerAuthRefreshSessionState(undefined, now),
    SERVER_AUTH_REFRESH_SESSION_STATE_MISSING,
  );
  assert.equal(
    getServerAuthRefreshSessionState(
      {
        expiresAt: new Date("2026-05-03T00:01:00.000Z"),
        revokedAt: new Date("2026-05-02T00:00:00.000Z"),
      },
      now,
    ),
    SERVER_AUTH_REFRESH_SESSION_STATE_REVOKED,
  );
  assert.equal(
    getServerAuthRefreshSessionState(
      {
        expiresAt: new Date("2026-05-03T00:00:00.000Z"),
        revokedAt: null,
      },
      now,
    ),
    SERVER_AUTH_REFRESH_SESSION_STATE_EXPIRED,
  );
  assert.equal(
    getServerAuthRefreshSessionState(
      {
        expiresAt: new Date("2026-05-03T00:00:00.001Z"),
      },
      now,
    ),
    SERVER_AUTH_REFRESH_SESSION_STATE_VALID,
  );
});

test("createServerAuthRefreshSessionRevocation creates revocation data", () => {
  const now = new Date("2026-05-03T00:00:00.000Z");

  assert.deepEqual(createServerAuthRefreshSessionRevocation(now), {
    revokedAt: now,
  });
});

test("createServerAuthRefreshSessionRotation creates rotation data", () => {
  const now = new Date("2026-05-03T00:00:00.000Z");

  assert.deepEqual(createServerAuthRefreshSessionRotation("session-2", now), {
    lastUsedAt: now,
    replacedBySessionId: "session-2",
    revokedAt: now,
  });
});

test("createServerAuthRefreshCookieSetOptions creates secure HttpOnly cookie options", () => {
  assert.deepEqual(
    createServerAuthRefreshCookieSetOptions(refreshTokenTransportConfig),
    {
      httpOnly: true,
      maxAge: 120,
      path: "/graphql",
      sameSite: "lax",
      secure: true,
    },
  );
});

test("createServerAuthRefreshCookieClearOptions creates matching clear options", () => {
  assert.deepEqual(
    createServerAuthRefreshCookieClearOptions(refreshTokenTransportConfig),
    {
      path: "/graphql",
      sameSite: "lax",
      secure: true,
    },
  );
});

test("deliverServerAuthRefreshToken writes a cookie for cookie transport", () => {
  const reply = {
    cookies: [] as Array<{
      name: string;
      options: unknown;
      value: string;
    }>,
    setCookie(name: string, value: string, options: unknown) {
      this.cookies.push({ name, options, value });
    },
  };

  const deliveredRefreshToken = deliverServerAuthRefreshToken({
    config: refreshTokenTransportConfig,
    context: {
      reply,
    },
    refreshToken: "refresh-token",
  });

  assert.equal(deliveredRefreshToken, undefined);
  assert.deepEqual(reply.cookies, [
    {
      name: "refresh_token",
      options: {
        httpOnly: true,
        maxAge: 120,
        path: "/graphql",
        sameSite: "lax",
        secure: true,
      },
      value: "refresh-token",
    },
  ]);
});

test("deliverServerAuthRefreshToken returns the token for response-body transport", () => {
  assert.equal(
    deliverServerAuthRefreshToken({
      config: {
        ...refreshTokenTransportConfig,
        transport: REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY,
      },
      context: {},
      refreshToken: "refresh-token",
    }),
    "refresh-token",
  );
});

test("deliverServerAuthRefreshToken requires a reply for cookie transport", () => {
  assert.throws(
    () =>
      deliverServerAuthRefreshToken({
        config: refreshTokenTransportConfig,
        context: {},
        refreshToken: "refresh-token",
      }),
    /Cookie refresh transport requires a response object/,
  );
});

test("extractServerAuthRefreshToken reads the response-body token", () => {
  assert.equal(
    extractServerAuthRefreshToken({
      config: {
        ...refreshTokenTransportConfig,
        transport: REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY,
      },
      context: {},
      explicitRefreshToken: "refresh-token",
    }),
    "refresh-token",
  );
});

test("extractServerAuthRefreshToken rejects missing response-body tokens", () => {
  assert.throws(
    () =>
      extractServerAuthRefreshToken({
        config: {
          ...refreshTokenTransportConfig,
          transport: REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY,
        },
        context: {},
      }),
    UnauthorizedException,
  );
});

test("extractServerAuthRefreshToken reads the configured cookie", () => {
  assert.equal(
    extractServerAuthRefreshToken({
      config: refreshTokenTransportConfig,
      context: {
        req: {
          cookies: {
            refresh_token: "refresh-token",
          },
        },
      },
    }),
    "refresh-token",
  );
});

test("extractServerAuthRefreshToken rejects missing cookie tokens", () => {
  assert.throws(
    () =>
      extractServerAuthRefreshToken({
        config: refreshTokenTransportConfig,
        context: {
          req: {
            cookies: {},
          },
        },
      }),
    UnauthorizedException,
  );
});

test("clearServerAuthRefreshToken clears only cookie transport", () => {
  const context = {
    reply: {
      clearedCookies: [] as unknown[],
      clearCookie(name: string, options: unknown) {
        this.clearedCookies.push({ name, options });
      },
    },
  };

  clearServerAuthRefreshToken({
    config: {
      ...refreshTokenTransportConfig,
      transport: REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY,
    },
    context,
  });
  clearServerAuthRefreshToken({
    config: refreshTokenTransportConfig,
    context,
  });

  assert.deepEqual(context.reply.clearedCookies, [
    {
      name: "refresh_token",
      options: {
        path: "/graphql",
        sameSite: "lax",
        secure: true,
      },
    },
  ]);
});

test("ServerAuthRefreshTokenTransportService adapts config readers", () => {
  const context = {
    req: {
      cookies: {
        refresh_token: "cookie-refresh-token",
      },
    },
    reply: {
      clearedCookies: [] as unknown[],
      cookies: [] as unknown[],
      clearCookie(name: string, options: unknown) {
        this.clearedCookies.push({ name, options });
      },
      setCookie(name: string, value: string, options: unknown) {
        this.cookies.push({ name, options, value });
      },
    },
  };
  const service = new ServerAuthRefreshTokenTransportService(
    refreshTokenTransportConfigReader,
  );

  assert.deepEqual(
    service.getRefreshTokenTransportConfig(),
    refreshTokenTransportConfig,
  );
  assert.equal(
    service.deliverRefreshToken(context, "delivered-refresh-token"),
    undefined,
  );
  assert.equal(service.extractRefreshToken(context), "cookie-refresh-token");
  service.clearRefreshToken(context);

  assert.deepEqual(context.reply.cookies, [
    {
      name: "refresh_token",
      options: {
        httpOnly: true,
        maxAge: 120,
        path: "/graphql",
        sameSite: "lax",
        secure: true,
      },
      value: "delivered-refresh-token",
    },
  ]);
  assert.deepEqual(context.reply.clearedCookies, [
    {
      name: "refresh_token",
      options: {
        path: "/graphql",
        sameSite: "lax",
        secure: true,
      },
    },
  ]);
});

test("createServerAuthRefreshTokenTransportProvider creates a Nest provider", () => {
  const provider = createServerAuthRefreshTokenTransportProvider({
    configReaderToken: "identity-config",
  });

  if (!("provide" in provider) || !("useFactory" in provider)) {
    assert.fail("Expected a factory provider");
  }

  assert.equal(provider.provide, ServerAuthRefreshTokenTransportService);
  assert.deepEqual(provider.inject, ["identity-config"]);
  assert.ok(
    provider.useFactory(refreshTokenTransportConfigReader) instanceof
      ServerAuthRefreshTokenTransportService,
  );
});

test("createServerAuthLifecycleEvent adds the current timestamp", () => {
  const now = new Date("2026-05-03T00:00:00.000Z");

  assert.deepEqual(
    createServerAuthLifecycleEvent<ServerAuthLoginSucceededEvent>(
      {
        metadata: {
          source: "test",
        },
        principal,
        type: SERVER_AUTH_EVENT_LOGIN_SUCCEEDED,
      },
      now,
    ),
    {
      metadata: {
        source: "test",
      },
      occurredAt: now,
      principal,
      type: SERVER_AUTH_EVENT_LOGIN_SUCCEEDED,
    },
  );
});

test("createServerAuthLifecycleEvent preserves explicit timestamps", () => {
  const occurredAt = new Date("2026-05-03T00:00:00.000Z");
  const now = new Date("2026-05-04T00:00:00.000Z");

  assert.equal(
    createServerAuthLifecycleEvent<ServerAuthLoginSucceededEvent>(
      {
        occurredAt,
        principal,
        type: SERVER_AUTH_EVENT_LOGIN_SUCCEEDED,
      },
      now,
    ).occurredAt,
    occurredAt,
  );
});

test("createServerAuthLifecycleEventDispatcher calls handlers in order", async () => {
  const calls: string[] = [];
  const event = createServerAuthLifecycleEvent<ServerAuthLoginSucceededEvent>({
    principal,
    type: SERVER_AUTH_EVENT_LOGIN_SUCCEEDED,
  });
  const dispatcher =
    createServerAuthLifecycleEventDispatcher<ServerAuthLoginSucceededEvent>({
      handlers: [
        async (receivedEvent) => {
          calls.push(`first:${receivedEvent.type}`);
        },
        (receivedEvent) => {
          calls.push(`second:${receivedEvent.principal.userId}`);
        },
      ],
    });

  await dispatcher(event);

  assert.deepEqual(calls, [
    "first:server-auth.login.succeeded",
    "second:user-1",
  ]);
});

test("createServerAuthLifecycleEventDispatcher throws handler errors by default", async () => {
  const calls: string[] = [];
  const dispatcher =
    createServerAuthLifecycleEventDispatcher<ServerAuthLoginFailedEvent>({
      handlers: [
        () => {
          calls.push("first");
          throw new Error("handler failed");
        },
        () => {
          calls.push("second");
        },
      ],
    });

  await assert.rejects(
    dispatcher(
      createServerAuthLifecycleEvent<ServerAuthLoginFailedEvent>({
        error: new Error("login failed"),
        type: SERVER_AUTH_EVENT_LOGIN_FAILED,
      }),
    ),
    /handler failed/,
  );
  assert.deepEqual(calls, ["first"]);
});

test("createServerAuthLifecycleEventDispatcher can report and continue handler errors", async () => {
  const calls: string[] = [];
  const errors: Array<{
    eventType: string;
    handlerIndex: number;
    message: string;
  }> = [];
  const dispatcher =
    createServerAuthLifecycleEventDispatcher<ServerAuthRefreshSucceededEvent>({
      errorPolicy: "continue",
      handlers: [
        () => {
          calls.push("first");
          throw new Error("handler failed");
        },
        () => {
          calls.push("second");
        },
      ],
      onHandlerError: ({ error, event, handlerIndex }) => {
        errors.push({
          eventType: event.type,
          handlerIndex,
          message: error instanceof Error ? error.message : String(error),
        });
      },
    });

  await dispatcher(
    createServerAuthLifecycleEvent<ServerAuthRefreshSucceededEvent>({
      principal,
      type: SERVER_AUTH_EVENT_REFRESH_SUCCEEDED,
    }),
  );

  assert.deepEqual(calls, ["first", "second"]);
  assert.deepEqual(errors, [
    {
      eventType: "server-auth.refresh.succeeded",
      handlerIndex: 0,
      message: "handler failed",
    },
  ]);
});

test("createServerAuthLifecycleEventDispatcher supports app-defined event shapes", async () => {
  type CustomEvent = ServerAuthLoginSucceededEvent & {
    readonly metadata: {
      readonly traceId: string;
    };
  };
  const traceIds: string[] = [];
  const dispatcher = createServerAuthLifecycleEventDispatcher<CustomEvent>({
    handlers: [
      (event) => {
        traceIds.push(event.metadata.traceId);
      },
    ],
  });

  await dispatcher(
    createServerAuthLifecycleEvent<CustomEvent>({
      metadata: {
        traceId: "trace-1",
      },
      principal,
      type: SERVER_AUTH_EVENT_LOGIN_SUCCEEDED,
    }),
  );

  assert.deepEqual(traceIds, ["trace-1"]);
});

test("createIdentityProviderRegistryConfigProvider adapts app config services", () => {
  const provider = createIdentityProviderRegistryConfigProvider("config");

  assert.deepEqual(provider, {
    provide: IDENTITY_PROVIDER_REGISTRY_CONFIG,
    useExisting: "config",
  });
});

test("IdentityProviderRegistry returns the configured default login provider", () => {
  const registry = new IdentityProviderRegistry(
    createRegistryConfig({
      defaultLoginProvider: "oidc",
      enabledProviders: ["local", "oidc"],
    }),
    [localProvider, oidcProvider],
  );

  assert.equal(registry.getLoginProvider(), oidcProvider);
});

test("IdentityProviderRegistry allows selecting enabled providers with the requested capability", () => {
  const registry = new IdentityProviderRegistry(
    createRegistryConfig({
      enabledProviders: ["local", "oidc"],
    }),
    [localProvider, oidcProvider],
  );

  assert.equal(registry.getLoginProvider("local"), localProvider);
  assert.equal(registry.getLoginProvider("oidc"), oidcProvider);
});

test("IdentityProviderRegistry rejects disabled providers", () => {
  const registry = new IdentityProviderRegistry(
    createRegistryConfig({
      enabledProviders: ["local"],
    }),
    [localProvider, oidcProvider],
  );

  assert.throws(() => registry.getLoginProvider("oidc"), BadRequestException);
});

test("IdentityProviderRegistry rejects providers without requested capabilities", () => {
  const registry = new IdentityProviderRegistry(
    createRegistryConfig({
      enabledProviders: ["oidc"],
      registrationProvider: "oidc",
    }),
    [oidcProvider],
  );

  assert.throws(() => registry.getRegistrationProvider(), BadRequestException);
});

test("createServerAuthAccessTokenGraphqlIntegration creates auth options from access token services", async () => {
  const integration = createServerAuthAccessTokenGraphqlIntegration({
    configReader,
    graphqlOptions: {
      introspection: false,
    },
    accessTokenService: {
      verifyAccessToken: (accessToken) =>
        accessToken === "access-token" ? principal : null,
    },
  });

  assert.equal(integration.configReader, configReader);
  assert.deepEqual(integration.graphqlOptions, {
    introspection: false,
  });
  assert.equal(await integration.verifyAccessToken("access-token"), principal);
  assert.equal(await integration.verifyAccessToken("bad-token"), null);
});

test("createServerAuthGraphqlModule creates a Nest GraphQL dynamic module", () => {
  const module = createServerAuthGraphqlModule({
    inject: [],
    useFactory: () => ({
      configReader,
      verifyAccessToken: () => principal,
    }),
  });

  assert.equal(module.module?.name, "GraphQLModule");
});

test("createServerAuthAccessTokenGraphqlModule creates a Nest GraphQL dynamic module", () => {
  const module = createServerAuthAccessTokenGraphqlModule({
    accessTokenServiceToken: "access-token-service",
    configReaderToken: "config-reader",
  });

  assert.equal(module.module?.name, "GraphQLModule");
});

test("access-control decorators write public and role metadata", () => {
  class PublicTarget {}
  class RolesTarget {}

  Public()(PublicTarget);
  Roles("admin", "operator")(RolesTarget);

  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, PublicTarget), true);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, RolesTarget), [
    "admin",
    "operator",
  ]);
});

test("GraphqlAuthenticationGuard allows public handlers without a token", async () => {
  const guard = new GraphqlAuthenticationGuard(
    () => {
      throw new Error("Verifier should not run");
    },
    createReflector({ [IS_PUBLIC_KEY]: true }),
  );

  assert.equal(
    await guard.canActivate(createGraphqlExecutionContext({})),
    true,
  );
});

test("GraphqlAuthenticationGuard reuses an existing context principal", async () => {
  const guard = new GraphqlAuthenticationGuard(() => {
    throw new Error("Verifier should not run");
  }, createReflector({}));

  assert.equal(
    await guard.canActivate(createGraphqlExecutionContext({ principal })),
    true,
  );
});

test("GraphqlAuthenticationGuard verifies bearer access tokens", async () => {
  let verifiedToken: string | null = null;
  const gqlContext: ServerAuthGraphqlContext<Principal> = {
    req: {
      headers: {
        authorization: formatBearerToken("access-token"),
      },
    },
  };
  const guard = new GraphqlAuthenticationGuard((accessToken) => {
    verifiedToken = accessToken;
    return principal;
  }, createReflector({}));

  assert.equal(
    await guard.canActivate(createGraphqlExecutionContext(gqlContext)),
    true,
  );
  assert.equal(verifiedToken, "access-token");
  assert.equal(gqlContext.principal, principal);
});

test("GraphqlAuthenticationGuard rejects protected handlers without bearer tokens", async () => {
  const guard = new GraphqlAuthenticationGuard(
    () => principal,
    createReflector({}),
  );

  await assert.rejects(
    guard.canActivate(
      createGraphqlExecutionContext({
        req: {
          headers: {},
        },
      }),
    ),
    UnauthorizedException,
  );
});

test("GraphqlAuthenticationGuard rejects verifier misses", async () => {
  const guard = new GraphqlAuthenticationGuard(() => null, createReflector({}));

  await assert.rejects(
    guard.canActivate(
      createGraphqlExecutionContext({
        req: {
          headers: {
            authorization: formatBearerToken("access-token"),
          },
        },
      }),
    ),
    UnauthorizedException,
  );
});

test("RolesGuard allows handlers without required roles", () => {
  const guard = new RolesGuard(createReflector({}));

  assert.equal(guard.canActivate(createGraphqlExecutionContext({})), true);
});

test("RolesGuard allows principals with a required role", () => {
  const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ["admin"] }));

  assert.equal(
    guard.canActivate(
      createGraphqlExecutionContext({
        principal: {
          ...principal,
          roles: ["admin", "user"],
        },
      }),
    ),
    true,
  );
});

test("RolesGuard rejects missing principals for protected roles", () => {
  const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ["admin"] }));

  assert.throws(
    () => guard.canActivate(createGraphqlExecutionContext({})),
    ForbiddenException,
  );
});

test("RolesGuard rejects principals without a required role", () => {
  const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ["admin"] }));

  assert.throws(
    () => guard.canActivate(createGraphqlExecutionContext({ principal })),
    ForbiddenException,
  );
});

function createReflector(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
}

function createRegistryConfig(overrides: {
  defaultLoginProvider?: string;
  enabledProviders?: string[];
  registrationProvider?: string;
}) {
  return {
    getDefaultLoginProvider: () => overrides.defaultLoginProvider ?? "local",
    getEnabledProviders: () => overrides.enabledProviders ?? ["local"],
    getRegistrationProvider: () => overrides.registrationProvider ?? "local",
  };
}

function createGraphqlExecutionContext(
  gqlContext: ServerAuthGraphqlContext<Principal>,
): ExecutionContext {
  class TestClass {}
  const handler = () => undefined;
  const args = [undefined, {}, gqlContext, undefined];

  return {
    getType: () => "graphql",
    getClass: () => TestClass,
    getHandler: () => handler,
    getArgs: () => args,
  } as unknown as ExecutionContext;
}
