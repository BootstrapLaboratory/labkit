import assert from "node:assert/strict";
import test from "node:test";
import type { Client, ClientOptions } from "graphql-ws";
import type {
  Environment,
  GraphQLResponse,
  OperationType,
  RequestParameters,
} from "relay-runtime";
import type { PreloadedQuery } from "react-relay";
import {
  appendRootFieldRecordIfMissing,
  createRouteQueryLifetime,
  createAuthAwareRelayGraphqlWsConnectionParams,
  createAuthAwareRelayFetchFunction,
  createRelayGraphqlWsConnectionParams,
  createRelaySubscribeFunction,
  createUnauthorizedGraphqlResponse,
  createWebappRelayRealtimeClient,
  DefaultWebappRelayRuntime,
  fetchRelayGraphqlOnce,
  loadRouteQuery,
  shouldRefreshRelayAuthSessionForRealtime,
  terminateRealtimeClientOnAuthTokenChange,
  type GraphqlRelayAuthAdapter,
  type GraphqlRelayFetch,
  type GraphqlRelayAuthSessionLike,
  type LoadRouteQueryLifetimeOptions,
  type LoadRouteQueryOptions,
  type RouteAbortSignal,
  type RouteQueryLifetime,
  type RouteQueryOwnerSignal,
} from "../src/index";

function createRequest(name: string, text = "query Test { node }") {
  return { name, text } as RequestParameters;
}

function createAuthAdapter(
  overrides: Partial<GraphqlRelayAuthAdapter> = {},
): GraphqlRelayAuthAdapter {
  return {
    getAccessToken: () => null,
    getAuthSession: () => null,
    getAuthRequestCredentials: () => "include",
    hasAuthRequiredGraphqlErrors: () => false,
    refreshStoredAuthSession: async () => null,
    subscribeAuthState: () => () => {},
    ...overrides,
  };
}

function createFakeClient(onTerminate?: () => void): Client {
  return {
    dispose: () => {},
    iterate: async function* () {},
    on: () => () => {},
    subscribe: () => () => {},
    terminate: () => {
      onTerminate?.();
    },
  };
}

type TestRouteQuery = OperationType & {
  readonly variables: {
    id: string;
  };
  readonly response: {
    viewer: {
      id: string;
    };
  };
};

class TestRouteQueryOwnerSignal implements RouteQueryOwnerSignal {
  public aborted = false;
  public addCalls = 0;
  public reason: unknown;
  public removeCalls = 0;

  private readonly listeners = new Set<() => void>();

  public addEventListener(
    type: "abort",
    listener: () => void,
    _options?: { once?: boolean },
  ): void {
    assert.equal(type, "abort");
    this.addCalls += 1;
    this.listeners.add(listener);
  }

  public removeEventListener(type: "abort", listener: () => void): void {
    assert.equal(type, "abort");
    this.removeCalls += 1;
    this.listeners.delete(listener);
  }

