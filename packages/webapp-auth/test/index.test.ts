import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthApiError,
  cookieRefreshTokenTransport,
  createAuthApiErrorFromGraphqlErrors,
  createAuthSessionFromPayload,
  createAuthSessionHintStorage,
  createWebappAuthGraphqlApi,
  createWebappAuthSession,
  createWebappAuthSessionBootstrap,
  getAuthRequestCredentials,
  hasAuthRequiredGraphqlErrors,
  shouldShowAuthenticatedNavigation,
  type AuthPayload,
  type AuthSessionHintStorageBackend,
  type RefreshTokenTransportStrategy,
  type WebappAuthFetch,
} from "../src/index";

function createPayload(overrides: Partial<AuthPayload> = {}): AuthPayload {
  return {
    accessToken: "access-token",
    accessTokenExpiresAt: "2026-05-03T12:00:00.000Z",
    refreshToken: null,
    refreshTokenExpiresAt: "2026-05-10T12:00:00.000Z",
    principal: {
      userId: "1",
      subject: "user@example.com",
      provider: "local",
      displayName: "Test User",
      roles: ["user"],
      permissions: ["chat:write"],
    },
    ...overrides,
  };
}

function createMemoryStorage(): AuthSessionHintStorageBackend & {
  entries: Map<string, string>;
} {
  const entries = new Map<string, string>();

  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

test("createAuthSessionFromPayload parses timestamps and clones principal arrays", () => {
  const payload = createPayload();
  const session = createAuthSessionFromPayload(payload);

  assert.equal(session.accessToken, "access-token");
  assert.equal(
    session.accessTokenExpiresAt,
    Date.parse("2026-05-03T12:00:00.000Z"),
  );
  assert.deepEqual(session.principal.roles, ["user"]);
  assert.deepEqual(session.principal.permissions, ["chat:write"]);
  assert.notEqual(session.principal.roles, payload.principal.roles);
  assert.notEqual(session.principal.permissions, payload.principal.permissions);
});

test("createWebappAuthSession manages hints, transport hooks, and subscriptions", () => {
  const storage = createMemoryStorage();
  const sessionHintStorage = createAuthSessionHintStorage({ storage });
  let handledPayload: AuthPayload | null = null;
  let cleared = false;
  const transport: RefreshTokenTransportStrategy = {
    ...cookieRefreshTokenTransport,
    handleAuthPayload: (payload) => {
      handledPayload = payload;
    },
    clear: () => {
      cleared = true;
    },
  };
  const authSession = createWebappAuthSession({
    sessionHintStorage,
    refreshTokenTransport: transport,
  });
  const emittedStatuses: string[] = [];
  const unsubscribe = authSession.subscribeAuthState(() => {
    emittedStatuses.push(authSession.getAuthState().status);
  });
  const payload = createPayload();

  assert.deepEqual(authSession.getAuthState(), {
    status: "unknown",
    sessionHint: null,
  });

  const session = authSession.setAuthSessionFromPayload(payload);

  assert.equal(handledPayload, payload);
  assert.equal(session.accessToken, "access-token");
  assert.equal(authSession.getAccessToken(), "access-token");
  assert.equal(authSession.getAuthSession(), session);
  assert.equal(storage.entries.has("webapp:auth-session-hint"), true);
  assert.equal(
    shouldShowAuthenticatedNavigation(authSession.getAuthState()),
    true,
  );

  authSession.clearAuthSession();
  unsubscribe();
  authSession.setAuthSessionFromPayload(payload);

  assert.equal(cleared, true);
  assert.equal(storage.entries.has("webapp:auth-session-hint"), true);
  assert.deepEqual(emittedStatuses, ["authenticated", "anonymous"]);
});

test("auth error helpers detect GraphQL auth-required errors", () => {
  const error = {
    message: "wrapped",
    extensions: {
      originalError: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required.",
        statusCode: 401,
      },
    },
  };

  const apiError = createAuthApiErrorFromGraphqlErrors([error]);

  assert.equal(apiError instanceof AuthApiError, true);
  assert.equal(apiError.message, "Authentication is required.");
  assert.equal(apiError.code, "AUTH_REQUIRED");
  assert.equal(hasAuthRequiredGraphqlErrors({ errors: [error] }), true);
});

test("createWebappAuthGraphqlApi deduplicates refresh and clears on logout", async () => {
  const payload = createPayload();
  const requests: Array<{ query: string; body: unknown }> = [];
  const fetchImplementation: WebappAuthFetch = async (_endpoint, init) => {
    requests.push({
      query: JSON.parse(init.body).query,
      body: JSON.parse(init.body),
    });

    return {
      ok: true,
      status: 200,
      json: async () =>
        requests.length === 1
          ? { data: { refresh: payload } }
          : { data: { logout: true } },
    };
  };
  const refreshedPayloads: AuthPayload[] = [];
  let clears = 0;
  const api = createWebappAuthGraphqlApi({
    graphqlEndpoint: "https://example.com/graphql",
    refreshTokenTransport: cookieRefreshTokenTransport,
    setAuthSessionFromPayload: (nextPayload) => {
      refreshedPayloads.push(nextPayload);
      return createAuthSessionFromPayload(nextPayload);
    },
    clearAuthSession: () => {
      clears += 1;
    },
    fetch: fetchImplementation,
  });

  const [firstRefresh, secondRefresh] = await Promise.all([
    api.refreshStoredAuthSession(),
    api.refreshStoredAuthSession(),
  ]);
  await api.logoutCurrentSession();

  assert.equal(firstRefresh?.accessToken, "access-token");
  assert.equal(secondRefresh?.accessToken, "access-token");
  assert.equal(refreshedPayloads.length, 1);
  assert.equal(requests.length, 2);
  assert.match(requests[0].query, /mutation WebappRefresh/);
  assert.match(requests[1].query, /mutation WebappLogout/);
  assert.equal(clears, 1);
});

test("createWebappAuthSessionBootstrap only refreshes unknown state", async () => {
  let status: "unknown" | "anonymous" = "unknown";
  let refreshes = 0;
  const bootstrap = createWebappAuthSessionBootstrap({
    getAuthState: () =>
      status === "unknown"
        ? { status: "unknown", sessionHint: null }
        : { status: "anonymous" },
    refreshStoredAuthSession: async () => {
      refreshes += 1;
      return null;
    },
  });

  await Promise.all([bootstrap(), bootstrap()]);
  status = "anonymous";
  await bootstrap();

  assert.equal(refreshes, 1);
});

test("getAuthRequestCredentials returns the transport credentials", () => {
  assert.equal(
    getAuthRequestCredentials(cookieRefreshTokenTransport),
    "include",
  );
});
