import {
  isAuthRequiredErrorCode,
  type AuthPayload,
  type Principal,
} from "@omgjs/labkit-auth-contract";
import {
  createExternalStore,
  type ExternalStoreUnsubscribe,
} from "@omgjs/labkit-webapp-external-store";

export type { AuthPayload, Principal } from "@omgjs/labkit-auth-contract";

export type AuthSession = {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  principal: Principal;
};

export type AuthSessionHint = {
  kind: "authenticated";
  updatedAt: number;
};

export type AuthState =
  | { status: "unknown"; sessionHint: AuthSessionHint | null }
  | { status: "anonymous" }
  | { status: "authenticated"; session: AuthSession };

export type AuthSessionHintStorageBackend = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type AuthSessionHintStorage = {
  read(): AuthSessionHint | null;
  write(): void;
  clear(): void;
};

export type CreateAuthSessionHintStorageOptions = {
  storageKey?: string;
  storage?: AuthSessionHintStorageBackend | null;
};

export type AuthRequestCredentials = "include" | "omit" | "same-origin";

export type RefreshInput = {
  refreshToken?: string | null;
};

export type RefreshTokenTransportStrategy = {
  readonly requestCredentials: AuthRequestCredentials;
  createRefreshInput: () => RefreshInput | null;
  createLogoutInput: () => RefreshInput | null;
  handleAuthPayload: (payload: AuthPayload) => void;
  clear: () => void;
};

export type WebappAuthSession = {
  getAuthState(): AuthState;
  getAuthSession(): AuthSession | null;
  getAccessToken(): string | null;
  setAuthSessionFromPayload(payload: AuthPayload): AuthSession;
  clearAuthSession(): void;
  subscribeAuthState(listener: () => void): ExternalStoreUnsubscribe;
};

export type CreateWebappAuthSessionOptions = {
  initialState?: AuthState;
  sessionHintStorage?: AuthSessionHintStorage;
  refreshTokenTransport?: RefreshTokenTransportStrategy;
};

export type GraphqlErrorLike = {
  message?: string;
  extensions?: {
    code?: string;
    statusCode?: number;
    originalError?: {
      code?: string;
      message?: string;
      statusCode?: number;
    };
  };
};

export type GraphqlResponse<TData> = {
  data?: TData | null;
  errors?: unknown[];
};