  public abort(reason?: unknown): void {
    if (this.aborted) {
      return;
    }

    this.aborted = true;
    this.reason = reason;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}

test("createRelayGraphqlWsConnectionParams returns bearer authorization when a token exists", () => {
  assert.deepEqual(
    createRelayGraphqlWsConnectionParams(() => null),
    {},
  );
  assert.deepEqual(
    createRelayGraphqlWsConnectionParams(() => "abc"),
    {
      authorization: "Bearer abc",
    },
  );
});

test("shouldRefreshRelayAuthSessionForRealtime detects expiring access tokens", () => {
  const nowMs = Date.parse("2026-05-07T12:00:00.000Z");

  assert.equal(
    shouldRefreshRelayAuthSessionForRealtime({
      authSession: null,
      nowMs,
    }),
    false,
  );
  assert.equal(
    shouldRefreshRelayAuthSessionForRealtime({
      authSession: {
        accessToken: "access-token",
        accessTokenExpiresAt: nowMs + 30_000,
      },
      nowMs,
    }),
    true,
  );
  assert.equal(
    shouldRefreshRelayAuthSessionForRealtime({
      authSession: {
        accessToken: "access-token",
        accessTokenExpiresAt: nowMs + 120_000,
      },
      nowMs,
    }),
    false,
  );
});

test("createAuthAwareRelayGraphqlWsConnectionParams refreshes expiring sessions before returning params", async () => {
  const nowMs = Date.parse("2026-05-07T12:00:00.000Z");
  let session: GraphqlRelayAuthSessionLike | null = {
    accessToken: "old-token",
    accessTokenExpiresAt: nowMs - 1,
  };
  let refreshes = 0;
  const connectionParams = createAuthAwareRelayGraphqlWsConnectionParams({
    auth: createAuthAdapter({
      getAccessToken: () => session?.accessToken ?? null,
      getAuthSession: () => session,
      refreshStoredAuthSession: async () => {
        refreshes += 1;
        session = {
          accessToken: "new-token",
          accessTokenExpiresAt: nowMs + 15 * 60_000,
        };
        return session;
      },
    }),
    now: () => nowMs,
  });

  assert.deepEqual(await connectionParams(), {
    authorization: "Bearer new-token",
  });
  assert.equal(refreshes, 1);
});

test("createAuthAwareRelayGraphqlWsConnectionParams keeps fresh sessions without refresh", async () => {
  const nowMs = Date.parse("2026-05-07T12:00:00.000Z");
  let refreshes = 0;
  const connectionParams = createAuthAwareRelayGraphqlWsConnectionParams({
    auth: createAuthAdapter({
      getAccessToken: () => "fresh-token",
      getAuthSession: () => ({
        accessToken: "fresh-token",
        accessTokenExpiresAt: nowMs + 15 * 60_000,
      }),
      refreshStoredAuthSession: async () => {
        refreshes += 1;
        return null;
      },
    }),
    now: () => nowMs,
  });

  assert.deepEqual(await connectionParams(), {
    authorization: "Bearer fresh-token",
  });
  assert.equal(refreshes, 0);
});

test("createAuthAwareRelayGraphqlWsConnectionParams returns anonymous params when refresh clears a stale session", async () => {
  const nowMs = Date.parse("2026-05-07T12:00:00.000Z");
  let session: GraphqlRelayAuthSessionLike | null = {
    accessToken: "old-token",
    accessTokenExpiresAt: nowMs - 1,
  };
  const connectionParams = createAuthAwareRelayGraphqlWsConnectionParams({
    auth: createAuthAdapter({
      getAccessToken: () => session?.accessToken ?? null,
      getAuthSession: () => session,
      refreshStoredAuthSession: async () => {
        session = null;
        return null;
      },
    }),
    now: () => nowMs,
  });

  assert.deepEqual(await connectionParams(), {});
});

test("fetchRelayGraphqlOnce adds auth headers and maps HTTP 401 to GraphQL auth errors", async () => {
  const fetchCalls: Array<Parameters<GraphqlRelayFetch>> = [];
  const fetchImplementation: GraphqlRelayFetch = async (...args) => {
    fetchCalls.push(args);

    return {
      ok: false,
      status: 401,
      json: async () => ({ data: { ignored: true } }),
    };
  };

  const response = await fetchRelayGraphqlOnce(
    {
      auth: createAuthAdapter({
        getAccessToken: () => "access-token",
      }),
      fetch: fetchImplementation,
      httpEndpoint: "https://example.com/graphql",
    },
    createRequest("ChatQuery"),
    { id: "1" },
  );

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0][0], "https://example.com/graphql");
  assert.equal(fetchCalls[0][1].credentials, "include");
  assert.deepEqual(fetchCalls[0][1].headers, {
    "Content-Type": "application/json",
    authorization: "Bearer access-token",
  });
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), {
    query: "query Test { node }",
    variables: { id: "1" },
  });
  assert.deepEqual(response, createUnauthorizedGraphqlResponse());
});

test("createAuthAwareRelayFetchFunction refreshes once and retries non-auth operations", async () => {
  const responses: GraphQLResponse[] = [
    createUnauthorizedGraphqlResponse(),
    { data: { viewer: { id: "1" } } },
  ];
  let refreshes = 0;
  const fetchImplementation: GraphqlRelayFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => responses.shift()!,
  });
  const fetchGraphql = createAuthAwareRelayFetchFunction({
    auth: createAuthAdapter({
      hasAuthRequiredGraphqlErrors: (payload) =>
        Array.isArray((payload as { errors?: unknown }).errors),
      refreshStoredAuthSession: async () => {
        refreshes += 1;
        return {};
      },
    }),
    fetch: fetchImplementation,
    httpEndpoint: "https://example.com/graphql",
  });

  const response = await fetchGraphql(createRequest("ChatQuery"), {}, {});

  assert.deepEqual(response, { data: { viewer: { id: "1" } } });
  assert.equal(refreshes, 1);
});

