import {
  createClient as createGraphqlWsClient,
  type Client,
  type ClientOptions,
} from "graphql-ws";
import { parseFiniteNumber } from "@omgjs/labkit-runtime-config";
import {
  createExternalStore,
  type ExternalStoreUnsubscribe,
} from "@omgjs/labkit-webapp-external-store";

export type GraphqlWsConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "retrying"
  | "disconnected";

export type GraphqlWsConnectionState = {
  status: GraphqlWsConnectionStatus;
  attempt: number;
  closeCode: number | null;
  detail: string | null;
  browserOnline: boolean;
};

export type GraphqlWsCloseLike = {
  code?: number;
  reason?: string;
};

export type GraphqlWsConnectionParamsFactory = () => Record<string, string>;

export type WebappRealtimeLogger = {
  info(message: string, details?: Record<string, unknown>): void;
};

export type WebappRealtimeBrowserNetwork = {
  isOnline(): boolean;
  addEventListener(type: "offline" | "online", listener: () => void): void;
};

export type GraphqlWsClientFactory = (
  options: ClientOptions<Record<string, string>>,
) => Client;

export type CreateWebappRealtimeConnectionOptions = {
  browserNetwork?: WebappRealtimeBrowserNetwork | null;
  connectionAckWaitTimeoutMs?: number;
  createClient?: GraphqlWsClientFactory;
  fatalCloseCodes?: ReadonlySet<number> | readonly number[];
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  logger?: WebappRealtimeLogger;
  logReconnects?: boolean;
  random?: () => number;
  reconnectWatchdogMs?: number;
};

export type WebappRealtimeConnection = {
  createRealtimeGraphqlWsClient(
    url: string,
    connectionParams?: GraphqlWsConnectionParamsFactory,
  ): Client;
  getRealtimeConnectionState(): GraphqlWsConnectionState;
  subscribeToRealtimeConnectionState(
    listener: () => void,
  ): ExternalStoreUnsubscribe;
};

type GlobalBrowserNetwork = typeof globalThis & {
  navigator?: {
    onLine?: boolean;
  };
  window?: {
    addEventListener(type: "offline" | "online", listener: () => void): void;
  };
};

export const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 5_000;
export const DEFAULT_RECONNECT_WATCHDOG_MS = 30_000;
export const DEFAULT_CONNECTION_ACK_WAIT_TIMEOUT_MS = 15_000;
export const DEFAULT_FATAL_CLOSE_CODES = [
  4400, 4401, 4403, 4406, 4409, 4429,
] as const;

export function parseRealtimeReconnectWatchdogMs(
  value: string | null | undefined,
): number {
  return parseFiniteNumber(value, DEFAULT_RECONNECT_WATCHDOG_MS, { min: 0 });
}

export function isGraphqlWsCloseLike(
  value: unknown,
): value is GraphqlWsCloseLike {
  return typeof value === "object" && value !== null && "code" in value;
}

export function getGraphqlWsCloseDetail(
  event: GraphqlWsCloseLike,
): string | null {
  if (!event.reason) {
    return null;
  }

  return event.reason.trim() || null;
}

export function isFatalGraphqlWsCloseCode(
  code: number | undefined,
  fatalCloseCodes:
    | ReadonlySet<number>
    | readonly number[] = DEFAULT_FATAL_CLOSE_CODES,
): boolean {
  const knownFatalCloseCodes =
    fatalCloseCodes instanceof Set ? fatalCloseCodes : new Set(fatalCloseCodes);

  return typeof code === "number" && knownFatalCloseCodes.has(code);
}

export function getRealtimeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" && error.length > 0 ? error : "unknown";
}

export function getRealtimeConnectionMessage(
  state: GraphqlWsConnectionState,
): string | null {
  if (!state.browserOnline) {
    return "Browser is offline. Live updates will reconnect when the network returns.";
  }

  switch (state.status) {
    case "idle":
    case "connected":
      return "Connected to server";
    case "connecting":
      return "Connecting live updates...";
    case "retrying":
      return state.attempt > 1
        ? `Reconnecting live updates... attempt ${state.attempt}`
        : "Reconnecting live updates...";
    case "disconnected": {
      const reason = state.detail ? ` ${state.detail}` : "";
      return `Live updates disconnected.${reason}`;
    }
  }
}

