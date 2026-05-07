import {
  Environment,
  Network,
  Observable,
  type Disposable,
  type FetchFunction,
  type FetchPolicy,
  type GraphQLTaggedNode,
  type GraphQLResponse,
  type OperationType,
  type PreloadableConcreteRequest,
  type RecordSourceSelectorProxy,
  type RequestParameters,
  type SubscribeFunction,
  type Variables,
  type VariablesOf,
} from "relay-runtime";
import {
  loadQuery as loadReactRelayQuery,
  type LoadQueryOptions,
  type PreloadedQuery,
} from "react-relay";
import type { RelayObservable } from "relay-runtime/lib/network/RelayObservable";
import type { Client, FormattedExecutionResult, Sink } from "graphql-ws";
import {
  formatBearerToken,
  GRAPHQL_WS_AUTHORIZATION_PARAM,
} from "@omgjs/labkit-auth-contract";
import {
  DefaultWebappRealtimeConnection,
  type DefaultWebappRealtimeConnectionOptions,
  type GraphqlWsConnectionParamsFactory,
  type RealtimeConnectionState,
  type RealtimeConnectionStateListener,
} from "@omgjs/labkit-webapp-realtime";

export type GraphqlRelayRequestCredentials = "include" | "omit" | "same-origin";

export type GraphqlRelayAuthSessionLike = {
  accessToken: string;
  accessTokenExpiresAt: number;
};

export type GraphqlRelayAuthRefreshPolicy = {
  refreshAccessTokenBeforeExpiresMs?: number;
};

export type GraphqlRelayFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<GraphQLResponse>;
};

