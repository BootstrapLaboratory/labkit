# Configuration

Labkit configuration helpers read values from small interfaces. They do not
own a secrets provider, deployment platform, or app-specific config class.

## Shared Parsing

`@omgjs/labkit-runtime-config` parses primitive strings:

```ts
parseBoolean("true", false);
parseNumber("3000", 8080);
parseFiniteNumber("15000", 30000, { min: 0 });
parseList("http://localhost:5173,https://app.example.com");
```

These helpers accept values passed into them. They do not read `process.env`
or `import.meta.env` directly.

## Server Reader

`@omgjs/labkit-server-config` defines a `ConfigReader` compatible with Nest
`ConfigService`:

```ts
type ConfigReader = {
  get<T = string>(key: string): T | undefined;
};
```

Use `createEnvironmentConfigReader(process.env)` outside Nest, or pass
`ConfigService` inside a Nest app.

## Common Server Keys

| Key                             | Used by                           | Default    |
| ------------------------------- | --------------------------------- | ---------- |
| `HOST`                          | `readServerRuntimeOptions`        | `0.0.0.0`  |
| `PORT`                          | `readServerRuntimeOptions`        | `3000`     |
| `GRAPHQL_PATH`                  | server GraphQL helpers            | `/graphql` |
| `PUBSUB_DRIVER`                 | app runtime selection             | `memory`   |
| `CORS_ORIGIN`                   | `readServerCorsOptions`           | `*`        |
| `AUTH_REFRESH_TOKEN_TRANSPORT`  | server/browser auth alignment     | `cookie`   |
| `AUTH_REFRESH_COOKIE_NAME`      | app config reader for server auth | app-owned  |
| `AUTH_REFRESH_COOKIE_PATH`      | app config reader for server auth | app-owned  |
| `AUTH_REFRESH_COOKIE_SAME_SITE` | app config reader for server auth | app-owned  |
| `AUTH_REFRESH_COOKIE_SECURE`    | app config reader for server auth | app-owned  |

`readServerCorsOptions` enables credentials automatically unless refresh tokens
are transported in the response body.

## Browser Build Values

The browser should keep endpoint resolution app-owned. A common Vite shape:

```ts
const HTTP_CONFIG = import.meta.env.VITE_GRAPHQL_HTTP!;
const WS_CONFIG = import.meta.env.VITE_GRAPHQL_WS!;
```

Use `@omgjs/labkit-webapp-build-config` in `vite.config.ts` to fail production
builds when required endpoint variables are missing.

## Runtime Rule

Configuration docs belong with the runtime they affect. Labkit docs should
explain which values change auth, GraphQL, database, and browser behavior.
Provider-specific deployment setup belongs to the application or Rush Delivery
documentation.
