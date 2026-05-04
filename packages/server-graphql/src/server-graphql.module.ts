import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { ApolloDriver, type ApolloDriverConfig } from "@nestjs/apollo";
import {
  Logger,
  type DynamicModule,
  type InjectionToken,
  type ModuleMetadata,
} from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { extractGraphqlWsAuthorization } from "@omgjs/labkit-auth-contract";
import type { ConfigReader } from "@omgjs/labkit-server-config";
import type { StructuredLogger } from "@omgjs/labkit-server-observability";
import {
  createGraphqlWsConnectionId,
  getGraphqlContextParts,
  getGraphqlSubscriptionConnectDetails,
  getGraphqlSubscriptionDisconnectDetails,
  getGraphqlSubscriptionSubscribeDetails,
  getGraphqlWsExtra,
  logGraphqlSubscriptionEvent,
  readGraphqlPath,
  type GraphqlContextInput,
  type GraphqlSubscriptionPrincipalLike,
  type GraphqlWsExtra,
} from "./runtime";

export type MaybePromise<T> = T | Promise<T>;

export type ServerGraphqlContext<
  TPrincipal,
  TRequest = unknown,
  TReply = unknown,
> = {
  principal: TPrincipal | null;
  reply?: TReply;
  req?: TRequest;
};

export type ServerGraphqlContextBuilderInput<
  TPrincipal,
  TRequest = unknown,
  TReply = unknown,
> = {
  extra: GraphqlWsExtra<TPrincipal>;
  principal: TPrincipal | null;
  reply?: TReply;
  req?: TRequest;
};

export type ServerGraphqlPrincipalResolver<TPrincipal> = (
  authorizationHeader: string | string[] | undefined,
) => MaybePromise<TPrincipal | null>;

export type ServerGraphqlWsAuthorizationExtractor = (
  connectionParams: Readonly<Record<string, unknown>> | null | undefined,
) => string | undefined;

export type ServerGraphqlHttpAuthorizationReader<TRequest = unknown> = (
  request: TRequest | undefined,
) => string | string[] | undefined;

export type ServerGraphqlContextBuilder<
  TPrincipal,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
> = (
  input: ServerGraphqlContextBuilderInput<TPrincipal, TRequest, TReply>,
) => MaybePromise<TContext>;

export type CreateServerGraphqlOptionsInput<
  TPrincipal extends GraphqlSubscriptionPrincipalLike,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
> = {
  buildContext?: ServerGraphqlContextBuilder<
    TPrincipal,
    TRequest,
    TReply,
    TContext
  >;
  configReader: ConfigReader;
  connectionInitWaitTimeoutMs?: number;
  createConnectionId?: () => string;
  getHttpAuthorization?: ServerGraphqlHttpAuthorizationReader<TRequest>;
  graphqlOptions?: Partial<
    Omit<ApolloDriverConfig, "context" | "driver" | "path" | "subscriptions">
  >;
  resolvePrincipalFromAuthorization: ServerGraphqlPrincipalResolver<TPrincipal>;
  subscriptionLogger?: StructuredLogger;
  wsAuthorizationExtractor?: ServerGraphqlWsAuthorizationExtractor;
};

export type ServerGraphqlModuleFactoryResult<
  TPrincipal extends GraphqlSubscriptionPrincipalLike,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
> = CreateServerGraphqlOptionsInput<TPrincipal, TRequest, TReply, TContext>;

export type CreateServerGraphqlModuleInput<
  TFactoryArgs extends unknown[],
  TPrincipal extends GraphqlSubscriptionPrincipalLike,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
> = {
  imports?: ModuleMetadata["imports"];
  inject?: InjectionToken[];
  useFactory: (
    ...args: TFactoryArgs
  ) => MaybePromise<
    ServerGraphqlModuleFactoryResult<TPrincipal, TRequest, TReply, TContext>
  >;
};

const defaultSubscriptionLogger = new Logger("GraphQLSubscriptions");

function getDefaultHttpAuthorization<TRequest>(
  request: TRequest | undefined,
): string | string[] | undefined {
  if (typeof request !== "object" || request === null) {
    return undefined;
  }

  const headers = (request as { headers?: Record<string, unknown> }).headers;
  const authorization = headers?.authorization;

  if (typeof authorization === "string") {
    return authorization;
  }

  if (
    Array.isArray(authorization) &&
    authorization.every((value) => typeof value === "string")
  ) {
    return authorization;
  }

  return undefined;
}