export type WebappAuthFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type WebappAuthFetch = (
  input: string,
  init: {
    method: "POST";
    credentials: AuthRequestCredentials;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<WebappAuthFetchResponse>;

export type CreateWebappAuthGraphqlApiOptions = {
  graphqlEndpoint: string;
  refreshTokenTransport: RefreshTokenTransportStrategy;
  setAuthSessionFromPayload(payload: AuthPayload): AuthSession;
  clearAuthSession(): void;
  fetch?: WebappAuthFetch;
};

export type WebappAuthGraphqlApi = {
  refreshStoredAuthSession(): Promise<AuthSession | null>;
  logoutCurrentSession(): Promise<void>;
};

type AuthMutationData = {
  refresh?: AuthPayload | null;
};

type LogoutData = {
  logout?: boolean | null;
};

type GlobalWithWebappAuthFetch = typeof globalThis & {
  fetch?: WebappAuthFetch;
};

type GlobalWithLocalStorage = typeof globalThis & {
  localStorage?: AuthSessionHintStorageBackend;
};

export const DEFAULT_AUTH_SESSION_HINT_STORAGE_KEY = "webapp:auth-session-hint";

const AUTH_PAYLOAD_FIELDS = `
  accessToken
  accessTokenExpiresAt
  refreshToken
  refreshTokenExpiresAt
  principal {
    userId
    subject
    provider
    displayName
    roles
    permissions
  }
`;

const REFRESH_MUTATION = `
  mutation WebappRefresh($input: RefreshInput) {
    refresh(input: $input) {
      ${AUTH_PAYLOAD_FIELDS}
    }
  }
`;

const LOGOUT_MUTATION = `
  mutation WebappLogout($input: RefreshInput) {
    logout(input: $input)
  }
`;

export const cookieRefreshTokenTransport: RefreshTokenTransportStrategy = {
  requestCredentials: "include",
  createRefreshInput: () => null,
  createLogoutInput: () => null,
  handleAuthPayload: () => {},
  clear: () => {},
};

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export function isAuthSessionHint(value: unknown): value is AuthSessionHint {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const hint = value as AuthSessionHint;
  return hint.kind === "authenticated" && typeof hint.updatedAt === "number";
}

function getGlobalLocalStorage(): AuthSessionHintStorageBackend | null {
  return (globalThis as GlobalWithLocalStorage).localStorage ?? null;
}

export function createAuthSessionHintStorage(
  options: CreateAuthSessionHintStorageOptions = {},
): AuthSessionHintStorage {
  const storageKey =
    options.storageKey ?? DEFAULT_AUTH_SESSION_HINT_STORAGE_KEY;
  const getStorage = () =>
    options.storage === undefined ? getGlobalLocalStorage() : options.storage;

  return {
    read: () => {
      const storage = getStorage();
      if (!storage) {
        return null;
      }

      try {
        const rawValue = storage.getItem(storageKey);
        if (!rawValue) {
          return null;
        }

        const parsedValue: unknown = JSON.parse(rawValue);
        return isAuthSessionHint(parsedValue) ? parsedValue : null;
      } catch {
        return null;
      }
    },
    write: () => {
      const storage = getStorage();
      if (!storage) {
        return;
      }

      const hint: AuthSessionHint = {
        kind: "authenticated",
        updatedAt: Date.now(),
      };

      try {
        storage.setItem(storageKey, JSON.stringify(hint));
      } catch {
        // Ignore storage failures; the in-memory auth state still updates.
      }
    },
    clear: () => {
      const storage = getStorage();
      if (!storage) {
        return;
      }

      try {
        storage.removeItem(storageKey);
      } catch {
        // Ignore storage failures; the in-memory auth state still updates.
      }
    },
  };
}

export function createAuthSessionFromPayload(
  payload: AuthPayload,
): AuthSession {
  return {
    accessToken: payload.accessToken,
    accessTokenExpiresAt: parseTimestamp(payload.accessTokenExpiresAt),
    refreshTokenExpiresAt: parseTimestamp(payload.refreshTokenExpiresAt),
    principal: {
      displayName: payload.principal.displayName ?? null,
      permissions: [...payload.principal.permissions],
      provider: payload.principal.provider,
      roles: [...payload.principal.roles],
      subject: payload.principal.subject,
      userId: payload.principal.userId,
    },
  };
}

export function createWebappAuthSession(
  options: CreateWebappAuthSessionOptions = {},
): WebappAuthSession {
  const sessionHintStorage =
    options.sessionHintStorage ?? createAuthSessionHintStorage();
  const refreshTokenTransport =
    options.refreshTokenTransport ?? cookieRefreshTokenTransport;
  const authStateStore = createExternalStore<AuthState>(
    options.initialState ?? {
      status: "unknown",
      sessionHint: sessionHintStorage.read(),
    },
  );

  const getAuthState = () => authStateStore.getSnapshot();
  const getAuthSession = () => {
    const authState = getAuthState();
    return authState.status === "authenticated" ? authState.session : null;
  };

  return {
    getAuthState,
    getAuthSession,
    getAccessToken: () => getAuthSession()?.accessToken ?? null,
    setAuthSessionFromPayload: (payload) => {
      refreshTokenTransport.handleAuthPayload(payload);

      const session = createAuthSessionFromPayload(payload);
      sessionHintStorage.write();
      authStateStore.setSnapshot({ status: "authenticated", session });
      return session;
    },
    clearAuthSession: () => {
      refreshTokenTransport.clear();
      sessionHintStorage.clear();
      authStateStore.setSnapshot({ status: "anonymous" });
    },
    subscribeAuthState: (listener) => authStateStore.subscribe(listener),
  };
}

export function getPrincipalDisplayName(principal: Principal): string {
  return principal.displayName?.trim() || principal.subject;
}

export function shouldShowAuthenticatedNavigation(
  authState: AuthState,
): boolean {
  return (
    authState.status === "authenticated" ||
    (authState.status === "unknown" && authState.sessionHint !== null)
  );
}

export function getAuthRequestCredentials(
  refreshTokenTransport: RefreshTokenTransportStrategy,
): AuthRequestCredentials {
  return refreshTokenTransport.requestCredentials;
}

export class AuthApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
  }
}

function isGraphqlErrorLike(value: unknown): value is GraphqlErrorLike {
  return typeof value === "object" && value !== null;
}

export function getGraphqlErrorCode(error: unknown): string | null {
  if (!isGraphqlErrorLike(error)) {
    return null;
  }

  return (
    error.extensions?.originalError?.code ?? error.extensions?.code ?? null
  );
}

function getGraphqlErrorStatusCode(error: unknown): number | null {
  if (!isGraphqlErrorLike(error)) {
    return null;
  }

  return (
    error.extensions?.originalError?.statusCode ??
    error.extensions?.statusCode ??
    null
  );
}

