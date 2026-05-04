export type Principal = {
  userId: string;
  subject: string;
  provider: string;
  displayName?: string | null;
  roles: readonly string[];
  permissions: readonly string[];
  sessionId?: string;
};

export type AuthPayload = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken?: string | null;
  refreshTokenExpiresAt: string;
  principal: Principal;
};

export const REFRESH_TOKEN_TRANSPORT_COOKIE = "cookie";
export const REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY = "response_body";

export type RefreshTokenTransport =
  | typeof REFRESH_TOKEN_TRANSPORT_COOKIE
  | typeof REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY;

export const GRAPHQL_WS_AUTHORIZATION_PARAM = "authorization";
export const GRAPHQL_WS_LEGACY_AUTHORIZATION_PARAM = "Authorization";
export const GRAPHQL_WS_ACCESS_TOKEN_PARAM = "accessToken";

export const AUTH_REQUIRED_ERROR_CODES = [
  "AUTH_REQUIRED",
  "UNAUTHENTICATED",
  "UNAUTHORIZED",
] as const;

export type AuthRequiredErrorCode = (typeof AUTH_REQUIRED_ERROR_CODES)[number];

export function isAuthRequiredErrorCode(
  code: string | null | undefined,
): code is AuthRequiredErrorCode {
  return AUTH_REQUIRED_ERROR_CODES.some((knownCode) => knownCode === code);
}

export function formatBearerToken(accessToken: string): string {
  return `Bearer ${accessToken}`;
}

export function extractBearerToken(
  authorizationHeader: string | string[] | null | undefined,
): string | null {
  const header = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function extractGraphqlWsAuthorization(
  connectionParams: Readonly<Record<string, unknown>> | null | undefined,
): string | undefined {
  const authorization =
    connectionParams?.[GRAPHQL_WS_AUTHORIZATION_PARAM] ??
    connectionParams?.[GRAPHQL_WS_LEGACY_AUTHORIZATION_PARAM];
  if (typeof authorization === "string") {
    return authorization;
  }

  const accessToken = connectionParams?.[GRAPHQL_WS_ACCESS_TOKEN_PARAM];
  if (typeof accessToken === "string") {
    return formatBearerToken(accessToken);
  }

  return undefined;
}