test("createAuthAwareRelayFetchFunction does not refresh auth operations", async () => {
  let refreshes = 0;
  const fetchGraphql = createAuthAwareRelayFetchFunction({
    auth: createAuthAdapter({
      hasAuthRequiredGraphqlErrors: () => true,
      refreshStoredAuthSession: async () => {
        refreshes += 1;
        return {};
      },
    }),
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => createUnauthorizedGraphqlResponse(),
    }),
    httpEndpoint: "https://example.com/graphql",
  });

  await fetchGraphql(createRequest("LoginMutation"), {}, {});

  assert.equal(refreshes, 0);
});

test("createRelaySubscribeFunction forwards Relay operations to graphql-ws", () => {
  const subscriptions: unknown[] = [];
  const wsClient: Client = {
    ...createFakeClient(),
    subscribe: (payload) => {
      subscriptions.push(payload);
      return () => {};
    },
  };
  const subscribe = createRelaySubscribeFunction({ wsClient });
  const observable = subscribe(
    createRequest("MessageAdded", "subscription { messageAdded }"),
    {
      roomId: "1",
    },
    {},
  );

  assert.ok("subscribe" in observable);
  observable.subscribe({
    next: () => {},
    error: () => {},
    complete: () => {},
  });

  assert.deepEqual(subscriptions, [
    {
      operationName: "MessageAdded",
      query: "subscription { messageAdded }",
      variables: { roomId: "1" },
    },
  ]);
});

test("terminateRealtimeClientOnAuthTokenChange terminates only when the token changes", () => {
  let token: string | null = null;
  const authListener: {
    current?: () => void;
  } = {};
  let terminates = 0;

  terminateRealtimeClientOnAuthTokenChange({
    getAccessToken: () => token,
    subscribeAuthState: (nextListener) => {
      authListener.current = nextListener;
      return () => {};
    },
    wsClient: createFakeClient(() => {
      terminates += 1;
    }),
  });

  authListener.current?.();
  token = "next";
  authListener.current?.();
  authListener.current?.();

  assert.equal(terminates, 1);
});

test("createWebappRelayRealtimeClient uses an explicit realtime instance", () => {
  const wsClient = createFakeClient();
  const realtime = {
    getClient: () => wsClient,
  };
  const result = createWebappRelayRealtimeClient({
    auth: createAuthAdapter(),
    httpEndpoint: "https://example.com/graphql",
    realtime,
  });

  assert.equal(result.realtime, realtime);
  assert.equal(result.wsClient, wsClient);
});

test("createWebappRelayRealtimeClient creates default realtime from raw websocket options", async () => {
  const capturedClientOptions: {
    current?: ClientOptions<Record<string, string>>;
  } = {};
  const wsClient = createFakeClient();
  const result = createWebappRelayRealtimeClient({
    auth: createAuthAdapter({
      getAccessToken: () => "access-token",
      getAuthSession: () => ({
        accessToken: "access-token",
        accessTokenExpiresAt: Date.now() + 15 * 60_000,
      }),
    }),
    httpEndpoint: "https://example.com/graphql",
    wsEndpoint: "ws://example.com/graphql",
    realtimeOptions: {
      browserLifecycle: null,
      createClient: (options: ClientOptions<Record<string, string>>) => {
        capturedClientOptions.current = options;
        return wsClient;
      },
      reconnectWatchdogMs: 0,
    },
  });
  const connectionParams = capturedClientOptions.current?.connectionParams;

  assert.notEqual(result.wsClient, wsClient);
  assert.equal(typeof result.wsClient.subscribe, "function");
  assert.equal(capturedClientOptions.current?.url, "ws://example.com/graphql");
  assert.equal(typeof connectionParams, "function");
  assert.deepEqual(
    await (connectionParams as () => Promise<Record<string, string>>)(),
    {
      authorization: "Bearer access-token",
    },
  );
});

