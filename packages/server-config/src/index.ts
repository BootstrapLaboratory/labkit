import {
  REFRESH_TOKEN_TRANSPORT_COOKIE,
  REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY,
  type RefreshTokenTransport,
} from "@labkit/auth-contract";
import { parseBoolean, parseList, parseNumber } from "@labkit/runtime-config";

export type { RefreshTokenTransport } from "@labkit/auth-contract";

export type ConfigReader = {
  get<T = string>(key: string): T | undefined;
};

export type EnvironmentSource = Record<string, string | undefined>;

export type RequiredConfigStringOptions = {
  message?: string;
  minLength?: number;
  trim?: boolean;
};

export type CookieSameSite = "strict" | "lax" | "none";

export type ServerCorsOrigin = true | string[];

export type ServerCorsOptions = {
  credentials: boolean;
  origin: ServerCorsOrigin;
};

export type ServerRuntimeOptions = {
  graphqlPath: string;
  host: string;
  port: number;
  pubsubDriver: string;
};

export function createEnvironmentConfigReader(
  env: EnvironmentSource,
): ConfigReader {
  return {
    get: <T = string>(key: string) => env[key] as T | undefined,
  };
}

export function readRawConfigString(
  configReader: ConfigReader,
  key: string,
): string | undefined {
  const value = configReader.get<unknown>(key);
  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return undefined;
}

export function readConfigString(
  configReader: ConfigReader,
  key: string,
): string | undefined;
export function readConfigString(
  configReader: ConfigReader,
  key: string,
  fallback: string,
): string;
export function readConfigString(
  configReader: ConfigReader,
  key: string,
  fallback?: string,
): string | undefined {
  const value = readRawConfigString(configReader, key)?.trim();
  return value || fallback;
}

export function readRequiredConfigString(
  configReader: ConfigReader,
  key: string,
  options: RequiredConfigStringOptions = {},
): string {
  const rawValue = readRawConfigString(configReader, key);
  const value = options.trim === true ? rawValue?.trim() : rawValue;

  if (
    !value ||
    (options.minLength !== undefined && value.length < options.minLength)
  ) {
    throw new Error(
      options.message ??
        `${key} must be configured${
          options.minLength === undefined
            ? ""
            : ` with at least ${options.minLength} characters`
        }`,
    );
  }

  return value;
}

export function readConfigBoolean(
  configReader: ConfigReader,
  key: string,
  fallback: boolean,
): boolean {
  return parseBoolean(readRawConfigString(configReader, key), fallback);
}

export function readConfigNumber(
  configReader: ConfigReader,
  key: string,
  fallback: number,
): number {
  return parseNumber(readRawConfigString(configReader, key), fallback);
}

export function readConfigList(
  configReader: ConfigReader,
  key: string,
): string[] {
  return parseList(readRawConfigString(configReader, key));
}

export function readConfigLowercaseString(
  configReader: ConfigReader,
  key: string,
): string | undefined;
export function readConfigLowercaseString(
  configReader: ConfigReader,
  key: string,
  fallback: string,
): string;
export function readConfigLowercaseString(
  configReader: ConfigReader,
  key: string,
  fallback?: string,
): string | undefined {
  const value =
    fallback === undefined
      ? readConfigString(configReader, key)
      : readConfigString(configReader, key, fallback);

  return value?.toLowerCase();
}

export function getEnvFilePaths(nodeEnv = process.env.NODE_ENV): string[] {
  return [`.env.${nodeEnv ?? "development"}`, ".env"];
}

export function readRefreshTokenTransport(
  configReader: ConfigReader,
): RefreshTokenTransport {
  return readConfigLowercaseString(
    configReader,
    "AUTH_REFRESH_TOKEN_TRANSPORT",
  ) === REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY
    ? REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY
    : REFRESH_TOKEN_TRANSPORT_COOKIE;
}

export function readCookieSameSite(
  configReader: ConfigReader,
  key: string,
  fallback: CookieSameSite = "lax",
): CookieSameSite {
  const sameSite = readConfigLowercaseString(configReader, key);

  if (sameSite === "strict" || sameSite === "none" || sameSite === "lax") {
    return sameSite;
  }

  return fallback;
}

export function readServerCorsOptions(
  configReader: ConfigReader,
): ServerCorsOptions {
  const corsOrigins = readConfigList(configReader, "CORS_ORIGIN");
  const origin =
    corsOrigins.length === 0 || corsOrigins.includes("*") ? true : corsOrigins;

  return {
    credentials:
      readRefreshTokenTransport(configReader) !==
      REFRESH_TOKEN_TRANSPORT_RESPONSE_BODY,
    origin,
  };
}

export function summarizeServerCorsOrigin(
  origin: ServerCorsOrigin,
): "*" | string[] {
  return origin === true ? "*" : origin;
}

export function readServerRuntimeOptions(
  configReader: ConfigReader,
): ServerRuntimeOptions {
  return {
    graphqlPath: readConfigString(configReader, "GRAPHQL_PATH", "/graphql"),
    host: readConfigString(configReader, "HOST", "0.0.0.0"),
    port: readConfigNumber(configReader, "PORT", 3000),
    pubsubDriver: readConfigLowercaseString(
      configReader,
      "PUBSUB_DRIVER",
      "memory",
    ),
  };
}
