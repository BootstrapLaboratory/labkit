import {
  createClient as createGraphqlWsClient,
  type Client,
  type ClientOptions,
  type Event,
  type EventListener,
  type FormattedExecutionResult,
  type Sink,
  type SubscribePayload,
} from "graphql-ws";
import { parseFiniteNumber } from "@omgjs/labkit-runtime-config";
import {
  createExternalStore,
  type ExternalStore,
  type ExternalStoreUnsubscribe,
} from "@omgjs/labkit-webapp-external-store";

export type RealtimeConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "retrying"
  | "disconnected";

export type RealtimeRecoveryAction = "none" | "terminate" | "restart";

export type RealtimeRecoveryReason =
  | "initial-connect"
  | "retry"
  | "closed"
  | "transport-error"
  | "heartbeat-timeout"
  | "reconnect-watchdog-timeout"
  | "browser-online"
  | "browser-resume";

export type RealtimeConnectionState = {
  status: RealtimeConnectionStatus;
  attempt: number;
  recoveryAttempt: number;
  restartCount: number;
  closeCode: number | null;
  detail: string | null;
  recoveryReason: RealtimeRecoveryReason | null;
  lastRecoveryAction: RealtimeRecoveryAction;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  lastError: string | null;
  browserOnline: boolean;
  innerClientGeneration: number;
};

export type GraphqlWsConnectionStatus = RealtimeConnectionStatus;

export type GraphqlWsConnectionState = RealtimeConnectionState;

export type GraphqlWsCloseLike = {
  code?: number;
  reason?: string;
};

export type GraphqlWsConnectionParamsFactory = () =>
  | Record<string, string>
  | Promise<Record<string, string>>;

export type GraphqlWsConnectionParams =
  | Record<string, string>
  | GraphqlWsConnectionParamsFactory;

export type WebappRealtimeLogger = {
  info(message: string, details?: Record<string, unknown>): void;
};

export type RealtimeBrowserLifecycleEvent =
  | "offline"
  | "online"
  | "pageshow"
  | "visibilitychange";

export type RealtimeBrowserLifecycle = {
  isOnline(): boolean;
  isVisible?(): boolean;
  addEventListener(
    type: RealtimeBrowserLifecycleEvent,
    listener: () => void,
  ): void;
};

export type WebappRealtimeBrowserNetwork = Pick<
  RealtimeBrowserLifecycle,
  "addEventListener" | "isOnline"
>;

export type GraphqlWsTransportFactory = (
  options: ClientOptions<Record<string, string>>,
) => Client;

export type GraphqlWsClientFactory = GraphqlWsTransportFactory;

export type RealtimeReconnectPolicy = {
  retryWait(retries: number): Promise<void>;
  shouldRetry(eventOrError: unknown): boolean;
};

export type RealtimeHeartbeatPolicy = {
  connectionAckWaitTimeoutMs: number;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
};

export type RealtimeRecoveryPolicy = {
  fatalCloseCodes: ReadonlySet<number>;
  maxTerminateAttemptsBeforeRestart: number;
  reconnectWatchdogMs: number;
};

export type RealtimeConnectionStateListener = (
  state: RealtimeConnectionState,
) => void;

export type DefaultWebappRealtimeConnectionOptions = {
  browserLifecycle?: RealtimeBrowserLifecycle | null;
  browserNetwork?: WebappRealtimeBrowserNetwork | null;
  connectionAckWaitTimeoutMs?: number;
  connectionParams?: GraphqlWsConnectionParams;
  createClient?: GraphqlWsTransportFactory;
  fatalCloseCodes?: ReadonlySet<number> | readonly number[];
  heartbeatPolicy?: Partial<RealtimeHeartbeatPolicy>;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  logger?: WebappRealtimeLogger;
  logReconnects?: boolean;
  maxTerminateAttemptsBeforeRestart?: number;
  now?: () => Date;
  random?: () => number;
  reconnectPolicy?: Partial<RealtimeReconnectPolicy>;
  reconnectWatchdogMs?: number;
  recoveryPolicy?: Partial<RealtimeRecoveryPolicy>;
  wsEndpoint: ClientOptions<Record<string, string>>["url"];
};

