import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import test from "node:test";
import type {
  Client,
  ClientOptions,
  FormattedExecutionResult,
  Sink,
  SubscribePayload,
} from "graphql-ws";
import {
  DefaultWebappRealtimeConnection,
  createDefaultWebappRealtimeConnection,
  getGraphqlWsCloseDetail,
  getRealtimeConnectionMessage,
  isFatalGraphqlWsCloseCode,
  parseRealtimeReconnectWatchdogMs,
  type RealtimeBrowserLifecycle,
  type RealtimeConnectionState,
} from "../src/index";

type CapturedClientOptions = ClientOptions<Record<string, string>>;

type CapturedSubscription = {
  payload: SubscribePayload;
  sink: Sink<FormattedExecutionResult<unknown, unknown>>;
};

type FakeClient = Client & {
  readonly disposals: () => number;
  readonly subscriptions: CapturedSubscription[];
  readonly terminations: () => number;
};

function createFakeClient(options: {
  onUnsubscribe?: (
    sink: Sink<FormattedExecutionResult<unknown, unknown>>,
  ) => void;
} = {}): FakeClient {
  let disposals = 0;
  let terminations = 0;
  const subscriptions: CapturedSubscription[] = [];

  return {
    dispose: () => {
      disposals += 1;
    },
    iterate: async function* () {},
    on: () => () => {},
    subscribe: <Data = Record<string, unknown>, Extensions = unknown>(
      payload: SubscribePayload,
      sink: Sink<FormattedExecutionResult<Data, Extensions>>,
    ) => {
      subscriptions.push({
        payload,
        sink,
      });

      return () => {
        options.onUnsubscribe?.(sink);
      };
    },
    terminate: () => {
      terminations += 1;
    },
    disposals: () => disposals,
    subscriptions,
    terminations: () => terminations,
  };
}

function createConnectionState(
  overrides: Partial<RealtimeConnectionState>,
): RealtimeConnectionState {
  return {
    status: "idle",
    attempt: 0,
    recoveryAttempt: 0,
    restartCount: 0,
    closeCode: null,
    detail: null,
    recoveryReason: null,
    lastRecoveryAction: "none",
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    lastError: null,
    browserOnline: true,
    innerClientGeneration: 1,
    ...overrides,
  };
}

test("parseRealtimeReconnectWatchdogMs keeps valid values and falls back for invalid ones", () => {
  assert.equal(parseRealtimeReconnectWatchdogMs("15000"), 15_000);
  assert.equal(parseRealtimeReconnectWatchdogMs("0"), 0);
  assert.equal(parseRealtimeReconnectWatchdogMs("-1"), 30_000);
  assert.equal(parseRealtimeReconnectWatchdogMs("not-a-number"), 30_000);
});

test("close-code helpers classify fatal codes and trim reasons", () => {
  assert.equal(isFatalGraphqlWsCloseCode(4401), true);
  assert.equal(isFatalGraphqlWsCloseCode(1011), false);
  assert.equal(
    getGraphqlWsCloseDetail({ reason: " Unauthorized " }),
    "Unauthorized",
  );
  assert.equal(getGraphqlWsCloseDetail({ reason: " " }), null);
});

test("getRealtimeConnectionMessage maps connection state to user text", () => {
  const state = createConnectionState({
    status: "retrying",
    attempt: 2,
  });

  assert.equal(
    getRealtimeConnectionMessage(state),
    "Reconnecting live updates... attempt 2",
  );
  assert.equal(
    getRealtimeConnectionMessage({ ...state, browserOnline: false }),
    "Browser is offline. Live updates will reconnect when the network returns.",
  );
  assert.equal(
    getRealtimeConnectionMessage({
      ...state,
      status: "retrying",
      detail: "Live updates reconnect timed out. Restarting the socket.",
    }),
    "Reconnecting live updates... attempt 2. Live updates reconnect timed out. Restarting the socket.",
  );
  assert.equal(
    getRealtimeConnectionMessage({
      ...state,
      status: "disconnected",
      detail: "Unauthorized",
    }),
    "Live updates disconnected. Unauthorized",
  );
});

test("DefaultWebappRealtimeConnection updates state for retry and fatal close events", () => {
  const capturedClientOptions: {
    current?: CapturedClientOptions;
  } = {};
  let now = new Date("2026-01-01T00:00:00.000Z");
  const client = createFakeClient();
  const connection = new DefaultWebappRealtimeConnection({
    browserLifecycle: null,
    createClient: (options) => {
      capturedClientOptions.current = options;
      return client;
    },
    now: () => now,
    reconnectWatchdogMs: 0,
    wsEndpoint: "ws://example.com/graphql",
  });
  const emittedStatuses: string[] = [];
  connection.subscribeToConnectionState((state) => {
    emittedStatuses.push(state.status);
  });

  const clientOptions = capturedClientOptions.current;
  assert.ok(clientOptions);

  clientOptions.on?.connecting?.(false);
  assert.deepEqual(
    connection.getConnectionState(),
    createConnectionState({
      status: "connecting",
      recoveryReason: "initial-connect",
    }),
  );

  clientOptions.on?.connecting?.(true);
  assert.deepEqual(
    connection.getConnectionState(),
    createConnectionState({
      status: "retrying",
      attempt: 1,
      recoveryReason: "retry",
    }),
  );

  now = new Date("2026-01-01T00:01:00.000Z");
  clientOptions.on?.closed?.({ code: 4401, reason: "Unauthorized" });
  assert.deepEqual(
    connection.getConnectionState(),
    createConnectionState({
      status: "disconnected",
      attempt: 1,
      closeCode: 4401,
      detail: "Unauthorized",
      recoveryReason: "closed",
      lastDisconnectedAt: now,
    }),
  );
  assert.deepEqual(emittedStatuses, [
    "connecting",
    "retrying",
    "disconnected",
  ]);
});

