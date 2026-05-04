import assert from "node:assert/strict";
import test from "node:test";
import type { Client, ClientOptions } from "graphql-ws";
import {
  createWebappRealtimeConnection,
  getGraphqlWsCloseDetail,
  getRealtimeConnectionMessage,
  isFatalGraphqlWsCloseCode,
  parseRealtimeReconnectWatchdogMs,
  type GraphqlWsConnectionState,
} from "../src/index";

function createFakeClient(): Client {
  return {
    dispose: () => {},
    iterate: async function* () {},
    on: () => () => {},
    subscribe: () => () => {},
    terminate: () => {},
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
  const state: GraphqlWsConnectionState = {
    status: "retrying",
    attempt: 2,
    closeCode: null,
    detail: null,
    browserOnline: true,
  };

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
      status: "disconnected",
      detail: "Unauthorized",
    }),
    "Live updates disconnected. Unauthorized",
  );
});

test("createWebappRealtimeConnection updates state for retry and fatal close events", () => {
  const capturedClientOptions: {
    current?: ClientOptions<Record<string, string>>;
  } = {};
  const client = createFakeClient();
  const connection = createWebappRealtimeConnection({
    browserNetwork: null,
    createClient: (options) => {
      capturedClientOptions.current = options;
      return client;
    },
    reconnectWatchdogMs: 0,
  });
  const emittedStatuses: string[] = [];
  connection.subscribeToRealtimeConnectionState(() => {
    emittedStatuses.push(connection.getRealtimeConnectionState().status);
  });

  connection.createRealtimeGraphqlWsClient("ws://example.com/graphql");
  const clientOptions = capturedClientOptions.current;
  assert.ok(clientOptions);

  clientOptions.on?.connecting?.(false);
  assert.deepEqual(connection.getRealtimeConnectionState(), {
    status: "connecting",
    attempt: 0,
    closeCode: null,
    detail: null,
    browserOnline: true,
  });

  clientOptions.on?.connecting?.(true);
  assert.deepEqual(connection.getRealtimeConnectionState(), {
    status: "retrying",
    attempt: 1,
    closeCode: null,
    detail: null,
    browserOnline: true,
  });

  clientOptions.on?.closed?.({ code: 4401, reason: "Unauthorized" });
  assert.deepEqual(connection.getRealtimeConnectionState(), {
    status: "disconnected",
    attempt: 1,
    closeCode: 4401,
    detail: "Unauthorized",
    browserOnline: true,
  });
  assert.deepEqual(emittedStatuses, ["connecting", "retrying", "disconnected"]);
});

test("createWebappRealtimeConnection syncs browser online state", () => {
  let online = true;
  const listeners = new Map<string, () => void>();
  const connection = createWebappRealtimeConnection({
    browserNetwork: {
      isOnline: () => online,
      addEventListener: (type, listener) => {
        listeners.set(type, listener);
      },
    },
    createClient: () => createFakeClient(),
    reconnectWatchdogMs: 0,
  });

  connection.createRealtimeGraphqlWsClient("ws://example.com/graphql");
  online = false;
  listeners.get("offline")?.();

  assert.deepEqual(connection.getRealtimeConnectionState(), {
    status: "idle",
    attempt: 0,
    closeCode: null,
    detail: "The browser is offline.",
    browserOnline: false,
  });
});