type GlobalBrowserLifecycle = typeof globalThis & {
  document?: {
    addEventListener(type: "visibilitychange", listener: () => void): void;
    visibilityState?: string;
  };
  navigator?: {
    onLine?: boolean;
  };
  window?: {
    addEventListener(
      type: "offline" | "online" | "pageshow",
      listener: () => void,
    ): void;
  };
};

type ActiveSubscription = {
  closed: boolean;
  generation: number;
  id: number;
  innerUnsubscribe?: () => void;
  payload: SubscribePayload;
  sink: Sink<FormattedExecutionResult<unknown, unknown>>;
};

type FacadeEventListener = (...args: readonly unknown[]) => void;

export const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 5_000;
export const DEFAULT_RECONNECT_WATCHDOG_MS = 30_000;
export const DEFAULT_CONNECTION_ACK_WAIT_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_TERMINATE_ATTEMPTS_BEFORE_RESTART = 1;
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

function getRealtimeShutdownErrorMessage(error: unknown): string {
  if (isGraphqlWsCloseLike(error)) {
    const detail = getGraphqlWsCloseDetail(error);
    if (typeof error.code === "number" && detail) {
      return `${error.code}: ${detail}`;
    }

    if (typeof error.code === "number") {
      return String(error.code);
    }

    return detail ?? "closed";
  }

  return getRealtimeErrorMessage(error);
}

export function getRealtimeConnectionMessage(
  state: RealtimeConnectionState,
): string | null {
  if (!state.browserOnline) {
    return "Browser is offline. Live updates will reconnect when the network returns.";
  }

  switch (state.status) {
    case "idle":
    case "connected":
      return "Connected to server";
    case "connecting":
      return appendRealtimeDetail("Connecting live updates...", state.detail);
    case "retrying": {
      const message =
        state.attempt > 1
          ? `Reconnecting live updates... attempt ${state.attempt}`
          : "Reconnecting live updates...";
      return appendRealtimeDetail(message, state.detail);
    }
    case "disconnected":
      return appendRealtimeDetail("Live updates disconnected.", state.detail);
  }
}

export function createDefaultWebappRealtimeConnection(
  options: DefaultWebappRealtimeConnectionOptions,
): DefaultWebappRealtimeConnection {
  return new DefaultWebappRealtimeConnection(options);
}

function appendRealtimeDetail(message: string, detail: string | null): string {
  if (!detail) {
    return message;
  }

  return message.endsWith(".") ? `${message} ${detail}` : `${message}. ${detail}`;
}

function createDefaultBrowserLifecycle(): RealtimeBrowserLifecycle | null {
  const globalScope = globalThis as GlobalBrowserLifecycle;
  if (!globalScope.window || !globalScope.navigator) {
    return null;
  }

  return {
    isOnline: () => globalScope.navigator?.onLine !== false,
    isVisible: () => globalScope.document?.visibilityState !== "hidden",
    addEventListener: (type, listener) => {
      if (type === "visibilitychange") {
        globalScope.document?.addEventListener(type, listener);
        return;
      }

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

function createInitialConnectionState(
  browserOnline: boolean,
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
    browserOnline,
    innerClientGeneration: 1,
  };
}

function createDefaultRetryWait(
  random: () => number,
): RealtimeReconnectPolicy["retryWait"] {
  return async (retries) => {
    const cappedRetries = Math.min(retries, 4);
    const baseDelayMs = 1_000 * 2 ** cappedRetries;
    const jitterMs = Math.floor(random() * 1_000);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(baseDelayMs + jitterMs, 15_000)),
    );
  };
}

class SelfHealingGraphqlWsClient implements Client {
  private readonly activeSubscriptions = new Map<number, ActiveSubscription>();
  private readonly eventListeners = new Map<Event, Set<FacadeEventListener>>();
  private readonly restartingGenerations = new Set<number>();
  private innerClient: Client;
  private currentGeneration = 0;
  private nextSubscriptionId = 1;

  public constructor(
    private readonly options: {
      createInnerClient(generation: number): Client;
      onRestartShutdownError?(
        error: unknown,
        details: { generation: number; phase: "dispose" | "unsubscribe" },
      ): void;
    },
  ) {
    this.innerClient = this.createNextInnerClient();
  }