export type GraphqlRelayFetch = (
  input: string,
  init: {
    method: "POST";
    credentials: GraphqlRelayRequestCredentials;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<GraphqlRelayFetchResponse>;

export type GraphqlRelayAuthAdapter = {
  getAccessToken(): string | null;
  getAuthSession(): GraphqlRelayAuthSessionLike | null;
  subscribeAuthState(listener: () => void): () => void;
  refreshStoredAuthSession(): Promise<unknown>;
  getAuthRequestCredentials(): GraphqlRelayRequestCredentials;
  hasAuthRequiredGraphqlErrors(payload: unknown): boolean;
};

export type GraphqlRelayRealtimeAdapter = {
  getClient(): Client;
};

export type CreateWebappRelayDefaultRealtimeOptions = Omit<
  DefaultWebappRealtimeConnectionOptions,
  "connectionParams" | "wsEndpoint"
>;

export type CreateAuthAwareRelayFetchOptions = {
  auth: GraphqlRelayAuthAdapter;
  authOperationNames?: ReadonlySet<string> | readonly string[];
  fetch?: GraphqlRelayFetch;
  httpEndpoint: string;
};

export type CreateAuthAwareRelayGraphqlWsConnectionParamsOptions = {
  auth: Pick<
    GraphqlRelayAuthAdapter,
    "getAccessToken" | "getAuthSession" | "refreshStoredAuthSession"
  >;
  refreshAccessTokenBeforeExpiresMs?: number;
  now?: () => number;
};

type AuthAwareRelayGraphqlWsConnectionParamsLifecycle = {
  onAfterRefreshStoredAuthSession?(): void;
  onBeforeRefreshStoredAuthSession?(): void;
};

export type CreateRelaySubscribeFunctionOptions = {
  wsClient: Client;
};

export type CreateWebappRelayEnvironmentBaseOptions = {
  auth: GraphqlRelayAuthAdapter;
  authOperationNames?: ReadonlySet<string> | readonly string[];
  authRefreshPolicy?: GraphqlRelayAuthRefreshPolicy;
  fetch?: GraphqlRelayFetch;
  httpEndpoint: string;
};

export type CreateWebappRelayEnvironmentOptions =
  | (CreateWebappRelayEnvironmentBaseOptions & {
      realtime: GraphqlRelayRealtimeAdapter;
      realtimeOptions?: never;
      wsEndpoint?: string;
    })
  | (CreateWebappRelayEnvironmentBaseOptions & {
      realtime?: never;
      realtimeOptions?: CreateWebappRelayDefaultRealtimeOptions;
      wsEndpoint: string;
    });

export type CreateWebappRelayRealtimeClientOptions =
  CreateWebappRelayEnvironmentOptions;

export type CreateWebappRelayRealtimeClientResult = {
  realtime: GraphqlRelayRealtimeAdapter;
  wsClient: Client;
};

export type CreateWebappRelayEnvironmentResolvedOptions =
  CreateWebappRelayEnvironmentBaseOptions & {
    realtime: GraphqlRelayRealtimeAdapter;
  };

export type DefaultWebappRelayRuntimeOptions =
  CreateWebappRelayEnvironmentBaseOptions & {
    realtimeOptions?: CreateWebappRelayDefaultRealtimeOptions;
    wsEndpoint: string;
  };

export type RouteAbortSignal = {
  readonly aborted: boolean;
  addEventListener(
    type: "abort",
    listener: () => void,
    options?: { once?: boolean },
  ): void;
};

export type RouteQueryLoader<TQuery extends OperationType> = (
  environment: Environment,
  query: GraphQLTaggedNode | PreloadableConcreteRequest<TQuery>,
  variables: VariablesOf<TQuery>,
  options?: LoadQueryOptions,
) => PreloadedQuery<TQuery>;

export type LoadRouteQueryOptions<TQuery extends OperationType> = {
  abortSignal: RouteAbortSignal;
  environment: Environment;
  fetchPolicy?: FetchPolicy | null;
  loadQuery?: RouteQueryLoader<TQuery>;
  networkCacheConfig?: LoadQueryOptions["networkCacheConfig"];
  onQueryAstLoadTimeout?: LoadQueryOptions["onQueryAstLoadTimeout"];
  query: GraphQLTaggedNode | PreloadableConcreteRequest<TQuery>;
  variables: VariablesOf<TQuery>;
};

type GlobalWithGraphqlRelayFetch = typeof globalThis & {
  fetch?: GraphqlRelayFetch;
};

export const DEFAULT_AUTH_OPERATION_NAMES = [
  "LoginMutation",
  "RegisterMutation",
  "RefreshMutation",
  "LogoutMutation",
] as const;

export const DEFAULT_REFRESH_ACCESS_TOKEN_BEFORE_EXPIRES_MS = 60_000;

function createOperationNameSet(
  operationNames: ReadonlySet<string> | readonly string[] | undefined,
): ReadonlySet<string> {
  if (!operationNames) {
    return new Set(DEFAULT_AUTH_OPERATION_NAMES);
  }

  return operationNames instanceof Set
    ? operationNames
    : new Set(operationNames);
}

function getDefaultFetch(): GraphqlRelayFetch {
  const fetchImplementation = (globalThis as GlobalWithGraphqlRelayFetch).fetch;
  if (!fetchImplementation) {
    throw new Error("No fetch implementation is available.");
  }

  return fetchImplementation.bind(globalThis);
}

export function createRelayGraphqlWsConnectionParams(
  getAccessToken: () => string | null,
): Record<string, string> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return {};
  }

  return { [GRAPHQL_WS_AUTHORIZATION_PARAM]: formatBearerToken(accessToken) };
}

export function shouldRefreshRelayAuthSessionForRealtime(options: {
  authSession: GraphqlRelayAuthSessionLike | null;
  nowMs?: number;
  refreshAccessTokenBeforeExpiresMs?: number;
}): boolean {
  if (!options.authSession) {
    return false;
  }

  const refreshAccessTokenBeforeExpiresMs =
    options.refreshAccessTokenBeforeExpiresMs ??
    DEFAULT_REFRESH_ACCESS_TOKEN_BEFORE_EXPIRES_MS;
  const nowMs = options.nowMs ?? Date.now();

  return (
    options.authSession.accessTokenExpiresAt <=
    nowMs + refreshAccessTokenBeforeExpiresMs
  );
}

export function createAuthAwareRelayGraphqlWsConnectionParams({
  auth,
  now,
  refreshAccessTokenBeforeExpiresMs,
}: CreateAuthAwareRelayGraphqlWsConnectionParamsOptions): GraphqlWsConnectionParamsFactory {
  return createAuthAwareRelayGraphqlWsConnectionParamsFactory({
    auth,
    now,
    refreshAccessTokenBeforeExpiresMs,
  });
}

