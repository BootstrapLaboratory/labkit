import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { readConfigString, type ConfigReader } from "@omgjs/labkit-server-config";
import {
  isGraphqlSubscriptionLoggingEnabled,
  logStructuredEvent,
  type StructuredLogDetails,
  type StructuredLogger,
} from "@omgjs/labkit-server-observability";

export type GraphqlWsExtra<TPrincipal = unknown> = {
  connectionId?: string;
  principal?: TPrincipal | null;
  request?: GraphqlRequestLike;
};

export type GraphqlRequestLike = {
  headers: IncomingHttpHeaders;
  socket: {
    remoteAddress?: string;
  };
  url?: string;
};

export type GraphqlContextInput<TRequest, TReply> =
  | {
      extra?: unknown;
      reply?: TReply;
      req?: TRequest;
    }
  | TRequest
  | undefined;

export type GraphqlContextParts<TRequest, TReply> = {
  extra?: unknown;
  reply?: TReply;
  req?: TRequest;
};

export type GraphqlSubscriptionPrincipalLike = {
  userId?: string | null;
};

export type GraphqlOperationPayloadLike = {
  operationName?: unknown;
};

export function readGraphqlPath(configReader: ConfigReader): string {
  return readConfigString(configReader, "GRAPHQL_PATH", "/graphql");
}

export function createGraphqlWsConnectionId(): string {
  return randomUUID();
}

export function getGraphqlWsExtra<TPrincipal = unknown>(
  extra: unknown,
): GraphqlWsExtra<TPrincipal> {
  if (typeof extra === "object" && extra !== null) {
    return extra;
  }

  return {};
}

export function getGraphqlContextParts<TRequest, TReply>(
  contextOrRequest: GraphqlContextInput<TRequest, TReply>,
  reply?: TReply,
): GraphqlContextParts<TRequest, TReply> {
  if (
    typeof contextOrRequest === "object" &&
    contextOrRequest !== null &&
    ("extra" in contextOrRequest ||
      "req" in contextOrRequest ||
      "reply" in contextOrRequest)
  ) {
    return {
      extra: contextOrRequest.extra,
      reply: contextOrRequest.reply ?? reply,
      req: contextOrRequest.req,
    };
  }

  return {
    reply,
    req: contextOrRequest as TRequest,
  };
}

export function getClientIp(
  request: GraphqlRequestLike | undefined,
): string | null {
  if (!request) {
    return null;
  }

  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0]?.split(",")[0]?.trim() ?? null;
  }

  return request.socket.remoteAddress ?? null;
}

export function logGraphqlSubscriptionEvent(
  logger: StructuredLogger,
  event: string,
  details: StructuredLogDetails,
): void {
  if (!isGraphqlSubscriptionLoggingEnabled()) {
    return;
  }

  logStructuredEvent(logger, "log", event, details);
}

export function getGraphqlSubscriptionConnectDetails(
  extra: GraphqlWsExtra<GraphqlSubscriptionPrincipalLike>,
): StructuredLogDetails {
  return {
    connectionId: extra.connectionId ?? null,
    ip: getClientIp(extra.request),
    path: extra.request?.url ?? null,
    principalUserId: extra.principal?.userId ?? null,
  };
}

export function getGraphqlSubscriptionDisconnectDetails(
  extra: GraphqlWsExtra,
  code?: unknown,
  reason?: unknown,
): StructuredLogDetails {
  return {
    connectionId: extra.connectionId ?? null,
    code: code ?? null,
    reason: reason ?? null,
  };
}

export function getGraphqlSubscriptionSubscribeDetails(
  extra: GraphqlWsExtra,
  operationId: unknown,
  payload: GraphqlOperationPayloadLike,
): StructuredLogDetails {
  return {
    connectionId: extra.connectionId ?? null,
    operationId,
    operationName:
      typeof payload.operationName === "string" ? payload.operationName : null,
  };
}