  public getCurrentGeneration(): number {
    return this.currentGeneration;
  }

  public isCurrentGeneration(generation: number): boolean {
    return generation === this.currentGeneration;
  }

  public emit<E extends Event>(
    event: E,
    ...args: Parameters<EventListener<E>>
  ): void {
    for (const listener of this.eventListeners.get(event) ?? []) {
      listener(...args);
    }
  }

  public restart(): number {
    const previousGeneration = this.currentGeneration;
    const previousInnerClient = this.innerClient;
    this.restartingGenerations.add(previousGeneration);

    for (const subscription of this.activeSubscriptions.values()) {
      if (subscription.generation === previousGeneration) {
        this.unsubscribeRestartingSubscription(subscription, previousGeneration);
        subscription.innerUnsubscribe = undefined;
      }
    }

    void this.disposeRestartingInnerClient(
      previousInnerClient,
      previousGeneration,
    );
    this.innerClient = this.createNextInnerClient();

    for (const subscription of this.activeSubscriptions.values()) {
      if (!subscription.closed) {
        this.subscribeActiveSubscription(subscription);
      }
    }

    return this.currentGeneration;
  }

  public dispose(): void | Promise<void> {
    for (const subscription of this.activeSubscriptions.values()) {
      subscription.closed = true;
      subscription.innerUnsubscribe?.();
    }

    this.activeSubscriptions.clear();
    return this.innerClient.dispose();
  }

  public on<E extends Event>(event: E, listener: EventListener<E>): () => void {
    let listeners = this.eventListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(event, listeners);
    }

    const facadeListener = listener as FacadeEventListener;
    listeners.add(facadeListener);

    return () => {
      listeners?.delete(facadeListener);
    };
  }

  public subscribe<Data = Record<string, unknown>, Extensions = unknown>(
    payload: SubscribePayload,
    sink: Sink<FormattedExecutionResult<Data, Extensions>>,
  ): () => void {
    const subscription: ActiveSubscription = {
      closed: false,
      generation: this.currentGeneration,
      id: this.nextSubscriptionId,
      payload,
      sink,
    };

    this.nextSubscriptionId += 1;
    this.activeSubscriptions.set(subscription.id, subscription);
    this.subscribeActiveSubscription(subscription);

    return () => {
      subscription.closed = true;
      this.activeSubscriptions.delete(subscription.id);
      subscription.innerUnsubscribe?.();
      subscription.innerUnsubscribe = undefined;
    };
  }

  public async *iterate<Data = Record<string, unknown>, Extensions = unknown>(
    payload: SubscribePayload,
  ): AsyncIterableIterator<FormattedExecutionResult<Data, Extensions>> {
    const queue: Array<FormattedExecutionResult<Data, Extensions>> = [];
    let finished = false;
    let error: unknown;
    let wake: (() => void) | undefined;
    const notify = () => {
      wake?.();
      wake = undefined;
    };
    const unsubscribe = this.subscribe<Data, Extensions>(payload, {
      next: (value) => {
        queue.push(value);
        notify();
      },
      error: (nextError) => {
        error = nextError;
        finished = true;
        notify();
      },
      complete: () => {
        finished = true;
        notify();
      },
    });

    try {
      for (;;) {
        const value = queue.shift();
        if (value) {
          yield value;
          continue;
        }

        if (error) {
          throw error instanceof Error
            ? error
            : new Error(getRealtimeErrorMessage(error));
        }

        if (finished) {
          return;
        }

        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    } finally {
      unsubscribe();
    }
  }

  public terminate(): void {
    this.innerClient.terminate();
  }

  private createNextInnerClient(): Client {
    this.currentGeneration += 1;
    return this.options.createInnerClient(this.currentGeneration);
  }

  private async disposeRestartingInnerClient(
    client: Client,
    generation: number,
  ): Promise<void> {
    try {
      await client.dispose();
    } catch (error) {
      this.options.onRestartShutdownError?.(error, {
        generation,
        phase: "dispose",
      });
    } finally {
      this.restartingGenerations.delete(generation);
    }
  }

  private unsubscribeRestartingSubscription(
    subscription: ActiveSubscription,
    generation: number,
  ): void {
    try {
      subscription.innerUnsubscribe?.();
    } catch (error) {
      this.options.onRestartShutdownError?.(error, {
        generation,
        phase: "unsubscribe",
      });
    }
  }

  private subscribeActiveSubscription(subscription: ActiveSubscription): void {
    const generation = this.currentGeneration;
    subscription.generation = generation;
    subscription.innerUnsubscribe = this.innerClient.subscribe(
      subscription.payload,
      {
        next: (value) => {
          if (!subscription.closed) {
            subscription.sink.next(value);
          }
        },
        error: (error) => {
          if (this.shouldSuppressTerminalEvent(subscription, generation)) {
            return;
          }

          subscription.closed = true;
          this.activeSubscriptions.delete(subscription.id);
          subscription.sink.error(error);
        },
        complete: () => {
          if (this.shouldSuppressTerminalEvent(subscription, generation)) {
            return;
          }

          subscription.closed = true;
          this.activeSubscriptions.delete(subscription.id);
          subscription.sink.complete();
        },
      },
    );
  }

  private shouldSuppressTerminalEvent(
    subscription: ActiveSubscription,
    generation: number,
  ): boolean {
    return (
      subscription.closed ||
      this.restartingGenerations.has(generation) ||
      !this.isCurrentGeneration(generation)
    );
  }
}