function createAuthAwareRelayGraphqlWsConnectionParamsFactory(
  {
    auth,
    now,
    refreshAccessTokenBeforeExpiresMs,
  }: CreateAuthAwareRelayGraphqlWsConnectionParamsOptions,
  lifecycle: AuthAwareRelayGraphqlWsConnectionParamsLifecycle = {},
): GraphqlWsConnectionParamsFactory {
  return async () => {
    if (
      shouldRefreshRelayAuthSessionForRealtime({
        authSession: auth.getAuthSession(),
        nowMs: now?.(),
        refreshAccessTokenBeforeExpiresMs,
      })
    ) {
      lifecycle.onBeforeRefreshStoredAuthSession?.();
      let refreshedSession: unknown;
      try {
        refreshedSession = await auth.refreshStoredAuthSession();
      } finally {
        lifecycle.onAfterRefreshStoredAuthSession?.();
      }

      if (!refreshedSession) {
        return {};
      }
    }

    return createRelayGraphqlWsConnectionParams(() => auth.getAccessToken());
  };
}

export function createUnauthorizedGraphqlResponse(): GraphQLResponse {
  return {
    data: null,
    errors: [
      {
        message: "Authentication is required.",
        extensions: {
          statusCode: 401,
        },
      },
    ],
  } as unknown as GraphQLResponse;
}

export async function fetchRelayGraphqlOnce(
  options: {
    auth: Pick<
      GraphqlRelayAuthAdapter,
      "getAccessToken" | "getAuthRequestCredentials"
    >;
    fetch?: GraphqlRelayFetch;
    httpEndpoint: string;
  },
  request: RequestParameters,
  variables: Variables,
): Promise<GraphQLResponse> {
  const accessToken = options.auth.getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.authorization = formatBearerToken(accessToken);
  }

  const response = await (options.fetch ?? getDefaultFetch())(
    options.httpEndpoint,
    {
      method: "POST",
      credentials: options.auth.getAuthRequestCredentials(),
      headers,
      body: JSON.stringify({ query: request.text, variables }),
    },
  );

  if (response.status === 401) {
    return createUnauthorizedGraphqlResponse();
  }

  if (!response.ok) {
    throw new Error("Response failed.");
  }

  return response.json();
}

export function createAuthAwareRelayFetchFunction(
  options: CreateAuthAwareRelayFetchOptions,
): FetchFunction {
  const authOperationNames = createOperationNameSet(options.authOperationNames);

  return async (request, variables) => {
    const response = await fetchRelayGraphqlOnce(options, request, variables);
    if (
      authOperationNames.has(request.name) ||
      !options.auth.hasAuthRequiredGraphqlErrors(response)
    ) {
      return response;
    }

    const refreshedSession = await options.auth.refreshStoredAuthSession();
    if (!refreshedSession) {
      return response;
    }

    return fetchRelayGraphqlOnce(options, request, variables);
  };
}

export function createRelaySubscribeFunction({
  wsClient,
}: CreateRelaySubscribeFunctionOptions): SubscribeFunction {
  return (
    operation,
    variables,
  ): RelayObservable<GraphQLResponse> | Disposable =>
    Observable.create((sink) =>
      wsClient.subscribe(
        {
          operationName: operation.name,
          query: operation.text || "",
          variables,
        },
        sink as Sink<
          FormattedExecutionResult<GraphQLResponse, Record<string, unknown>>
        >,
      ),
    );
}

export function terminateRealtimeClientOnAuthTokenChange(options: {
  getAccessToken(): string | null;
  subscribeAuthState(listener: () => void): () => void;
  wsClient: Pick<Client, "terminate">;
}): () => void {
  let realtimeAccessToken = options.getAccessToken();

  return options.subscribeAuthState(() => {
    const nextAccessToken = options.getAccessToken();
    if (nextAccessToken === realtimeAccessToken) {
      return;
    }

    realtimeAccessToken = nextAccessToken;
    options.wsClient.terminate();
  });
}

export function createWebappRelayRealtimeClient(
  options: CreateWebappRelayRealtimeClientOptions,
): CreateWebappRelayRealtimeClientResult {
  if (options.realtime) {
    return {
      realtime: options.realtime,
      wsClient: options.realtime.getClient(),
    };
  }

  const realtime = new DefaultWebappRealtimeConnection({
    ...options.realtimeOptions,
    wsEndpoint: options.wsEndpoint,
    connectionParams: createAuthAwareRelayGraphqlWsConnectionParams({
      auth: options.auth,
      refreshAccessTokenBeforeExpiresMs:
        options.authRefreshPolicy?.refreshAccessTokenBeforeExpiresMs,
    }),
  });

  return {
    realtime,
    wsClient: realtime.getClient(),
  };
}