test("DefaultWebappRelayRuntime exposes Relay, realtime, and bound state methods", async () => {
  const capturedClientOptions: {
    current?: ClientOptions<Record<string, string>>;
  } = {};
  const wsClient = createFakeClient();
  const runtime = new DefaultWebappRelayRuntime({
    auth: createAuthAdapter(),
    httpEndpoint: "https://example.com/graphql",
    wsEndpoint: "ws://example.com/graphql",
    realtimeOptions: {
      browserLifecycle: null,
      createClient: (options: ClientOptions<Record<string, string>>) => {
        capturedClientOptions.current = options;
        return wsClient;
      },
      reconnectWatchdogMs: 0,
    },
  });

  const getEnvironment = runtime.getEnvironment;
  const getRealtime = runtime.getRealtime;
  const getState = runtime.getRealtimeConnectionState;
  const subscribe = runtime.subscribeToRealtimeConnectionState;

  assert.equal(getEnvironment(), runtime.getEnvironment());
  assert.equal(getRealtime(), runtime.getRealtime());
  assert.equal(getState().status, "idle");
  assert.equal(capturedClientOptions.current?.url, "ws://example.com/graphql");

  let stateNotifications = 0;
  const unsubscribe = subscribe(() => {
    stateNotifications += 1;
  });
  unsubscribe();
  await Promise.resolve(runtime.dispose());
  assert.equal(stateNotifications, 0);
});

test("DefaultWebappRelayRuntime refreshes stale auth before websocket connection params", async () => {
  const nowMs = Date.parse("2026-05-07T12:00:00.000Z");
  const capturedClientOptions: {
    current?: ClientOptions<Record<string, string>>;
  } = {};
  let session: GraphqlRelayAuthSessionLike | null = {
    accessToken: "old-token",
    accessTokenExpiresAt: nowMs - 1,
  };
  let refreshes = 0;
  const runtime = new DefaultWebappRelayRuntime({
    auth: createAuthAdapter({
      getAccessToken: () => session?.accessToken ?? null,
      getAuthSession: () => session,
      refreshStoredAuthSession: async () => {
        refreshes += 1;
        session = {
          accessToken: "new-token",
          accessTokenExpiresAt: nowMs + 15 * 60_000,
        };
        return session;
      },
    }),
    authRefreshPolicy: {
      refreshAccessTokenBeforeExpiresMs: 60_000,
    },
    httpEndpoint: "https://example.com/graphql",
    wsEndpoint: "ws://example.com/graphql",
    realtimeOptions: {
      browserLifecycle: null,
      createClient: (options: ClientOptions<Record<string, string>>) => {
        capturedClientOptions.current = options;
        return createFakeClient();
      },
      reconnectWatchdogMs: 0,
    },
  });

  const connectionParams = capturedClientOptions.current?.connectionParams;

  assert.equal(typeof connectionParams, "function");
  assert.deepEqual(
    await (connectionParams as () => Promise<Record<string, string>>)(),
    {
      authorization: "Bearer new-token",
    },
  );
  assert.equal(refreshes, 1);
  await Promise.resolve(runtime.dispose());
});

test("DefaultWebappRelayRuntime does not terminate realtime for its own connection-param auth refresh", async () => {
  const nowMs = Date.parse("2026-05-07T12:00:00.000Z");
  const capturedClientOptions: {
    current?: ClientOptions<Record<string, string>>;
  } = {};
  const authListener: {
    current?: () => void;
  } = {};
  let session: GraphqlRelayAuthSessionLike | null = {
    accessToken: "old-token",
    accessTokenExpiresAt: nowMs - 1,
  };
  let terminates = 0;
  const runtime = new DefaultWebappRelayRuntime({
    auth: createAuthAdapter({
      getAccessToken: () => session?.accessToken ?? null,
      getAuthSession: () => session,
      refreshStoredAuthSession: async () => {
        session = {
          accessToken: "new-token",
          accessTokenExpiresAt: nowMs + 15 * 60_000,
        };
        authListener.current?.();
        return session;
      },
      subscribeAuthState: (listener) => {
        authListener.current = listener;
        return () => {
          authListener.current = undefined;
        };
      },
    }),
    httpEndpoint: "https://example.com/graphql",
    wsEndpoint: "ws://example.com/graphql",
    realtimeOptions: {
      browserLifecycle: null,
      createClient: (options: ClientOptions<Record<string, string>>) => {
        capturedClientOptions.current = options;
        return createFakeClient(() => {
          terminates += 1;
        });
      },
      reconnectWatchdogMs: 0,
    },
  });

  const connectionParams = capturedClientOptions.current?.connectionParams;

  assert.equal(typeof connectionParams, "function");
  assert.deepEqual(
    await (connectionParams as () => Promise<Record<string, string>>)(),
    {
      authorization: "Bearer new-token",
    },
  );
  assert.equal(terminates, 0);

  session = {
    accessToken: "next-token",
    accessTokenExpiresAt: nowMs + 15 * 60_000,
  };
  authListener.current?.();

  assert.equal(terminates, 1);
  await Promise.resolve(runtime.dispose());
});