export class DefaultWebappRealtimeConnection {
  private readonly browserLifecycle: RealtimeBrowserLifecycle | null;
  private readonly client: SelfHealingGraphqlWsClient;
  private readonly connectionAckWaitTimeoutMs: number;
  private readonly connectionParams: GraphqlWsConnectionParams | undefined;
  private readonly connectionStateStore: ExternalStore<RealtimeConnectionState>;
  private readonly createClient: GraphqlWsTransportFactory;
  private readonly fatalCloseCodes: ReadonlySet<number>;
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly logger: WebappRealtimeLogger;
  private readonly maxTerminateAttemptsBeforeRestart: number;
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly reconnectPolicy: Partial<RealtimeReconnectPolicy>;
  private readonly reconnectWatchdogMs: number;
  private readonly shouldLogReconnects: boolean;
  private readonly wsEndpoint: ClientOptions<Record<string, string>>["url"];
  private browserLifecycleListenersInitialized = false;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | undefined;
  private reconnectWatchdogTimeout: ReturnType<typeof setTimeout> | undefined;
  private terminateAttemptsSinceHealthy = 0;

  public constructor(options: DefaultWebappRealtimeConnectionOptions) {
    this.browserLifecycle =
      options.browserLifecycle === undefined
        ? options.browserNetwork === undefined
          ? createDefaultBrowserLifecycle()
          : options.browserNetwork
        : options.browserLifecycle;
    this.connectionAckWaitTimeoutMs =
      options.connectionAckWaitTimeoutMs ??
      options.heartbeatPolicy?.connectionAckWaitTimeoutMs ??
      DEFAULT_CONNECTION_ACK_WAIT_TIMEOUT_MS;
    this.connectionParams = options.connectionParams;
    this.createClient = options.createClient ?? createGraphqlWsClient;
    this.fatalCloseCodes = createFatalCloseCodeSet(
      options.fatalCloseCodes ?? options.recoveryPolicy?.fatalCloseCodes,
    );
    this.heartbeatIntervalMs =
      options.heartbeatIntervalMs ??
      options.heartbeatPolicy?.heartbeatIntervalMs ??
      DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.heartbeatTimeoutMs =
      options.heartbeatTimeoutMs ??
      options.heartbeatPolicy?.heartbeatTimeoutMs ??
      DEFAULT_HEARTBEAT_TIMEOUT_MS;
    this.logger = options.logger ?? console;
    this.maxTerminateAttemptsBeforeRestart =
      options.maxTerminateAttemptsBeforeRestart ??
      options.recoveryPolicy?.maxTerminateAttemptsBeforeRestart ??
      DEFAULT_MAX_TERMINATE_ATTEMPTS_BEFORE_RESTART;
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.reconnectPolicy = options.reconnectPolicy ?? {};
    this.reconnectWatchdogMs =
      options.reconnectWatchdogMs ??
      options.recoveryPolicy?.reconnectWatchdogMs ??
      DEFAULT_RECONNECT_WATCHDOG_MS;
    this.shouldLogReconnects = options.logReconnects === true;
    this.wsEndpoint = options.wsEndpoint;
    this.connectionStateStore = createExternalStore<RealtimeConnectionState>(
      createInitialConnectionState(this.browserLifecycle?.isOnline() ?? true),
    );
    this.client = new SelfHealingGraphqlWsClient({
      createInnerClient: (generation) => this.createInnerClient(generation),
      onRestartShutdownError: (error, details) => {
        this.logRealtime("Ignored old live GraphQL client shutdown error.", {
          error: getRealtimeShutdownErrorMessage(error),
          generation: details.generation,
          phase: details.phase,
        });
      },
    });
    this.updateConnectionState({
      innerClientGeneration: this.client.getCurrentGeneration(),
    });
    this.initializeBrowserLifecycleListeners();
  }