export function getGraphqlErrorMessage(error: unknown): string {
  if (!isGraphqlErrorLike(error)) {
    return "The request failed.";
  }

  return (
    error.extensions?.originalError?.message ??
    error.message ??
    "The request failed."
  );
}

export function isAuthRequiredGraphqlError(error: unknown): boolean {
  const code = getGraphqlErrorCode(error);
  const statusCode = getGraphqlErrorStatusCode(error);
  const message = getGraphqlErrorMessage(error).toLowerCase();

  return (
    statusCode === 401 ||
    isAuthRequiredErrorCode(code) ||
    message.includes("authentication is required") ||
    message.includes("invalid access token")
  );
}

export function hasAuthRequiredGraphqlErrors(payload: unknown): boolean {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("errors" in payload)
  ) {
    return false;
  }

  const errors = (payload as { errors?: unknown }).errors;
  return Array.isArray(errors) && errors.some(isAuthRequiredGraphqlError);
}

export function createAuthApiErrorFromGraphqlErrors(
  errors: ReadonlyArray<unknown> | null | undefined,
): AuthApiError {
  const firstError = errors?.[0];

  return new AuthApiError(
    firstError ? getGraphqlErrorMessage(firstError) : "Authentication failed.",
    firstError ? getGraphqlErrorCode(firstError) : null,
  );
}

function getDefaultFetch(): WebappAuthFetch {
  const fetchImplementation = (globalThis as GlobalWithWebappAuthFetch).fetch;
  if (!fetchImplementation) {
    throw new AuthApiError("No fetch implementation is available.");
  }

  return fetchImplementation.bind(globalThis);
}

export async function requestAuthGraphql<TData>(
  graphqlEndpoint: string,
  refreshTokenTransport: RefreshTokenTransportStrategy,
  query: string,
  variables: Record<string, unknown>,
  fetchImplementation: WebappAuthFetch = getDefaultFetch(),
): Promise<TData> {
  const response = await fetchImplementation(graphqlEndpoint, {
    method: "POST",
    credentials: getAuthRequestCredentials(refreshTokenTransport),
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new AuthApiError("The auth request failed.");
  }

  const payload = (await response.json()) as GraphqlResponse<TData>;
  if (payload.errors?.length) {
    throw createAuthApiErrorFromGraphqlErrors(payload.errors);
  }

  if (!payload.data) {
    throw new AuthApiError("The auth request returned no data.");
  }

  return payload.data;
}

export function createWebappAuthGraphqlApi(
  options: CreateWebappAuthGraphqlApiOptions,
): WebappAuthGraphqlApi {
  let refreshPromise: Promise<AuthSession | null> | null = null;

  const requestGraphql = <TData>(
    query: string,
    variables: Record<string, unknown>,
  ) =>
    requestAuthGraphql<TData>(
      options.graphqlEndpoint,
      options.refreshTokenTransport,
      query,
      variables,
      options.fetch,
    );

  return {
    refreshStoredAuthSession: () => {
      refreshPromise ??= requestGraphql<AuthMutationData>(REFRESH_MUTATION, {
        input: options.refreshTokenTransport.createRefreshInput(),
      })
        .then((data) => {
          if (!data.refresh) {
            throw new AuthApiError("The refresh request returned no session.");
          }

          return options.setAuthSessionFromPayload(data.refresh);
        })
        .catch((error: unknown) => {
          if (
            error instanceof AuthApiError ||
            hasAuthRequiredGraphqlErrors({ errors: [error] })
          ) {
            options.clearAuthSession();
            return null;
          }

          options.clearAuthSession();
          return null;
        })
        .finally(() => {
          refreshPromise = null;
        });

      return refreshPromise;
    },
    logoutCurrentSession: async () => {
      const input = options.refreshTokenTransport.createLogoutInput();

      options.clearAuthSession();

      try {
        await requestGraphql<LogoutData>(LOGOUT_MUTATION, {
          input,
        });
      } catch {
        // Local state is already anonymous. A stale or missing refresh cookie
        // should not block the user from leaving the browser session.
      }
    },
  };
}

export function createWebappAuthSessionBootstrap(options: {
  getAuthState(): AuthState;
  refreshStoredAuthSession(): Promise<AuthSession | null>;
}): () => Promise<void> {
  let bootstrapPromise: Promise<void> | null = null;

  return () => {
    if (options.getAuthState().status !== "unknown") {
      return Promise.resolve();
    }

    bootstrapPromise ??= options
      .refreshStoredAuthSession()
      .then(() => {})
      .finally(() => {
        bootstrapPromise = null;
      });

    return bootstrapPromise;
  };
}