test("createDefaultWebappRealtimeConnection returns the default class", () => {
  const connection = createDefaultWebappRealtimeConnection({
    browserLifecycle: null,
    createClient: () => createFakeClient(),
    reconnectWatchdogMs: 0,
    wsEndpoint: "ws://example.com/graphql",
  });

  assert.ok(connection instanceof DefaultWebappRealtimeConnection);
});

test("DefaultWebappRealtimeConnection syncs browser lifecycle online state", () => {
  let online = true;
  const listeners = new Map<string, () => void>();
  const lifecycle: RealtimeBrowserLifecycle = {
    isOnline: () => online,
    addEventListener: (type, listener) => {
      listeners.set(type, listener);
    },
  };
  const connection = new DefaultWebappRealtimeConnection({
    browserLifecycle: lifecycle,
    createClient: () => createFakeClient(),
    reconnectWatchdogMs: 0,
    wsEndpoint: "ws://example.com/graphql",
  });

  online = false;
  listeners.get("offline")?.();

  assert.deepEqual(
    connection.getConnectionState(),
    createConnectionState({
      detail: "The browser is offline.",
      browserOnline: false,
    }),
  );
});

test("reconnect watchdog terminates first and recreates the inner client on the next timeout", async () => {
  const capturedClientOptions: CapturedClientOptions[] = [];
  const clients: FakeClient[] = [];
  const connection = new DefaultWebappRealtimeConnection({
    browserLifecycle: null,
    createClient: (options) => {
      capturedClientOptions.push(options);
      const client = createFakeClient();
      clients.push(client);
      return client;
    },
    reconnectWatchdogMs: 25,
    wsEndpoint: "ws://example.com/graphql",
  });

  try {
    capturedClientOptions[0].on?.connecting?.(true);
    await wait(35);
    assert.equal(clients[0].terminations(), 1);
    assert.equal(clients.length, 1);

    await wait(35);
    assert.equal(clients[0].disposals(), 1);
    assert.equal(clients.length, 2);
    assert.equal(connection.getConnectionState().restartCount, 1);
    assert.equal(connection.getConnectionState().innerClientGeneration, 2);
  } finally {
    await connection.dispose();
  }
});

test("active subscriptions are resubscribed after inner client recreation", async () => {
  const capturedClientOptions: CapturedClientOptions[] = [];
  const clients: FakeClient[] = [];
  let completes = 0;
  const connection = new DefaultWebappRealtimeConnection({
    browserLifecycle: null,
    createClient: (options) => {
      capturedClientOptions.push(options);
      const client = createFakeClient({
        onUnsubscribe: (sink) => {
          sink.complete();
        },
      });
      clients.push(client);
      return client;
    },
    maxTerminateAttemptsBeforeRestart: 0,
    reconnectWatchdogMs: 5,
    wsEndpoint: "ws://example.com/graphql",
  });
  const payload = {
    query: "subscription MessageAdded { messageAdded { id } }",
  };

  try {
    connection.getClient().subscribe(payload, {
      next: () => {},
      error: () => {},
      complete: () => {
        completes += 1;
      },
    });

    capturedClientOptions[0].on?.connecting?.(true);
    await wait(15);

    assert.equal(clients.length, 2);
    assert.equal(clients[0].subscriptions.length, 1);
    assert.equal(clients[1].subscriptions.length, 1);
    assert.deepEqual(clients[1].subscriptions[0].payload, payload);
    assert.equal(completes, 0);
  } finally {
    await connection.dispose();
  }
});

test("unsubscribed operations are not resubscribed after recreation", async () => {
  const capturedClientOptions: CapturedClientOptions[] = [];
  const clients: FakeClient[] = [];
  const connection = new DefaultWebappRealtimeConnection({
    browserLifecycle: null,
    createClient: (options) => {
      capturedClientOptions.push(options);
      const client = createFakeClient();
      clients.push(client);
      return client;
    },
    maxTerminateAttemptsBeforeRestart: 0,
    reconnectWatchdogMs: 5,
    wsEndpoint: "ws://example.com/graphql",
  });

  try {
    const unsubscribe = connection.getClient().subscribe(
      {
        query: "subscription MessageAdded { messageAdded { id } }",
      },
      {
        next: () => {},
        error: () => {},
        complete: () => {},
      },
    );
    unsubscribe();

    capturedClientOptions[0].on?.connecting?.(true);
    await wait(15);

    assert.equal(clients.length, 2);
    assert.equal(clients[1].subscriptions.length, 0);
  } finally {
    await connection.dispose();
  }
});

test("browser resume recreates a stuck retrying client", async () => {
  const capturedClientOptions: CapturedClientOptions[] = [];
  const clients: FakeClient[] = [];
  const listeners = new Map<string, () => void>();
  const connection = new DefaultWebappRealtimeConnection({
    browserLifecycle: {
      isOnline: () => true,
      isVisible: () => true,
      addEventListener: (type, listener) => {
        listeners.set(type, listener);
      },
    },
    createClient: (options) => {
      capturedClientOptions.push(options);
      const client = createFakeClient();
      clients.push(client);
      return client;
    },
    reconnectWatchdogMs: 0,
    wsEndpoint: "ws://example.com/graphql",
  });

  try {
    capturedClientOptions[0].on?.connecting?.(true);
    listeners.get("visibilitychange")?.();

    assert.equal(clients.length, 2);
    assert.equal(connection.getConnectionState().recoveryReason, "browser-resume");
    assert.equal(connection.getConnectionState().restartCount, 1);
  } finally {
    await connection.dispose();
  }
});