  public getClient(): Client {
    return this.client;
  }

  public getConnectionState(): RealtimeConnectionState {
    return this.connectionStateStore.getSnapshot();
  }

  public subscribeToConnectionState(
    listener: RealtimeConnectionStateListener,
  ): ExternalStoreUnsubscribe {
    return this.connectionStateStore.subscribe(() => {
      listener(this.getConnectionState());
    });
  }

  public dispose(): void | Promise<void> {
    this.clearHeartbeatTimeout();
    this.clearReconnectWatchdog();
    return this.client.dispose();
  }

  private createInnerClient(generation: number): Client {
    const retryWait =
      this.reconnectPolicy.retryWait ?? createDefaultRetryWait(this.random);

    return this.createClient({
      url: this.wsEndpoint,
      connectionParams: this.connectionParams,
      lazy: true,
      keepAlive: this.heartbeatIntervalMs,
      connectionAckWaitTimeout: this.connectionAckWaitTimeoutMs,
      retryAttempts: Number.POSITIVE_INFINITY,
      retryWait,
      shouldRetry: (eventOrError) => {
        if (this.reconnectPolicy.shouldRetry) {
          return this.reconnectPolicy.shouldRetry(eventOrError);
        }

        if (isGraphqlWsCloseLike(eventOrError)) {
          return !isFatalGraphqlWsCloseCode(
            eventOrError.code,
            this.fatalCloseCodes,
          );
        }

        return true;
      },
      on: {
        connecting: (isRetrying) => {
          this.emitClientEvent(generation, "connecting", isRetrying);
          if (!this.client.isCurrentGeneration(generation)) {
            return;
          }

          this.clearHeartbeatTimeout();
          const nextAttempt = isRetrying
            ? this.getConnectionState().attempt + 1
            : 0;
          this.updateConnectionState({
            status: isRetrying ? "retrying" : "connecting",
            attempt: nextAttempt,
            closeCode: null,
            detail: null,
            recoveryReason: isRetrying ? "retry" : "initial-connect",
            lastError: null,
          });
          this.logRealtime(
            isRetrying
              ? "Attempting to reconnect the live GraphQL connection."
              : "Opening the live GraphQL connection.",
            { attempt: nextAttempt },
          );
          this.startReconnectWatchdog();
        },
        opened: (socket) => {
          this.emitClientEvent(generation, "opened", socket);
        },
        connected: (socket, payload, wasRetry) => {
          this.emitClientEvent(generation, "connected", socket, payload, wasRetry);
          if (!this.client.isCurrentGeneration(generation)) {
            return;
          }

          this.clearHeartbeatTimeout();
          this.clearReconnectWatchdog();
          this.terminateAttemptsSinceHealthy = 0;
          this.updateConnectionState({
            status: "connected",
            attempt: 0,
            closeCode: null,
            detail: null,
            recoveryReason: null,
            lastRecoveryAction: "none",
            lastConnectedAt: this.now(),
            lastError: null,
          });
          this.logRealtime(
            wasRetry
              ? "Live GraphQL connection re-established."
              : "Live GraphQL connection established.",
          );
        },
        ping: (received, payload) => {
          this.emitClientEvent(generation, "ping", received, payload);
          if (received || !this.client.isCurrentGeneration(generation)) {
            return;
          }

          this.clearHeartbeatTimeout();
          this.heartbeatTimeout = setTimeout(() => {
            if (!this.client.isCurrentGeneration(generation)) {
              return;
            }

            this.updateConnectionState({
              status: "retrying",
              detail: "Live updates heartbeat timed out.",
              recoveryReason: "heartbeat-timeout",
              lastRecoveryAction: "terminate",
            });
            this.logRealtime("No pong received in time. Terminating stuck socket.");
            this.client.terminate();
            this.startReconnectWatchdog();
          }, this.heartbeatTimeoutMs);
        },
        pong: (received, payload) => {
          this.emitClientEvent(generation, "pong", received, payload);
          if (!received || !this.client.isCurrentGeneration(generation)) {
            return;
          }

          this.clearHeartbeatTimeout();
        },
        message: (message) => {
          this.emitClientEvent(generation, "message", message);
        },
        closed: (event) => {
          this.emitClientEvent(generation, "closed", event);
          if (!this.client.isCurrentGeneration(generation)) {
            return;
          }

          this.clearHeartbeatTimeout();
          if (!isGraphqlWsCloseLike(event)) {
            this.updateConnectionState({
              status: "retrying",
              closeCode: null,
              detail: "The live connection closed unexpectedly.",
              recoveryReason: "closed",
              lastDisconnectedAt: this.now(),
            });
            this.logRealtime("Live GraphQL connection closed unexpectedly.");
            this.startReconnectWatchdog();
            return;
          }

          const isFatalClose = isFatalGraphqlWsCloseCode(
            event.code,
            this.fatalCloseCodes,
          );
          this.updateConnectionState({
            status: isFatalClose ? "disconnected" : "retrying",
            closeCode: event.code ?? null,
            detail: getGraphqlWsCloseDetail(event),
            recoveryReason: "closed",
            lastDisconnectedAt: this.now(),
          });
          this.logRealtime("Live GraphQL connection closed.", {
            code: event.code ?? null,
            reason: getGraphqlWsCloseDetail(event),
            fatal: isFatalClose,
          });
          if (isFatalClose) {
            this.clearReconnectWatchdog();
            return;
          }

          this.startReconnectWatchdog();
        },
        error: (error) => {
          this.emitClientEvent(generation, "error", error);
          if (!this.client.isCurrentGeneration(generation)) {
            return;
          }

          const connectionState = this.getConnectionState();
          if (
            connectionState.status === "connecting" ||
            connectionState.status === "retrying"
          ) {
            return;
          }

          const errorMessage = getRealtimeErrorMessage(error);
          this.updateConnectionState({
            status: "retrying",
            detail: "The live connection hit a transport error.",
            recoveryReason: "transport-error",
            lastError: errorMessage,
          });
          this.logRealtime("Live GraphQL connection hit a transport error.", {
            error: errorMessage,
          });
          this.startReconnectWatchdog();
        },
      },
    });
  }

