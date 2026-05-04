import {
  BadRequestException,
  createParamDecorator,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  type CanActivate,
  type DynamicModule,
  type ExecutionContext,
  type InjectionToken,
  type ModuleMetadata,
  type Provider,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  extractBearerToken,
  REFRESH_TOKEN_TRANSPORT_COOKIE,
  REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY,
  type Principal,
  type RefreshTokenTransport,
} from "@labkit/auth-contract";
import type {
  CreateServerGraphqlOptionsInput,
  GraphqlSubscriptionPrincipalLike,
  MaybePromise,
  ServerGraphqlContext,
} from "@labkit/server-graphql";

const requireServerAuth = createRequire(__filename);

export const SERVER_AUTH_ACCESS_TOKEN_VERIFIER = Symbol(
  "labkit:server-auth:access-token-verifier",
);

export const IDENTITY_PROVIDER_REGISTRY_CONFIG = Symbol(
  "labkit:server-auth:identity-provider-registry-config",
);

export const IDENTITY_PROVIDERS = Symbol(
  "labkit:server-auth:identity-providers",
);

export const SERVER_AUTH_IDENTITY_ACCOUNT_REPOSITORY = Symbol(
  "labkit:server-auth:identity-account-repository",
);

export const SERVER_AUTH_ROLE_REPOSITORY = Symbol(
  "labkit:server-auth:role-repository",
);

export const SERVER_AUTH_REFRESH_SESSION_REPOSITORY = Symbol(
  "labkit:server-auth:refresh-session-repository",
);

export const SERVER_AUTH_TRANSACTION_RUNNER = Symbol(
  "labkit:server-auth:transaction-runner",
);

export const IS_PUBLIC_KEY = "access-control:is-public";
export const ROLES_KEY = "access-control:roles";

export const SERVER_AUTH_REFRESH_TOKEN_BYTE_LENGTH = 32;
export const SERVER_AUTH_REFRESH_TOKEN_HASH_ALGORITHM = "sha256";
export const SERVER_AUTH_LOCAL_IDENTITY_PROVIDER_ID = "local";

export const SERVER_AUTH_REFRESH_SESSION_STATE_VALID = "valid";
export const SERVER_AUTH_REFRESH_SESSION_STATE_MISSING = "missing";
export const SERVER_AUTH_REFRESH_SESSION_STATE_REVOKED = "revoked";
export const SERVER_AUTH_REFRESH_SESSION_STATE_EXPIRED = "expired";

export const SERVER_AUTH_EVENT_LOGIN_SUCCEEDED = "server-auth.login.succeeded";
export const SERVER_AUTH_EVENT_LOGIN_FAILED = "server-auth.login.failed";
export const SERVER_AUTH_EVENT_REGISTRATION_SUCCEEDED =
  "server-auth.registration.succeeded";
export const SERVER_AUTH_EVENT_REGISTRATION_FAILED =
  "server-auth.registration.failed";
export const SERVER_AUTH_EVENT_REFRESH_SUCCEEDED =
  "server-auth.refresh.succeeded";
export const SERVER_AUTH_EVENT_REFRESH_FAILED = "server-auth.refresh.failed";
export const SERVER_AUTH_EVENT_LOGOUT_SUCCEEDED =
  "server-auth.logout.succeeded";
export const SERVER_AUTH_EVENT_LOGOUT_FAILED = "server-auth.logout.failed";
export const SERVER_AUTH_EVENT_SESSIONS_REVOKED =
  "server-auth.sessions.revoked";
export const SERVER_AUTH_EVENT_SESSIONS_REVOKE_FAILED =
  "server-auth.sessions.revoke-failed";

export { type Principal } from "@labkit/auth-contract";

export enum IdentityProviderCapability {
  Login = "login",
  Registration = "registration",
  ExternalPrincipal = "external-principal",
}

export type ProviderLoginRequest = {
  email: string;
  password: string;
};

export type ProviderRegistrationRequest = {
  email: string;
  password: string;
  displayName?: string;
};

export type ProviderIdentity = {
  userId: string;
  subject: string;
  provider: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
};

export type ServerAuthPasswordHasher = {
  hashPassword(password: string): MaybePromise<string>;
  verifyPassword(hash: string, password: string): MaybePromise<boolean>;
};

export type ServerAuthLocalIdentityProviderConfigReader = {
  getDefaultRole(): string;
};

export type ServerAuthLocalIdentityProviderOptions = {
  accountRepository: ServerAuthIdentityAccountRepository;
  configReader: ServerAuthLocalIdentityProviderConfigReader;
  passwordHasher: ServerAuthPasswordHasher;
  providerId?: string;
  roleRepository: ServerAuthRoleRepository;
};

