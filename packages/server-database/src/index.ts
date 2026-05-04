import {
  readConfigBoolean,
  readConfigNumber,
  readConfigString,
  readRawConfigString,
  type ConfigReader,
} from "@labkit/server-config";

export const DEFAULT_POSTGRES_PORT = 5432;

export type PostgresSslConfig =
  | false
  | {
      rejectUnauthorized: boolean;
    };

export type PostgresConnectionUrlOptions = {
  databaseUrlKey?: string;
  directDatabaseUrlKey?: string;
  preferDirectUrl?: boolean;
};

export type PostgresSslConfigOptions = {
  nodeEnv?: string;
  sslKey?: string;
  sslRejectUnauthorizedKey?: string;
};

export type PostgresDiscreteConnectionDefaults = {
  database?: string;
  host?: string;
  password?: string;
  port?: number;
  username?: string;
};

export type PostgresDiscreteConnectionOptions = {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
};

export type DatabaseRuntimeFlagOptions = {
  nodeEnv?: string;
  runMigrationsOnStartKey?: string;
  synchronizeKey?: string;
};

export type DatabaseRuntimeFlags = {
  runMigrationsOnStart: boolean;
  synchronize: boolean;
};

export type DatabaseConnectionSummaryInput = {
  database?: unknown;
  host?: unknown;
  port?: unknown;
  synchronize?: boolean | null;
  url?: unknown;
};

export type DatabaseConnectionSummary = {
  connectionSource: "discrete_fields" | "url";
  database?: string | null;
  host?: string | null;
  pooledConnection?: boolean;
  port?: number;
  sslMode?: string | null;
  synchronize: boolean | null;
};

export type ServerDatabaseFeatureManifest<
  TEntity = unknown,
  TMigration = unknown,
> = {
  entities?: readonly TEntity[];
  migrations?: readonly TMigration[];
};

export type ServerDatabaseManifest<TEntity = unknown, TMigration = unknown> = {
  entities: TEntity[];
  migrations: TMigration[];
};

function appendUnique<T>(target: T[], values: readonly T[] | undefined): void {
  if (!values) {
    return;
  }

  for (const value of values) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

export function composeServerDatabaseManifests<TEntity, TMigration>(
  manifests: readonly ServerDatabaseFeatureManifest<TEntity, TMigration>[],
): ServerDatabaseManifest<TEntity, TMigration> {
  const composedManifest: ServerDatabaseManifest<TEntity, TMigration> = {
    entities: [],
    migrations: [],
  };

  for (const manifest of manifests) {
    appendUnique(composedManifest.entities, manifest.entities);
    appendUnique(composedManifest.migrations, manifest.migrations);
  }

  return composedManifest;
}

export function normalizePostgresConnectionUrl(databaseUrl: string): string {
  try {
    const parsedUrl = new URL(databaseUrl);

    if (
      parsedUrl.searchParams.get("sslmode") === "require" &&
      !parsedUrl.searchParams.has("uselibpqcompat")
    ) {
      parsedUrl.searchParams.set("sslmode", "verify-full");
      return parsedUrl.toString();
    }
  } catch {
    return databaseUrl;
  }

  return databaseUrl;
}

export function readPostgresConnectionUrl(
  configReader: ConfigReader,
  options: PostgresConnectionUrlOptions = {},
): string | undefined {
  const databaseUrlKey = options.databaseUrlKey ?? "DATABASE_URL";
  const directDatabaseUrlKey =
    options.directDatabaseUrlKey ?? "DATABASE_URL_DIRECT";

  const directDatabaseUrl = readRawConfigString(
    configReader,
    directDatabaseUrlKey,
  );
  if (options.preferDirectUrl === true && directDatabaseUrl) {
    return normalizePostgresConnectionUrl(directDatabaseUrl);
  }

  const databaseUrl = readRawConfigString(configReader, databaseUrlKey);
  return databaseUrl ? normalizePostgresConnectionUrl(databaseUrl) : undefined;
}

export function readPostgresSslConfig(
  configReader: ConfigReader,
  options: PostgresSslConfigOptions = {},
): PostgresSslConfig {
  const sslEnabled = readConfigBoolean(
    configReader,
    options.sslKey ?? "DATABASE_SSL",
    options.nodeEnv === "production",
  );

  if (!sslEnabled) {
    return false;
  }

  return {
    rejectUnauthorized: readConfigBoolean(
      configReader,
      options.sslRejectUnauthorizedKey ?? "DATABASE_SSL_REJECT_UNAUTHORIZED",
      false,
    ),
  };
}

export function readPostgresDiscreteConnectionOptions(
  configReader: ConfigReader,
  defaults: PostgresDiscreteConnectionDefaults = {},
): PostgresDiscreteConnectionOptions {
  return {
    database: readConfigString(
      configReader,
      "DATABASE_NAME",
      defaults.database ?? "chatdb",
    ),
    host: readConfigString(
      configReader,
      "DATABASE_HOST",
      defaults.host ?? "localhost",
    ),
    password:
      readRawConfigString(configReader, "DATABASE_PASSWORD") ??
      defaults.password ??
      "chatpass",
    port: readConfigNumber(
      configReader,
      "DATABASE_PORT",
      defaults.port ?? DEFAULT_POSTGRES_PORT,
    ),
    username: readConfigString(
      configReader,
      "DATABASE_USER",
      defaults.username ?? "chatuser",
    ),
  };
}

export function readDatabaseRuntimeFlags(
  configReader: ConfigReader,
  options: DatabaseRuntimeFlagOptions = {},
): DatabaseRuntimeFlags {
  return {
    runMigrationsOnStart: readConfigBoolean(
      configReader,
      options.runMigrationsOnStartKey ?? "DATABASE_RUN_MIGRATIONS_ON_START",
      false,
    ),
    synchronize: readConfigBoolean(
      configReader,
      options.synchronizeKey ?? "DATABASE_SYNCHRONIZE",
      options.nodeEnv !== "production",
    ),
  };
}

export function assertDatabaseMigrationSafety(
  flags: DatabaseRuntimeFlags,
): void {
  if (flags.synchronize && flags.runMigrationsOnStart) {
    throw new Error(
      "DATABASE_SYNCHRONIZE=true cannot be used with DATABASE_RUN_MIGRATIONS_ON_START=true",
    );
  }
}

export function summarizePostgresConnection(
  options: DatabaseConnectionSummaryInput,
  defaultPort = DEFAULT_POSTGRES_PORT,
): DatabaseConnectionSummary {
  if (typeof options.url === "string" && options.url) {
    try {
      const parsedUrl = new URL(options.url);

      return {
        connectionSource: "url",
        host: parsedUrl.hostname || null,
        port: parsedUrl.port ? Number(parsedUrl.port) : defaultPort,
        database: parsedUrl.pathname.replace(/^\/+/, "") || null,
        sslMode: parsedUrl.searchParams.get("sslmode"),
        pooledConnection: parsedUrl.hostname.includes("-pooler"),
        synchronize: options.synchronize ?? null,
      };
    } catch {
      return {
        connectionSource: "url",
        synchronize: options.synchronize ?? null,
      };
    }
  }

  return {
    connectionSource: "discrete_fields",
    host: typeof options.host === "string" ? options.host : "localhost",
    port: typeof options.port === "number" ? options.port : defaultPort,
    database: typeof options.database === "string" ? options.database : null,
    synchronize: options.synchronize ?? null,
  };
}