test("createRouteQueryLifetime waits for the final consumer after route abort", () => {
  const routeAbortSignal = new TestRouteQueryOwnerSignal();
  const lifetime = createRouteQueryLifetime({ routeAbortSignal });
  const releaseFirst = lifetime.acquire();
  const releaseSecond = lifetime.acquire();
  let aborts = 0;

  lifetime.abortSignal.addEventListener("abort", () => {
    aborts += 1;
  });
  routeAbortSignal.abort("route-replaced");

  assert.equal(lifetime.abortSignal.aborted, false);
  assert.equal(routeAbortSignal.addCalls, 1);
  assert.equal(routeAbortSignal.removeCalls, 1);

  releaseFirst();
  releaseFirst();
  assert.equal(lifetime.abortSignal.aborted, false);

  releaseSecond();
  releaseSecond();
  assert.equal(lifetime.abortSignal.aborted, true);
  assert.equal(aborts, 1);
  assert.equal((lifetime.abortSignal as AbortSignal).reason, "route-replaced");
});

test("createRouteQueryLifetime aborts unmounted work with its route", () => {
  const routeAbortSignal = new TestRouteQueryOwnerSignal();
  const lifetime = createRouteQueryLifetime({ routeAbortSignal });

  routeAbortSignal.abort(new Error("route-cancelled"));
  routeAbortSignal.abort(new Error("ignored"));

  assert.equal(lifetime.abortSignal.aborted, true);
  assert.equal(routeAbortSignal.removeCalls, 1);
  assert.match(
    String((lifetime.abortSignal as AbortSignal).reason),
    /route-cancelled/u,
  );
});

test("createRouteQueryLifetime handles an already-aborted route signal", () => {
  const routeAbortSignal = new TestRouteQueryOwnerSignal();
  routeAbortSignal.abort("already-aborted");

  const lifetime = createRouteQueryLifetime({ routeAbortSignal });

  assert.equal(lifetime.abortSignal.aborted, true);
  assert.equal(routeAbortSignal.addCalls, 0);
  assert.equal(routeAbortSignal.removeCalls, 0);
  assert.throws(
    () => lifetime.acquire(),
    /Cannot acquire an aborted route query lifetime/u,
  );
});

test("createRouteQueryLifetime terminal abort is immediate and idempotent", () => {
  const routeAbortSignal = new TestRouteQueryOwnerSignal();
  const lifetime = createRouteQueryLifetime({ routeAbortSignal });
  const release = lifetime.acquire();
  let aborts = 0;
  lifetime.abortSignal.addEventListener("abort", () => {
    aborts += 1;
  });

  lifetime.abort("partial-construction-failure");
  lifetime.abort("ignored");
  release();
  release();
  routeAbortSignal.abort("ignored-route-abort");

  assert.equal(lifetime.abortSignal.aborted, true);
  assert.equal(aborts, 1);
  assert.equal(routeAbortSignal.removeCalls, 1);
  assert.equal(
    (lifetime.abortSignal as AbortSignal).reason,
    "partial-construction-failure",
  );
  assert.throws(
    () => lifetime.acquire(),
    /Cannot acquire an aborted route query lifetime/u,
  );
});

test("loadRouteQuery keeps lifetime-owned work until its final owner releases", () => {
  const routeAbortSignal = new TestRouteQueryOwnerSignal();
  const lifetime = createRouteQueryLifetime({ routeAbortSignal });
  const releaseMountedOwner = lifetime.acquire();
  let disposals = 0;

  loadRouteQuery<TestRouteQuery>({
    environment: {} as Environment,
    lifetime,
    loadQuery: () =>
      ({
        dispose: () => {
          disposals += 1;
        },
      }) as PreloadedQuery<TestRouteQuery>,
    query: {} as never,
    variables: { id: "1" },
  });

  routeAbortSignal.abort("route-replaced");
  assert.equal(disposals, 0);

  releaseMountedOwner();
  releaseMountedOwner();
  assert.equal(disposals, 1);
});