function buildDefaultContext<TPrincipal, TRequest, TReply>(
  input: ServerGraphqlContextBuilderInput<TPrincipal, TRequest, TReply>,
): ServerGraphqlContext<TPrincipal, TRequest, TReply> {
  return {
    principal: input.principal,
    reply: input.reply,
    req: input.req,
  };
}

export function createServerGraphqlOptions<
  TPrincipal extends GraphqlSubscriptionPrincipalLike,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
>(
  options: CreateServerGraphqlOptionsInput<
    TPrincipal,
    TRequest,
    TReply,
    TContext
  >,
): Omit<ApolloDriverConfig, "driver"> {
  const buildContext =
    options.buildContext ??
    ((input) => buildDefaultContext(input) as TContext | Promise<TContext>);
  const createConnectionId =
    options.createConnectionId ?? createGraphqlWsConnectionId;
  const getHttpAuthorization =
    options.getHttpAuthorization ?? getDefaultHttpAuthorization<TRequest>;
  const subscriptionLogger =
    options.subscriptionLogger ?? defaultSubscriptionLogger;
  const wsAuthorizationExtractor =
    options.wsAuthorizationExtractor ?? extractGraphqlWsAuthorization;

  return {
    path: readGraphqlPath(options.configReader),
    context: async (
      contextOrRequest: GraphqlContextInput<TRequest, TReply> | undefined,
      reply?: TReply,
    ): Promise<TContext> => {
      const {
        extra,
        req,
        reply: contextReply,
      } = getGraphqlContextParts(contextOrRequest, reply);
      const wsExtra = getGraphqlWsExtra<TPrincipal>(extra);
      const principal =
        wsExtra.principal ??
        (await options.resolvePrincipalFromAuthorization(
          getHttpAuthorization(req),
        ));

      return buildContext({
        extra: wsExtra,
        principal,
        reply: contextReply,
        req,
      });
    },
    subscriptions: {
      "graphql-ws": {
        connectionInitWaitTimeout:
          options.connectionInitWaitTimeoutMs ?? 15_000,
        onConnect: async (ctx) => {
          const extra = getGraphqlWsExtra<TPrincipal>(ctx.extra);
          extra.connectionId = createConnectionId();
          extra.principal = await options.resolvePrincipalFromAuthorization(
            wsAuthorizationExtractor(ctx.connectionParams),
          );

          logGraphqlSubscriptionEvent(
            subscriptionLogger,
            "graphql_subscription_connect",
            getGraphqlSubscriptionConnectDetails(extra),
          );
        },
        onDisconnect: (ctx, code, reason) => {
          const extra = getGraphqlWsExtra(ctx.extra);

          logGraphqlSubscriptionEvent(
            subscriptionLogger,
            "graphql_subscription_disconnect",
            getGraphqlSubscriptionDisconnectDetails(extra, code, reason),
          );
        },
        onSubscribe: (ctx, id, payload) => {
          const extra = getGraphqlWsExtra(ctx.extra);

          logGraphqlSubscriptionEvent(
            subscriptionLogger,
            "graphql_subscription_subscribe",
            getGraphqlSubscriptionSubscribeDetails(extra, id, payload),
          );
        },
      },
    },
    // Keep schema exploration available while projects migrate to hosted
    // production setups.
    introspection: true,
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
    playground: false,
    // Runtime boot should not own or mutate a shared generated contract file.
    autoSchemaFile: true,
    sortSchema: true,
    ...options.graphqlOptions,
  };
}

export function createServerGraphqlModule<
  TFactoryArgs extends unknown[],
  TPrincipal extends GraphqlSubscriptionPrincipalLike,
  TRequest = unknown,
  TReply = unknown,
  TContext = ServerGraphqlContext<TPrincipal, TRequest, TReply>,
>(
  options: CreateServerGraphqlModuleInput<
    TFactoryArgs,
    TPrincipal,
    TRequest,
    TReply,
    TContext
  >,
): DynamicModule {
  return GraphQLModule.forRootAsync<ApolloDriverConfig>({
    driver: ApolloDriver,
    imports: options.imports,
    inject: options.inject,
    useFactory: async (...args: TFactoryArgs) =>
      createServerGraphqlOptions(await options.useFactory(...args)),
  });
}