  private emitClientEvent<E extends Event>(
    generation: number,
    event: E,
    ...args: Parameters<EventListener<E>>
  ): void {
    if (this.client.isCurrentGeneration(generation)) {
      this.client.emit(event, ...args);
    }
  }

  private updateConnectionState(
    nextState: Partial<RealtimeConnectionState>,
  ): void {
    this.connectionStateStore.updateSnapshot((connectionState: RealtimeConnectionState) => ({
      ...connectionState,
      ...nextState,
      innerClientGeneration: this.client?.getCurrentGeneration() ?? 1,
    }));
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = undefined;
    }
  }

  private clearReconnectWatchdog(): void {
    if (this.reconnectWatchdogTimeout) {
      clearTimeout(this.reconnectWatchdogTimeout);
      this.reconnectWatchdogTimeout = undefined;
    }
  }

  private isReconnectInProgress(): boolean {
    const connectionState = this.getConnectionState();
    return (
      connectionState.status === "connecting" ||
      connectionState.status === "retrying"
    );
  }

  private initializeBrowserLifecycleListeners(): void {
    if (this.browserLifecycleListenersInitialized || !this.browserLifecycle) {
      return;
    }

    this.browserLifecycleListenersInitialized = true;

    const syncBrowserLifecycleState = () => {
      const connectionState = this.getConnectionState();
      const browserOnline = this.browserLifecycle?.isOnline() ?? true;

      this.updateConnectionState({
        browserOnline,
        detail: browserOnline
          ? connectionState.detail
          : "The browser is offline.",
      });
    };
    const recoverAfterBrowserOnline = () => {
      syncBrowserLifecycleState();
      if (this.isReconnectInProgress()) {
        this.restartInnerClient(
          "browser-online",
          "Browser returned online. Recreating the live connection.",
        );
      }
    };
    const recoverAfterBrowserResume = () => {
      syncBrowserLifecycleState();
      if (
        this.isReconnectInProgress() &&
        this.browserLifecycle?.isVisible?.() !== false
      ) {
        this.restartInnerClient(
          "browser-resume",
          "Browser resumed. Recreating the live connection.",
        );
      }
    };

    this.browserLifecycle.addEventListener("offline", syncBrowserLifecycleState);
    this.browserLifecycle.addEventListener("online", recoverAfterBrowserOnline);
    this.browserLifecycle.addEventListener(
      "visibilitychange",
      recoverAfterBrowserResume,
    );
    this.browserLifecycle.addEventListener("pageshow", recoverAfterBrowserResume);
    syncBrowserLifecycleState();
  }

  private startReconnectWatchdog(): void {
    this.clearReconnectWatchdog();
    if (
      this.reconnectWatchdogMs === 0 ||
      !this.getConnectionState().browserOnline
    ) {
      return;
    }

    this.reconnectWatchdogTimeout = setTimeout(() => {
      this.reconnectWatchdogTimeout = undefined;

      if (!this.getConnectionState().browserOnline || !this.isReconnectInProgress()) {
        return;
      }

      let shouldScheduleNextWatchdog = false;

      if (
        this.terminateAttemptsSinceHealthy >=
        this.maxTerminateAttemptsBeforeRestart
      ) {
        this.restartInnerClient(
          "reconnect-watchdog-timeout",
          "Live updates reconnect timed out. Recreating the websocket client.",
        );
      } else {
        this.terminateAttemptsSinceHealthy += 1;
        this.updateConnectionState({
          detail: "Live updates reconnect timed out. Restarting the socket.",
          recoveryReason: "reconnect-watchdog-timeout",
          recoveryAttempt: this.getConnectionState().recoveryAttempt + 1,
          lastRecoveryAction: "terminate",
        });
        this.logRealtime(
          "Live GraphQL reconnect watchdog timed out. Terminating socket.",
          { timeoutMs: this.reconnectWatchdogMs },
        );
        this.client.terminate();
        shouldScheduleNextWatchdog = true;
      }

      if (shouldScheduleNextWatchdog) {
        this.startReconnectWatchdog();
      }
    }, this.reconnectWatchdogMs);
  }

  private restartInnerClient(
    recoveryReason: RealtimeRecoveryReason,
    detail: string,
  ): void {
    const connectionState = this.getConnectionState();
    const innerClientGeneration = this.client.restart();
    this.terminateAttemptsSinceHealthy = 0;
    this.updateConnectionState({
      status: "retrying",
      detail,
      recoveryReason,
      recoveryAttempt: connectionState.recoveryAttempt + 1,
      restartCount: connectionState.restartCount + 1,
      lastRecoveryAction: "restart",
      innerClientGeneration,
    });
    this.logRealtime("Live GraphQL client was recreated.", {
      generation: innerClientGeneration,
      reason: recoveryReason,
    });
    this.startReconnectWatchdog();
  }

  private logRealtime(
    message: string,
    details?: Record<string, unknown>,
  ): void {
    if (!this.shouldLogReconnects) {
      return;
    }

    if (details) {
      this.logger.info(`[realtime] ${message}`, details);
      return;
    }

    this.logger.info(`[realtime] ${message}`);
  }
}