export function createWebappRelayEnvironment(
  options: CreateWebappRelayEnvironmentOptions,
): Environment {
  const { wsClient } = createWebappRelayRealtimeClient(options);

  terminateRealtimeClientOnAuthTokenChange({
    getAccessToken: () => options.auth.getAccessToken(),
    subscribeAuthState: (listener) => options.auth.subscribeAuthState(listener),
    wsClient,
  });

  return new Environment({
    network: Network.create(
      createAuthAwareRelayFetchFunction(options),
      createRelaySubscribeFunction({ wsClient }),
    ),
  });
}

export class DefaultWebappRelayRuntime {
  private readonly authStateUnsubscribe: () => void;
  private readonly environment: Environment;
  private readonly realtime: DefaultWebappRealtimeConnection;
  private disposed = false;

  public constructor(options: DefaultWebappRelayRuntimeOptions) {
    let realtimeConnectionParamsRefreshes = 0;
    this.realtime = new DefaultWebappRealtimeConnection({
      ...options.realtimeOptions,
      wsEndpoint: options.wsEndpoint,
      connectionParams: createAuthAwareRelayGraphqlWsConnectionParamsFactory(
        {
          auth: options.auth,
          refreshAccessTokenBeforeExpiresMs:
            options.authRefreshPolicy?.refreshAccessTokenBeforeExpiresMs,
        },
        {
          onAfterRefreshStoredAuthSession: () => {
            realtimeConnectionParamsRefreshes -= 1;
          },
          onBeforeRefreshStoredAuthSession: () => {
            realtimeConnectionParamsRefreshes += 1;
          },
        },
      ),
    });

    const wsClient = this.realtime.getClient();
    let realtimeAccessToken = options.auth.getAccessToken();
    this.authStateUnsubscribe = options.auth.subscribeAuthState(() => {
      const nextAccessToken = options.auth.getAccessToken();
      if (nextAccessToken === realtimeAccessToken) {
        return;
      }

      realtimeAccessToken = nextAccessToken;
      if (realtimeConnectionParamsRefreshes > 0) {
        return;
      }

      wsClient.terminate();
    });
    this.environment = new Environment({
      network: Network.create(
        createAuthAwareRelayFetchFunction(options),
        createRelaySubscribeFunction({ wsClient }),
      ),
    });
  }

  public getEnvironment = (): Environment => this.environment;

  public getRealtime = (): DefaultWebappRealtimeConnection => this.realtime;

  public getRealtimeConnectionState = (): RealtimeConnectionState =>
    this.realtime.getConnectionState();

  public subscribeToRealtimeConnectionState = (
    listener: RealtimeConnectionStateListener,
  ): (() => void) => this.realtime.subscribeToConnectionState(listener);

  public dispose = (): void | Promise<void> => {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.authStateUnsubscribe();
    return this.realtime.dispose();
  };
}

export function loadRouteQuery<TQuery extends OperationType>(
  options: LoadRouteQueryOptions<TQuery>,
): PreloadedQuery<TQuery> {
  const queryRef = (options.loadQuery ?? loadReactRelayQuery)(
    options.environment,
    options.query,
    options.variables,
    {
      fetchPolicy: options.fetchPolicy,
      networkCacheConfig: options.networkCacheConfig,
      onQueryAstLoadTimeout: options.onQueryAstLoadTimeout,
    },
  );
  let disposed = false;
  const disposeOnce = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    queryRef.dispose();
  };

  if (options.abortSignal.aborted) {
    disposeOnce();
    return queryRef;
  }

  options.abortSignal.addEventListener("abort", disposeOnce, { once: true });
  return queryRef;
}

export function appendRootFieldRecordIfMissing(
  store: RecordSourceSelectorProxy,
  rootFieldName: string,
  listFieldName: string,
): void {
  const root = store.getRoot();
  const incoming = store.getRootField(rootFieldName);

  if (!incoming) {
    return;
  }

  const existing = root.getLinkedRecords(listFieldName) ?? [];
  const incomingDataId = incoming.getDataID();
  const alreadyPresent = existing.some(
    (record) => record?.getDataID() === incomingDataId,
  );

  if (alreadyPresent) {
    return;
  }

  root.setLinkedRecords([...existing, incoming], listFieldName);
}