test("loadRouteQuery retains the deprecated raw abort-signal behavior", () => {
  const abortController = new AbortController();
  let disposals = 0;
  const queryRef = {
    dispose: () => {
      disposals += 1;
    },
  } as PreloadedQuery<TestRouteQuery>;

  const loadedQueryRef = loadRouteQuery<TestRouteQuery>({
    abortSignal: abortController.signal,
    environment: {} as Environment,
    fetchPolicy: "store-or-network",
    loadQuery: (_environment, _query, variables, options) => {
      assert.deepEqual(variables, { id: "1" });
      assert.equal(options?.fetchPolicy, "store-or-network");
      return queryRef;
    },
    query: {} as never,
    variables: { id: "1" },
  });

  abortController.abort();
  abortController.abort();

  assert.equal(loadedQueryRef, queryRef);
  assert.equal(disposals, 1);
});

test("loadRouteQuery disposes immediately for an already-aborted raw signal", () => {
  const abortController = new AbortController();
  let disposals = 0;
  abortController.abort();

  loadRouteQuery<TestRouteQuery>({
    abortSignal: abortController.signal,
    environment: {} as Environment,
    loadQuery: () =>
      ({
        dispose: () => {
          disposals += 1;
        },
      }) as PreloadedQuery<TestRouteQuery>,
    query: {} as never,
    variables: { id: "1" },
  });

  assert.equal(disposals, 1);
});

test("loadRouteQuery registers one raw-signal disposal listener", () => {
  const listeners: Array<{
    listener: () => void;
    options?: { once?: boolean };
    type: "abort";
  }> = [];
  let disposals = 0;
  const abortSignal = {
    aborted: false,
    addEventListener: (
      type: "abort",
      listener: () => void,
      options?: { once?: boolean },
    ) => {
      listeners.push({ type, listener, options });
    },
  };

  loadRouteQuery<TestRouteQuery>({
    abortSignal,
    environment: {} as Environment,
    loadQuery: () =>
      ({
        dispose: () => {
          disposals += 1;
        },
      }) as PreloadedQuery<TestRouteQuery>,
    query: {} as never,
    variables: { id: "1" },
  });

  assert.equal(listeners.length, 1);
  assert.equal(listeners[0].type, "abort");
  assert.deepEqual(listeners[0].options, { once: true });
  assert.equal(disposals, 0);

  listeners[0].listener();
  listeners[0].listener();

  assert.equal(disposals, 1);
});

test("loadRouteQuery options accept exactly one ownership input", () => {
  const baseOptions = {
    environment: {} as Environment,
    query: {} as never,
    variables: { id: "1" },
  };
  const lifetime = {} as RouteQueryLifetime;
  const abortSignal = {} as RouteAbortSignal;
  const lifetimeOptions: LoadRouteQueryLifetimeOptions<TestRouteQuery> = {
    ...baseOptions,
    lifetime,
  };
  const legacyOptions: LoadRouteQueryOptions<TestRouteQuery> = {
    ...baseOptions,
    abortSignal,
  };
  const mixedOptions: LoadRouteQueryLifetimeOptions<TestRouteQuery> = {
    ...baseOptions,
    // @ts-expect-error Lifetime and raw abort-signal ownership are exclusive.
    abortSignal,
    lifetime,
  };
  // @ts-expect-error A lifetime-based query load requires its ownership input.
  const missingOptions: LoadRouteQueryLifetimeOptions<TestRouteQuery> =
    baseOptions;

  assert.equal(lifetimeOptions.lifetime, lifetime);
  assert.equal(legacyOptions.abortSignal, abortSignal);
  assert.throws(
    () => loadRouteQuery(mixedOptions),
    /requires exactly one of lifetime or abortSignal/u,
  );
  assert.throws(
    () => loadRouteQuery(missingOptions),
    /requires exactly one of lifetime or abortSignal/u,
  );
});

test("appendRootFieldRecordIfMissing appends unique root records", () => {
  const records = [{ getDataID: () => "existing" }];
  const incoming = { getDataID: () => "incoming" };
  let linkedRecords = records;
  const root = {
    getLinkedRecords: () => linkedRecords,
    setLinkedRecords: (nextRecords: typeof records) => {
      linkedRecords = nextRecords;
    },
  };
  const store = {
    getRoot: () => root,
    getRootField: () => incoming,
  };

  appendRootFieldRecordIfMissing(store as never, "addMessage", "getMessages");
  appendRootFieldRecordIfMissing(store as never, "addMessage", "getMessages");

  assert.equal(linkedRecords.length, 2);
  assert.equal(linkedRecords[1], incoming);
});