export type AuthSessionResult = {
  principal: Principal;
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export type ServerAuthUserRecord = {
  readonly userId: string;
  readonly displayName?: string | null;
  readonly email?: string | null;
  readonly isActive: boolean;
};

export type ServerAuthIdentityAccountRecord = {
  readonly passwordHash?: string | null;
  readonly provider: string;
  readonly subject: string;
  readonly user: ServerAuthUserRecord;
  readonly userId: string;
};

export type ServerAuthCreateIdentityAccountInput = {
  readonly displayName?: string;
  readonly email?: string;
  readonly passwordHash?: string;
  readonly provider: string;
  readonly roles: readonly string[];
  readonly subject: string;
};

export interface ServerAuthIdentityAccountRepository {
  createIdentityAccount(
    input: ServerAuthCreateIdentityAccountInput,
  ): Promise<ServerAuthIdentityAccountRecord>;
  findIdentityAccountByProviderSubject(
    provider: string,
    subject: string,
  ): Promise<ServerAuthIdentityAccountRecord | null>;
}

export interface ServerAuthRoleRepository {
  findRolesByUserId(userId: string): Promise<string[]>;
}

export type ServerAuthCreateRefreshSessionInput = {
  readonly expiresAt: Date;
  readonly id: string;
  readonly provider: string;
  readonly providerSubject: string;
  readonly tokenHash: string;
  readonly userId: string;
};

export type ServerAuthRefreshSessionRecord = ServerAuthRefreshSessionLike & {
  readonly createdAt?: Date;
  readonly id: string;
  readonly lastUsedAt?: Date | null;
  readonly provider: string;
  readonly providerSubject: string;
  readonly replacedBySessionId?: string | null;
  readonly roles?: readonly string[];
  readonly tokenHash: string;
  readonly user?: ServerAuthUserRecord | null;
  readonly userId: string;
};

export type ServerAuthRefreshSessionSelector =
  | {
      readonly sessionId: string;
      readonly tokenHash?: never;
    }
  | {
      readonly sessionId?: never;
      readonly tokenHash: string;
    };

export type ServerAuthRevokeRefreshSessionInput =
  ServerAuthRefreshSessionSelector & ServerAuthRefreshSessionRevocation;

export type ServerAuthRotateRefreshSessionInput = {
  readonly sessionId: string;
} & ServerAuthRefreshSessionRotation;

export type ServerAuthRevokeActiveRefreshSessionsForUserInput = {
  readonly revokedAt: Date;
  readonly userId: string;
};

export interface ServerAuthRefreshSessionRepository {
  createRefreshSession(
    input: ServerAuthCreateRefreshSessionInput,
  ): Promise<ServerAuthRefreshSessionRecord>;
  findRefreshSessionByTokenHash(
    tokenHash: string,
  ): Promise<ServerAuthRefreshSessionRecord | null>;
  revokeActiveRefreshSessionsForUser(
    input: ServerAuthRevokeActiveRefreshSessionsForUserInput,
  ): Promise<void>;
  revokeRefreshSession(
    input: ServerAuthRevokeRefreshSessionInput,
  ): Promise<boolean>;
  rotateRefreshSession(
    input: ServerAuthRotateRefreshSessionInput,
  ): Promise<void>;
}

export type ServerAuthPersistenceRepositories = {
  readonly identityAccounts: ServerAuthIdentityAccountRepository;
  readonly refreshSessions: ServerAuthRefreshSessionRepository;
  readonly roles: ServerAuthRoleRepository;
};

export interface ServerAuthTransactionRunner<
  TRepositories extends
    ServerAuthPersistenceRepositories = ServerAuthPersistenceRepositories,
> {
  runInTransaction<TResult>(
    operation: (repositories: TRepositories) => MaybePromise<TResult>,
  ): Promise<TResult>;
}

export type ServerAuthIssueAccessTokenInput = {
  readonly accessTokenExpiresAt: Date;
  readonly principal: Principal;
  readonly sessionId: string;
};

export type ServerAuthIssueAccessToken = (
  input: ServerAuthIssueAccessTokenInput,
) => MaybePromise<string>;

export type ServerAuthSessionOrchestratorOptions = {
  readonly generateRefreshToken?: () => string;
  readonly generateSessionId?: () => string;
  readonly getAccessTokenExpiresAt: () => Date;
  readonly getNow?: () => Date;
  readonly getRefreshTokenTtlSeconds: () => number;
  readonly hashRefreshToken?: (refreshToken: string) => string;
  readonly issueAccessToken: ServerAuthIssueAccessToken;
  readonly refreshSessionRepository: ServerAuthRefreshSessionRepository;
  readonly roleRepository: ServerAuthRoleRepository;
};

export class ServerAuthSessionOrchestrator {
  private readonly generateRefreshToken: () => string;
  private readonly generateSessionId: () => string;
  private readonly getNow: () => Date;
  private readonly hashRefreshToken: (refreshToken: string) => string;

  constructor(private readonly options: ServerAuthSessionOrchestratorOptions) {
    this.generateRefreshToken =
      options.generateRefreshToken ?? generateServerAuthRefreshToken;
    this.generateSessionId = options.generateSessionId ?? randomUUID;
    this.getNow = options.getNow ?? (() => new Date());
    this.hashRefreshToken =
      options.hashRefreshToken ?? hashServerAuthRefreshToken;
  }

  async createSession(identity: ProviderIdentity): Promise<AuthSessionResult> {
    const refreshToken = this.generateRefreshToken();
    const refreshTokenExpiresAt = getServerAuthRefreshTokenExpiresAt(
      this.options.getRefreshTokenTtlSeconds(),
      this.getNow(),
    );
    const sessionId = this.generateSessionId();
    const principal = createServerAuthPrincipalFromProviderIdentity(
      identity,
      sessionId,
    );
    const accessTokenExpiresAt = this.options.getAccessTokenExpiresAt();

    await this.options.refreshSessionRepository.createRefreshSession({
      expiresAt: refreshTokenExpiresAt,
      id: sessionId,
      provider: identity.provider,
      providerSubject: identity.subject,
      tokenHash: this.hashRefreshToken(refreshToken),
      userId: identity.userId,
    });

    return {
      accessToken: await this.options.issueAccessToken({
        accessTokenExpiresAt,
        principal,
        sessionId,
      }),
      accessTokenExpiresAt,
      principal,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  async refreshSession(refreshToken: string): Promise<AuthSessionResult> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const session =
      await this.options.refreshSessionRepository.findRefreshSessionByTokenHash(
        tokenHash,
      );

    if (!session) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const sessionState = getServerAuthRefreshSessionState(
      session,
      this.getNow(),
    );
    if (sessionState === SERVER_AUTH_REFRESH_SESSION_STATE_REVOKED) {
      await this.revokeAllSessionsForUser(session.userId);
      throw new UnauthorizedException("Refresh token has been revoked");
    }

    if (sessionState === SERVER_AUTH_REFRESH_SESSION_STATE_EXPIRED) {
      await this.options.refreshSessionRepository.revokeRefreshSession({
        sessionId: session.id,
        ...createServerAuthRefreshSessionRevocation(this.getNow()),
      });
      throw new UnauthorizedException("Refresh token has expired");
    }

    const roles = session.roles
      ? [...session.roles]
      : await this.options.roleRepository.findRolesByUserId(session.userId);
    const result = await this.createSession({
      displayName: session.user?.displayName ?? undefined,
      permissions: [],
      provider: session.provider,
      roles,
      subject: session.providerSubject,
      userId: session.userId,
    });

    await this.options.refreshSessionRepository.rotateRefreshSession({
      sessionId: session.id,
      ...createServerAuthRefreshSessionRotation(
        result.principal.sessionId!,
        this.getNow(),
      ),
    });

    return result;
  }

  async revokeRefreshToken(refreshToken: string): Promise<boolean> {
    return this.options.refreshSessionRepository.revokeRefreshSession({
      tokenHash: this.hashRefreshToken(refreshToken),
      ...createServerAuthRefreshSessionRevocation(this.getNow()),
    });
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.options.refreshSessionRepository.revokeActiveRefreshSessionsForUser(
      {
        userId,
        ...createServerAuthRefreshSessionRevocation(this.getNow()),
      },
    );
  }
}

export type ServerAuthLifecycleEventName =
  | typeof SERVER_AUTH_EVENT_LOGIN_SUCCEEDED
  | typeof SERVER_AUTH_EVENT_LOGIN_FAILED
  | typeof SERVER_AUTH_EVENT_REGISTRATION_SUCCEEDED
  | typeof SERVER_AUTH_EVENT_REGISTRATION_FAILED
  | typeof SERVER_AUTH_EVENT_REFRESH_SUCCEEDED
  | typeof SERVER_AUTH_EVENT_REFRESH_FAILED
  | typeof SERVER_AUTH_EVENT_LOGOUT_SUCCEEDED
  | typeof SERVER_AUTH_EVENT_LOGOUT_FAILED
  | typeof SERVER_AUTH_EVENT_SESSIONS_REVOKED
  | typeof SERVER_AUTH_EVENT_SESSIONS_REVOKE_FAILED;

export type ServerAuthLifecycleEventMetadata = Readonly<
  Record<string, unknown>
>;

export type ServerAuthLifecycleEventBase<TType extends string = string> = {
  readonly type: TType;
  readonly occurredAt: Date;
  readonly metadata?: ServerAuthLifecycleEventMetadata;
};

export type ServerAuthLifecyclePrincipalEvent<
  TType extends ServerAuthLifecycleEventName,
> = ServerAuthLifecycleEventBase<TType> & {
  readonly principal: Principal;
};

export type ServerAuthLifecycleFailedEvent<
  TType extends ServerAuthLifecycleEventName,
> = ServerAuthLifecycleEventBase<TType> & {
  readonly error?: unknown;
  readonly provider?: string;
  readonly reason?: string;
  readonly subject?: string;
};

export type ServerAuthLoginSucceededEvent = ServerAuthLifecyclePrincipalEvent<
  typeof SERVER_AUTH_EVENT_LOGIN_SUCCEEDED
>;

export type ServerAuthLoginFailedEvent = ServerAuthLifecycleFailedEvent<
  typeof SERVER_AUTH_EVENT_LOGIN_FAILED
>;

export type ServerAuthRegistrationSucceededEvent =
  ServerAuthLifecyclePrincipalEvent<
    typeof SERVER_AUTH_EVENT_REGISTRATION_SUCCEEDED
  >;

export type ServerAuthRegistrationFailedEvent = ServerAuthLifecycleFailedEvent<
  typeof SERVER_AUTH_EVENT_REGISTRATION_FAILED
>;

export type ServerAuthRefreshSucceededEvent = ServerAuthLifecyclePrincipalEvent<
  typeof SERVER_AUTH_EVENT_REFRESH_SUCCEEDED
>;

export type ServerAuthRefreshFailedEvent = ServerAuthLifecycleFailedEvent<
  typeof SERVER_AUTH_EVENT_REFRESH_FAILED
>;

export type ServerAuthLogoutSucceededEvent = ServerAuthLifecycleEventBase<
  typeof SERVER_AUTH_EVENT_LOGOUT_SUCCEEDED
> & {
  readonly principal?: Principal;
};

export type ServerAuthLogoutFailedEvent = ServerAuthLifecycleFailedEvent<
  typeof SERVER_AUTH_EVENT_LOGOUT_FAILED
>;

export type ServerAuthSessionsRevokedEvent = ServerAuthLifecyclePrincipalEvent<
  typeof SERVER_AUTH_EVENT_SESSIONS_REVOKED
> & {
  readonly scope?: "principal" | "user";
};

export type ServerAuthSessionsRevokeFailedEvent =
  ServerAuthLifecycleFailedEvent<
    typeof SERVER_AUTH_EVENT_SESSIONS_REVOKE_FAILED
  >;

export type ServerAuthLifecycleEvent =
  | ServerAuthLoginSucceededEvent
  | ServerAuthLoginFailedEvent
  | ServerAuthRegistrationSucceededEvent
  | ServerAuthRegistrationFailedEvent
  | ServerAuthRefreshSucceededEvent
  | ServerAuthRefreshFailedEvent
  | ServerAuthLogoutSucceededEvent
  | ServerAuthLogoutFailedEvent
  | ServerAuthSessionsRevokedEvent
  | ServerAuthSessionsRevokeFailedEvent;

export type ServerAuthLifecycleEventHandler<
  TEvent extends ServerAuthLifecycleEventBase = ServerAuthLifecycleEvent,
> = (event: TEvent) => MaybePromise<void>;

export type ServerAuthLifecycleEventHandlerError<
  TEvent extends ServerAuthLifecycleEventBase = ServerAuthLifecycleEvent,
> = {
  readonly error: unknown;
  readonly event: TEvent;
  readonly handler: ServerAuthLifecycleEventHandler<TEvent>;
  readonly handlerIndex: number;
};

export type ServerAuthLifecycleEventErrorPolicy = "throw" | "continue";

export type CreateServerAuthLifecycleEventDispatcherInput<
  TEvent extends ServerAuthLifecycleEventBase = ServerAuthLifecycleEvent,
> = {
  readonly errorPolicy?: ServerAuthLifecycleEventErrorPolicy;
  readonly handlers?: readonly ServerAuthLifecycleEventHandler<TEvent>[];
  readonly onHandlerError?: (
    error: ServerAuthLifecycleEventHandlerError<TEvent>,
  ) => MaybePromise<void>;
};

export type ServerAuthLifecycleEventDispatcher<
  TEvent extends ServerAuthLifecycleEventBase = ServerAuthLifecycleEvent,
> = (event: TEvent) => Promise<void>;

export type ServerAuthAccessTokenClaims = {
  provider: string;
  providerSubject: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
};

export type ServerAuthAccessTokenPayload = {
  sub?: unknown;
  provider?: unknown;
  providerSubject?: unknown;
  displayName?: unknown;
  roles?: unknown;
  permissions?: unknown;
  sessionId?: unknown;
};

export type ServerAuthRefreshSessionState =
  | typeof SERVER_AUTH_REFRESH_SESSION_STATE_VALID
  | typeof SERVER_AUTH_REFRESH_SESSION_STATE_MISSING
  | typeof SERVER_AUTH_REFRESH_SESSION_STATE_REVOKED
  | typeof SERVER_AUTH_REFRESH_SESSION_STATE_EXPIRED;

export type ServerAuthRefreshSessionLike = {
  expiresAt: Date;
  revokedAt?: Date | null;
};

export type ServerAuthRefreshSessionRevocation = {
  revokedAt: Date;
};

export type ServerAuthRefreshSessionRotation =
  ServerAuthRefreshSessionRevocation & {
    lastUsedAt: Date;
    replacedBySessionId: string;
  };

export type ServerAuthRefreshCookieSameSite = "strict" | "lax" | "none";

export type ServerAuthRefreshTokenTransportConfig = {
  transport: RefreshTokenTransport;
  cookieName: string;
  cookiePath: string;
  cookieSameSite: ServerAuthRefreshCookieSameSite;
  cookieSecure: boolean;
  refreshTokenTtlSeconds: number;
};

export type ServerAuthRefreshTokenTransportConfigReader = {
  getRefreshCookieName(): string;
  getRefreshCookiePath(): string;
  getRefreshCookieSameSite(): ServerAuthRefreshCookieSameSite;
  isRefreshCookieSecure(): boolean;
  getRefreshTokenTransport(): RefreshTokenTransport;
  getRefreshTokenTtlSeconds(): number;
};

export type ServerAuthRefreshCookieSetOptions = {
  httpOnly: true;
  maxAge: number;
  path: string;
  sameSite: ServerAuthRefreshCookieSameSite;
  secure: boolean;
};

export type ServerAuthRefreshCookieClearOptions = {
  path: string;
  sameSite: ServerAuthRefreshCookieSameSite;
  secure: boolean;
};

export type ServerAuthRefreshTokenRequest = {
  readonly cookies?: Record<string, string | undefined>;
};

export type ServerAuthRefreshTokenReply = {
  clearCookie?: (
    name: string,
    options?: ServerAuthRefreshCookieClearOptions,
  ) => unknown;
  setCookie?: (
    name: string,
    value: string,
    options?: ServerAuthRefreshCookieSetOptions,
  ) => unknown;
};

export type ServerAuthRefreshTokenTransportContext = {
  readonly req?: ServerAuthRefreshTokenRequest;
  readonly reply?: ServerAuthRefreshTokenReply;
};

export type DeliverServerAuthRefreshTokenInput = {
  config: ServerAuthRefreshTokenTransportConfig;
  context: ServerAuthRefreshTokenTransportContext;
  refreshToken: string;
};

export type ExtractServerAuthRefreshTokenInput = {
  config: ServerAuthRefreshTokenTransportConfig;
  context: ServerAuthRefreshTokenTransportContext;
  explicitRefreshToken?: string | null;
};

export type ClearServerAuthRefreshTokenInput = {
  config: ServerAuthRefreshTokenTransportConfig;
  context: ServerAuthRefreshTokenTransportContext;
};

export type CreateServerAuthRefreshTokenTransportProviderInput = {
  configReaderToken: InjectionToken;
  provide?: InjectionToken;
};

export type CreateServerAuthLocalIdentityProviderInput = {
  accountRepositoryToken?: InjectionToken;
  configReaderToken: InjectionToken;
  passwordHasherToken: InjectionToken;
  provide?: InjectionToken;
  providerId?: string;
  roleRepositoryToken?: InjectionToken;
};

export interface IdentityProvider {
  readonly id: string;
  readonly capabilities: readonly IdentityProviderCapability[];
  login?(request: ProviderLoginRequest): Promise<ProviderIdentity>;
  register?(request: ProviderRegistrationRequest): Promise<ProviderIdentity>;
}

export type IdentityProviderRegistryConfig = {
  getDefaultLoginProvider(): string;
  getEnabledProviders(): readonly string[];
  getRegistrationProvider(): string;
};

export type ServerAuthRolePrincipal = GraphqlSubscriptionPrincipalLike & {
  readonly roles: readonly string[];
};

export type ServerAuthHttpRequest<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
> = {
  readonly headers?: {
    readonly authorization?: string | string[];
  };
  principal?: TPrincipal | null;
};

export type ServerAuthGraphqlContext<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
  TRequest extends
    ServerAuthHttpRequest<TPrincipal> = ServerAuthHttpRequest<TPrincipal>,
> = {
  readonly req?: TRequest;
  principal?: TPrincipal | null;
};

export type ServerAuthAccessTokenVerifier<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
> = (accessToken: string) => MaybePromise<TPrincipal | null>;

export type ServerAuthAccessTokenService<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
> = {
  verifyAccessToken: ServerAuthAccessTokenVerifier<TPrincipal>;
};

export type CreateServerAuthGraphqlIntegrationInput<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
> = Omit<
  CreateServerGraphqlOptionsInput<TPrincipal, TRequest, TReply, TContext>,
  "resolvePrincipalFromAuthorization"
> & {
  verifyAccessToken: ServerAuthAccessTokenVerifier<TPrincipal>;
};

export type CreateServerAuthAccessTokenGraphqlIntegrationInput<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
> = Omit<
  CreateServerAuthGraphqlIntegrationInput<
    TPrincipal,
    TRequest,
    TReply,
    TContext
  >,
  "verifyAccessToken"
> & {
  accessTokenService: ServerAuthAccessTokenService<TPrincipal>;
};

export type CreateServerAuthGraphqlModuleInput<
  TFactoryArgs extends unknown[],
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
> = {
  imports?: ModuleMetadata["imports"];
  inject?: InjectionToken[];
  useFactory: (
    ...args: TFactoryArgs
  ) => MaybePromise<
    CreateServerAuthGraphqlIntegrationInput<
      TPrincipal,
      TRequest,
      TReply,
      TContext
    >
  >;
};

export type CreateServerAuthAccessTokenGraphqlModuleInput<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
> = Omit<
  CreateServerAuthAccessTokenGraphqlIntegrationInput<
    TPrincipal,
    TRequest,
    TReply,
    TContext
  >,
  "accessTokenService" | "configReader"
> & {
  accessTokenServiceToken: InjectionToken;
  configReaderToken: InjectionToken;
  imports?: ModuleMetadata["imports"];
};

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal | null => {
    if (context.getType<string>() === "graphql") {
      const gqlContext = getGraphqlContext<Principal>(context);
      return gqlContext.principal ?? null;
    }

    const request = context
      .switchToHttp()
      .getRequest<ServerAuthHttpRequest<Principal>>();

    return request.principal ?? null;
  },
);

export class ServerAuthLocalIdentityProvider implements IdentityProvider {
  readonly id: string;
  readonly capabilities = [
    IdentityProviderCapability.Login,
    IdentityProviderCapability.Registration,
  ] as const;

  private readonly accountRepository: ServerAuthIdentityAccountRepository;
  private readonly configReader: ServerAuthLocalIdentityProviderConfigReader;
  private readonly passwordHasher: ServerAuthPasswordHasher;
  private readonly roleRepository: ServerAuthRoleRepository;

  constructor(options: ServerAuthLocalIdentityProviderOptions) {
    this.accountRepository = options.accountRepository;
    this.configReader = options.configReader;
    this.id = options.providerId ?? SERVER_AUTH_LOCAL_IDENTITY_PROVIDER_ID;
    this.passwordHasher = options.passwordHasher;
    this.roleRepository = options.roleRepository;
  }

  async login(request: ProviderLoginRequest): Promise<ProviderIdentity> {
    const subject = normalizeServerAuthLocalIdentitySubject(request.email);
    const account =
      await this.accountRepository.findIdentityAccountByProviderSubject(
        this.id,
        subject,
      );

    if (!account?.passwordHash || !account.user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatches = await this.passwordHasher.verifyPassword(
      account.passwordHash,
      request.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const roles = await this.roleRepository.findRolesByUserId(account.userId);
    return {
      displayName: account.user.displayName ?? undefined,
      permissions: [],
      provider: this.id,
      roles,
      subject,
      userId: account.userId,
    };
  }

  async register(
    request: ProviderRegistrationRequest,
  ): Promise<ProviderIdentity> {
    const subject = normalizeServerAuthLocalIdentitySubject(request.email);
    const existingAccount =
      await this.accountRepository.findIdentityAccountByProviderSubject(
        this.id,
        subject,
      );
    if (existingAccount) {
      throw new BadRequestException("Local identity already exists");
    }

    const passwordHash = await this.passwordHasher.hashPassword(
      request.password,
    );
    const defaultRole = this.configReader.getDefaultRole();

    const account = await this.accountRepository.createIdentityAccount({
      displayName: request.displayName,
      email: subject,
      passwordHash,
      provider: this.id,
      roles: [defaultRole],
      subject,
    });

    return {
      displayName: account.user.displayName ?? undefined,
      permissions: [],
      provider: this.id,
      roles: [defaultRole],
      subject,
      userId: account.userId,
    };
  }
}

export function normalizeServerAuthLocalIdentitySubject(email: string): string {
  return email.trim().toLowerCase();
}

export function createServerAuthLocalIdentityProviderProvider({
  accountRepositoryToken = SERVER_AUTH_IDENTITY_ACCOUNT_REPOSITORY,
  configReaderToken,
  passwordHasherToken,
  provide = ServerAuthLocalIdentityProvider,
  providerId = SERVER_AUTH_LOCAL_IDENTITY_PROVIDER_ID,
  roleRepositoryToken = SERVER_AUTH_ROLE_REPOSITORY,
}: CreateServerAuthLocalIdentityProviderInput): Provider {
  return {
    provide,
    useFactory: (
      configReader: ServerAuthLocalIdentityProviderConfigReader,
      passwordHasher: ServerAuthPasswordHasher,
      accountRepository: ServerAuthIdentityAccountRepository,
      roleRepository: ServerAuthRoleRepository,
    ) =>
      new ServerAuthLocalIdentityProvider({
        accountRepository,
        configReader,
        passwordHasher,
        providerId,
        roleRepository,
      }),
    inject: [
      configReaderToken,
      passwordHasherToken,
      accountRepositoryToken,
      roleRepositoryToken,
    ],
  };
}

@Injectable()
export class IdentityProviderRegistry {
  private readonly providersById = new Map<string, IdentityProvider>();

  constructor(
    @Inject(IDENTITY_PROVIDER_REGISTRY_CONFIG)
    private readonly identityConfig: IdentityProviderRegistryConfig,
    @Inject(IDENTITY_PROVIDERS)
    providers: readonly IdentityProvider[],
  ) {
    for (const provider of providers) {
      this.providersById.set(provider.id, provider);
    }
  }

  getLoginProvider(providerId?: string): IdentityProvider {
    return this.getEnabledProviderWithCapability(
      providerId || this.identityConfig.getDefaultLoginProvider(),
      IdentityProviderCapability.Login,
    );
  }

  getRegistrationProvider(providerId?: string): IdentityProvider {
    return this.getEnabledProviderWithCapability(
      providerId || this.identityConfig.getRegistrationProvider(),
      IdentityProviderCapability.Registration,
    );
  }

  private getEnabledProviderWithCapability(
    providerId: string,
    capability: IdentityProviderCapability,
  ): IdentityProvider {
    const enabledProviders = new Set(this.identityConfig.getEnabledProviders());
    if (!enabledProviders.has(providerId)) {
      throw new BadRequestException(
        `Identity provider ${providerId} is not enabled`,
      );
    }

    const provider = this.providersById.get(providerId);
    if (!provider) {
      throw new BadRequestException(
        `Identity provider ${providerId} is not registered`,
      );
    }

    if (!provider.capabilities.includes(capability)) {
      throw new BadRequestException(
        `Identity provider ${providerId} does not support ${capability}`,
      );
    }

    return provider;
  }
}

@Injectable()
export class GraphqlAuthenticationGuard<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
> implements CanActivate
{
  constructor(
    @Inject(SERVER_AUTH_ACCESS_TOKEN_VERIFIER)
    private readonly verifyAccessToken: ServerAuthAccessTokenVerifier<TPrincipal>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const gqlContext = getGraphqlContext<TPrincipal>(context);
    if (gqlContext.principal) {
      return true;
    }

    const accessToken = extractBearerToken(
      gqlContext.req?.headers?.authorization,
    );

    if (!accessToken) {
      throw new UnauthorizedException("Authentication is required");
    }

    const principal = await this.verifyAccessToken(accessToken);
    if (!principal) {
      throw new UnauthorizedException("Authentication is required");
    }

    gqlContext.principal = principal;
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}

@Injectable()
export class RolesGuard<TPrincipal extends ServerAuthRolePrincipal = Principal>
  implements CanActivate
{
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublic(context)) {
      return true;
    }

    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const gqlContext = getGraphqlContext<TPrincipal>(context);
    const principal = gqlContext.principal;
    if (!principal) {
      throw new ForbiddenException("Role is required");
    }

    const hasRequiredRole = requiredRoles.some((role) =>
      principal.roles.includes(role),
    );
    if (!hasRequiredRole) {
      throw new ForbiddenException("Insufficient role");
    }

    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}

export function createServerAuthAccessTokenVerifier<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
>(
  accessTokenService: ServerAuthAccessTokenService<TPrincipal>,
): ServerAuthAccessTokenVerifier<TPrincipal> {
  return (accessToken) => accessTokenService.verifyAccessToken(accessToken);
}

export function getServerAuthAccessTokenExpiresAt(
  ttlSeconds: number,
  now = new Date(),
): Date {
  return new Date(now.getTime() + ttlSeconds * 1000);
}

export function getServerAuthAccessTokenExpiresInSeconds(
  expiresAt: Date,
  now = new Date(),
): number {
  return Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
}

export function createServerAuthAccessTokenClaims(
  principal: Principal,
  sessionId: string,
): ServerAuthAccessTokenClaims {
  const claims: ServerAuthAccessTokenClaims = {
    permissions: [...principal.permissions],
    provider: principal.provider,
    providerSubject: principal.subject,
    roles: [...principal.roles],
    sessionId,
  };

  if (typeof principal.displayName === "string") {
    claims.displayName = principal.displayName;
  }

  return claims;
}

export function createServerAuthPrincipalFromProviderIdentity(
  identity: ProviderIdentity,
  sessionId: string,
): Principal {
  const principal: Principal = {
    permissions: [...identity.permissions],
    provider: identity.provider,
    roles: [...identity.roles],
    sessionId,
    subject: identity.subject,
    userId: identity.userId,
  };

  if (typeof identity.displayName === "string") {
    principal.displayName = identity.displayName;
  }

  return principal;
}

export function createServerAuthPrincipalFromAccessTokenPayload(
  payload: ServerAuthAccessTokenPayload,
): Principal | null {
  const userId = payload.sub;
  const provider = payload.provider;
  const providerSubject = payload.providerSubject;
  const displayName = payload.displayName;
  const roles = payload.roles;
  const permissions = payload.permissions;
  const sessionId = payload.sessionId;

  if (
    typeof userId !== "string" ||
    typeof provider !== "string" ||
    typeof providerSubject !== "string" ||
    (displayName !== undefined && typeof displayName !== "string") ||
    !Array.isArray(roles) ||
    !Array.isArray(permissions) ||
    typeof sessionId !== "string"
  ) {
    return null;
  }

  const principal: Principal = {
    permissions: permissions.filter(isString),
    provider,
    roles: roles.filter(isString),
    sessionId,
    subject: providerSubject,
    userId,
  };

  if (typeof displayName === "string") {
    principal.displayName = displayName;
  }

  return principal;
}

export function generateServerAuthRefreshToken(
  byteLength = SERVER_AUTH_REFRESH_TOKEN_BYTE_LENGTH,
): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashServerAuthRefreshToken(refreshToken: string): string {
  return createHash(SERVER_AUTH_REFRESH_TOKEN_HASH_ALGORITHM)
    .update(refreshToken)
    .digest("hex");
}

export function getServerAuthRefreshTokenExpiresAt(
  ttlSeconds: number,
  now = new Date(),
): Date {
  return new Date(now.getTime() + ttlSeconds * 1000);
}

export function isServerAuthRefreshSessionExpired(
  expiresAt: Date,
  now = new Date(),
): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function getServerAuthRefreshSessionState(
  session: ServerAuthRefreshSessionLike | null | undefined,
  now = new Date(),
): ServerAuthRefreshSessionState {
  if (!session) {
    return SERVER_AUTH_REFRESH_SESSION_STATE_MISSING;
  }

  if (session.revokedAt) {
    return SERVER_AUTH_REFRESH_SESSION_STATE_REVOKED;
  }

  if (isServerAuthRefreshSessionExpired(session.expiresAt, now)) {
    return SERVER_AUTH_REFRESH_SESSION_STATE_EXPIRED;
  }

  return SERVER_AUTH_REFRESH_SESSION_STATE_VALID;
}

export function createServerAuthRefreshSessionRevocation(
  now = new Date(),
): ServerAuthRefreshSessionRevocation {
  return {
    revokedAt: now,
  };
}

export function createServerAuthRefreshSessionRotation(
  replacedBySessionId: string,
  now = new Date(),
): ServerAuthRefreshSessionRotation {
  return {
    lastUsedAt: now,
    replacedBySessionId,
    revokedAt: now,
  };
}

export function createServerAuthRefreshCookieSetOptions(
  config: ServerAuthRefreshTokenTransportConfig,
): ServerAuthRefreshCookieSetOptions {
  return {
    httpOnly: true,
    maxAge: config.refreshTokenTtlSeconds,
    path: config.cookiePath,
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
  };
}

export function createServerAuthRefreshCookieClearOptions(
  config: ServerAuthRefreshTokenTransportConfig,
): ServerAuthRefreshCookieClearOptions {
  return {
    path: config.cookiePath,
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
  };
}

export function deliverServerAuthRefreshToken({
  config,
  context,
  refreshToken,
}: DeliverServerAuthRefreshTokenInput): string | undefined {
  if (config.transport === REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY) {
    return refreshToken;
  }

  const reply = context.reply;
  if (!reply?.setCookie) {
    throw new Error("Cookie refresh transport requires a response object");
  }

  reply.setCookie(
    config.cookieName,
    refreshToken,
    createServerAuthRefreshCookieSetOptions(config),
  );

  return undefined;
}

export function extractServerAuthRefreshToken({
  config,
  context,
  explicitRefreshToken,
}: ExtractServerAuthRefreshTokenInput): string {
  if (config.transport === REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY) {
    if (!explicitRefreshToken) {
      throw new UnauthorizedException("Refresh token is required");
    }

    return explicitRefreshToken;
  }

  const refreshToken = context.req?.cookies?.[config.cookieName];
  if (!refreshToken) {
    throw new UnauthorizedException("Refresh token cookie is required");
  }

  return refreshToken;
}

export function clearServerAuthRefreshToken({
  config,
  context,
}: ClearServerAuthRefreshTokenInput): void {
  if (config.transport !== REFRESH_TOKEN_TRANSPORT_COOKIE) {
    return;
  }

  const reply = context.reply;
  reply?.clearCookie?.(
    config.cookieName,
    createServerAuthRefreshCookieClearOptions(config),
  );
}

@Injectable()
export class ServerAuthRefreshTokenTransportService {
  constructor(
    private readonly configReader: ServerAuthRefreshTokenTransportConfigReader,
  ) {}

  deliverRefreshToken(
    context: ServerAuthRefreshTokenTransportContext,
    refreshToken: string,
  ): string | undefined {
    return deliverServerAuthRefreshToken({
      config: this.getRefreshTokenTransportConfig(),
      context,
      refreshToken,
    });
  }

  extractRefreshToken(
    context: ServerAuthRefreshTokenTransportContext,
    explicitRefreshToken?: string | null,
  ): string {
    return extractServerAuthRefreshToken({
      config: this.getRefreshTokenTransportConfig(),
      context,
      explicitRefreshToken,
    });
  }

  clearRefreshToken(context: ServerAuthRefreshTokenTransportContext): void {
    clearServerAuthRefreshToken({
      config: this.getRefreshTokenTransportConfig(),
      context,
    });
  }

  getRefreshTokenTransportConfig(): ServerAuthRefreshTokenTransportConfig {
    return {
      cookieName: this.configReader.getRefreshCookieName(),
      cookiePath: this.configReader.getRefreshCookiePath(),
      cookieSameSite: this.configReader.getRefreshCookieSameSite(),
      cookieSecure: this.configReader.isRefreshCookieSecure(),
      refreshTokenTtlSeconds: this.configReader.getRefreshTokenTtlSeconds(),
      transport: this.configReader.getRefreshTokenTransport(),
    };
  }
}

export function createServerAuthRefreshTokenTransportProvider({
  configReaderToken,
  provide = ServerAuthRefreshTokenTransportService,
}: CreateServerAuthRefreshTokenTransportProviderInput): Provider {
  return {
    provide,
    useFactory: (configReader: ServerAuthRefreshTokenTransportConfigReader) =>
      new ServerAuthRefreshTokenTransportService(configReader),
    inject: [configReaderToken],
  };
}

export function createServerAuthLifecycleEvent<
  TEvent extends ServerAuthLifecycleEventBase,
>(
  event: Omit<TEvent, "occurredAt"> & { readonly occurredAt?: Date },
  now = new Date(),
): TEvent {
  return {
    ...event,
    occurredAt: event.occurredAt ?? now,
  } as TEvent;
}

export function createServerAuthLifecycleEventDispatcher<
  TEvent extends ServerAuthLifecycleEventBase = ServerAuthLifecycleEvent,
>(
  options: CreateServerAuthLifecycleEventDispatcherInput<TEvent> = {},
): ServerAuthLifecycleEventDispatcher<TEvent> {
  const handlers = [...(options.handlers ?? [])];
  const errorPolicy = options.errorPolicy ?? "throw";

  return async (event) => {
    for (let handlerIndex = 0; handlerIndex < handlers.length; handlerIndex++) {
      const handler = handlers[handlerIndex];

      try {
        await handler(event);
      } catch (error) {
        await options.onHandlerError?.({
          error,
          event,
          handler,
          handlerIndex,
        });

        if (errorPolicy === "throw") {
          throw error;
        }
      }
    }
  };
}

export function createIdentityProviderRegistryConfigProvider(
  configToken: InjectionToken<IdentityProviderRegistryConfig>,
): Provider {
  return {
    provide: IDENTITY_PROVIDER_REGISTRY_CONFIG,
    useExisting: configToken,
  };
}

export function createServerAuthAccessTokenGraphqlIntegration<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
>(
  options: CreateServerAuthAccessTokenGraphqlIntegrationInput<
    TPrincipal,
    TRequest,
    TReply,
    TContext
  >,
): CreateServerAuthGraphqlIntegrationInput<
  TPrincipal,
  TRequest,
  TReply,
  TContext
> {
  const { accessTokenService, ...graphqlOptions } = options;

  return {
    ...graphqlOptions,
    verifyAccessToken: createServerAuthAccessTokenVerifier(accessTokenService),
  };
}

export function createServerAuthGraphqlModule<
  TFactoryArgs extends unknown[],
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
>(
  options: CreateServerAuthGraphqlModuleInput<
    TFactoryArgs,
    TPrincipal,
    TRequest,
    TReply,
    TContext
  >,
): DynamicModule {
  const createGraphqlModule = getCreateServerGraphqlModule();

  return createGraphqlModule<
    TFactoryArgs,
    TPrincipal,
    TRequest,
    TReply,
    TContext
  >({
    imports: options.imports,
    inject: options.inject,
    useFactory: async (...args) =>
      createServerAuthGraphqlIntegration(await options.useFactory(...args)),
  });
}

export function createServerAuthAccessTokenGraphqlModule<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
>(
  options: CreateServerAuthAccessTokenGraphqlModuleInput<
    TPrincipal,
    TRequest,
    TReply,
    TContext
  >,
): DynamicModule {
  const {
    accessTokenServiceToken,
    configReaderToken,
    imports,
    ...graphqlOptions
  } = options;

  return createServerAuthGraphqlModule<
    [
      CreateServerAuthGraphqlIntegrationInput<
        TPrincipal,
        TRequest,
        TReply,
        TContext
      >["configReader"],
      ServerAuthAccessTokenService<TPrincipal>,
    ],
    TPrincipal,
    TRequest,
    TReply,
    TContext
  >({
    imports,
    inject: [configReaderToken, accessTokenServiceToken],
    useFactory: (configReader, accessTokenService) =>
      createServerAuthAccessTokenGraphqlIntegration({
        ...graphqlOptions,
        accessTokenService,
        configReader,
      }),
  });
}

export function createServerAuthGraphqlIntegration<
  TPrincipal extends GraphqlSubscriptionPrincipalLike = Principal,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
>(
  options: CreateServerAuthGraphqlIntegrationInput<
    TPrincipal,
    TRequest,
    TReply,
    TContext
  >,
): CreateServerGraphqlOptionsInput<TPrincipal, TRequest, TReply, TContext> {
  const { verifyAccessToken, ...graphqlOptions } = options;

  return {
    ...graphqlOptions,
    resolvePrincipalFromAuthorization: (authorizationHeader) => {
      const accessToken = extractBearerToken(authorizationHeader);
      if (!accessToken) {
        return null;
      }

      return verifyAccessToken(accessToken);
    },
  };
}

function getCreateServerGraphqlModule(): typeof import("@labkit/server-graphql").createServerGraphqlModule {
  return (
    requireServerAuth(
      "@labkit/server-graphql",
    ) as typeof import("@labkit/server-graphql")
  ).createServerGraphqlModule;
}

function getGraphqlContext<TPrincipal extends GraphqlSubscriptionPrincipalLike>(
  context: ExecutionContext,
): ServerAuthGraphqlContext<TPrincipal> {
  return GqlExecutionContext.create(context).getContext<
    ServerAuthGraphqlContext<TPrincipal>
  >();
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