function createDefaultBrowserNetwork(): WebappRealtimeBrowserNetwork | null {
  const globalScope = globalThis as GlobalBrowserNetwork;
  if (!globalScope.window || !globalScope.navigator) {
    return null;
  }

  return {
    isOnline: () => Boolean(globalScope.navigator?.onLine),
    addEventListener: (type, listener) => {
      globalScope.window?.addEventListener(type, listener);
    },
  };
}

function createFatalCloseCodeSet(
  fatalCloseCodes: ReadonlySet<number> | readonly number[] | undefined,
): ReadonlySet<number> {
  if (!fatalCloseCodes) {
    return new Set(DEFAULT_FATAL_CLOSE_CODES);
  }

  return fatalCloseCodes instanceof Set
    ? fatalCloseCodes
    : new Set(fatalCloseCodes);
}

export function createWebappRealtimeConnection(
  options: CreateWebappRealtimeConnectionOptions = {},
): WebappRealtimeConnection {
  const browserNetwork =
    options.browserNetwork === undefined
      ? createDefaultBrowserNetwork()
      : options.browserNetwork;
  const createClient = options.createClient ?? createGraphqlWsClient;
  const fatalCloseCodes = createFatalCloseCodeSet(options.fatalCloseCodes);
  const heartbeatIntervalMs =
    options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const heartbeatTimeoutMs =
    options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
  const connectionAckWaitTimeoutMs =
    options.connectionAckWaitTimeoutMs ??
    DEFAULT_CONNECTION_ACK_WAIT_TIMEOUT_MS;
  const reconnectWatchdogMs =
    options.reconnectWatchdogMs ?? DEFAULT_RECONNECT_WATCHDOG_MS;
  const random = options.random ?? Math.random;
  const logger = options.logger ?? console;
  const shouldLogReconnects = options.logReconnects === true;
  const connectionStateStore = createExternalStore<GraphqlWsConnectionState>({
    status: "idle",
    attempt: 0,
    closeCode: null,
    detail: null,
    browserOnline: browserNetwork?.isOnline() ?? true,
  });

  let browserNetworkListenersInitialized = false;
  let heartbeatTimeout: ReturnType<typeof setTimeout> | undefined;
  let reconnectWatchdogTimeout: ReturnType<typeof setTimeout> | undefined;

  const getRealtimeConnectionState = () => connectionStateStore.getSnapshot();
  const setConnectionState = (nextState: Partial<GraphqlWsConnectionState>) => {
    connectionStateStore.updateSnapshot((connectionState) => ({
      ...connectionState,
      ...nextState,
    }));
  };
  const logRealtime = (message: string, details?: Record<string, unknown>) => {
    if (!shouldLogReconnects) {
      return;
    }

    if (details) {
      logger.info(`[realtime] ${message}`, details);
      return;
    }

    logger.info(`[realtime] ${message}`);
  };
  const clearHeartbeatTimeout = () => {
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = undefined;
    }
  };
  const clearReconnectWatchdog = () => {
    if (reconnectWatchdogTimeout) {
      clearTimeout(reconnectWatchdogTimeout);
      reconnectWatchdogTimeout = undefined;
    }
  };
  const isReconnectInProgress = () => {
    const connectionState = getRealtimeConnectionState();
    return (
      connectionState.status === "connecting" ||
      connectionState.status === "retrying"
    );
  };
  const initializeBrowserNetworkListeners = () => {
    if (browserNetworkListenersInitialized || !browserNetwork) {
      return;
    }

    browserNetworkListenersInitialized = true;

    const syncBrowserNetworkState = () => {
      const connectionState = getRealtimeConnectionState();
      const browserOnline = browserNetwork.isOnline();

      setConnectionState({
        browserOnline,
        detail: browserOnline
          ? connectionState.detail
          : "The browser is offline.",
      });
    };

    browserNetwork.addEventListener("offline", syncBrowserNetworkState);
    browserNetwork.addEventListener("online", syncBrowserNetworkState);
    syncBrowserNetworkState();
  };

  return {
    createRealtimeGraphqlWsClient: (url, connectionParams) => {
      initializeBrowserNetworkListeners();

      const startReconnectWatchdog = (client: Client) => {
        clearReconnectWatchdog();
        if (
          reconnectWatchdogMs === 0 ||
          !getRealtimeConnectionState().browserOnline
        ) {
          return;
        }

        reconnectWatchdogTimeout = setTimeout(() => {
          reconnectWatchdogTimeout = undefined;

          if (
            !getRealtimeConnectionState().browserOnline ||
            !isReconnectInProgress()
          ) {
            return;
          }

          setConnectionState({
            detail: "Live updates reconnect timed out. Restarting the socket.",
          });
          logRealtime(
            "Live GraphQL reconnect watchdog timed out. Terminating socket.",
            { timeoutMs: reconnectWatchdogMs },
          );
          client.terminate();
          startReconnectWatchdog(client);
        }, reconnectWatchdogMs);
      };

      const wsClient = createClient({
        url,
        connectionParams,
        lazy: true,
        keepAlive: heartbeatIntervalMs,
        connectionAckWaitTimeout: connectionAckWaitTimeoutMs,
        retryAttempts: Number.POSITIVE_INFINITY,
        retryWait: async (retries) => {
          const cappedRetries = Math.min(retries, 4);
          const baseDelayMs = 1_000 * 2 ** cappedRetries;
          const jitterMs = Math.floor(random() * 1_000);
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(baseDelayMs + jitterMs, 15_000)),
          );
        },
        shouldRetry: (eventOrError) => {
          if (isGraphqlWsCloseLike(eventOrError)) {
            return !isFatalGraphqlWsCloseCode(
              eventOrError.code,
              fatalCloseCodes,
            );
          }

          return true;
        },
        on: {
          connecting: (isRetrying) => {
            clearHeartbeatTimeout();
            const nextAttempt = isRetrying
              ? getRealtimeConnectionState().attempt + 1
              : 0;
            setConnectionState({
              status: isRetrying ? "retrying" : "connecting",
              attempt: nextAttempt,
              closeCode: null,
              detail: null,
            });
            logRealtime(
              isRetrying
                ? "Attempting to reconnect the live GraphQL connection."
                : "Opening the live GraphQL connection.",
              { attempt: nextAttempt },
            );
            startReconnectWatchdog(wsClient);
          },
          connected: (_socket, _payload, wasRetry) => {
            clearHeartbeatTimeout();
            clearReconnectWatchdog();
            setConnectionState({
              status: "connected",
              attempt: 0,
              closeCode: null,
              detail: null,
            });
            logRealtime(
              wasRetry
                ? "Live GraphQL connection re-established."
                : "Live GraphQL connection established.",
            );
          },
          ping: (received) => {
            if (received) {
              return;
            }

            clearHeartbeatTimeout();
            heartbeatTimeout = setTimeout(() => {
              setConnectionState({
                status: "retrying",
                detail: "Live updates heartbeat timed out.",
              });
              logRealtime(
                "No pong received in time. Terminating stuck socket.",
              );
              wsClient.terminate();
              startReconnectWatchdog(wsClient);
            }, heartbeatTimeoutMs);
          },
          pong: (received) => {
            if (!received) {
              return;
            }

            clearHeartbeatTimeout();
          },
          closed: (event) => {
            clearHeartbeatTimeout();
            if (!isGraphqlWsCloseLike(event)) {
              setConnectionState({
                status: "retrying",
                closeCode: null,
                detail: "The live connection closed unexpectedly.",
              });
              logRealtime("Live GraphQL connection closed unexpectedly.");
              startReconnectWatchdog(wsClient);
              return;
            }

            const isFatalClose = isFatalGraphqlWsCloseCode(
              event.code,
              fatalCloseCodes,
            );
            setConnectionState({
              status: isFatalClose ? "disconnected" : "retrying",
              closeCode: event.code ?? null,
              detail: getGraphqlWsCloseDetail(event),
            });
            logRealtime("Live GraphQL connection closed.", {
              code: event.code ?? null,
              reason: getGraphqlWsCloseDetail(event),
              fatal: isFatalClose,
            });
            if (isFatalClose) {
              clearReconnectWatchdog();
              return;
            }

            startReconnectWatchdog(wsClient);
          },
          error: (error) => {
            const connectionState = getRealtimeConnectionState();
            if (
              connectionState.status === "connecting" ||
              connectionState.status === "retrying"
            ) {
              return;
            }

            setConnectionState({
              status: "retrying",
              detail: "The live connection hit a transport error.",
            });
            logRealtime("Live GraphQL connection hit a transport error.", {
              error: getRealtimeErrorMessage(error),
            });
            startReconnectWatchdog(wsClient);
          },
        },
      });

      return wsClient;
    },
    getRealtimeConnectionState,
    subscribeToRealtimeConnectionState: (listener) =>
      connectionStateStore.subscribe(listener),
  };
}
