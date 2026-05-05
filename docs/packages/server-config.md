# @omgjs/labkit-server-config

Server-side configuration readers for Nest/Node applications.

## Install

```bash
npm install @omgjs/labkit-server-config
```

Runtime: server only. Package format: CommonJS.

## Public API Groups

- `ConfigReader` and `createEnvironmentConfigReader`.
- Raw, optional, required, lowercase, boolean, number, and list readers.
- `getEnvFilePaths`.
- `readRefreshTokenTransport` and `readCookieSameSite`.
- `readServerCorsOptions` and `summarizeServerCorsOrigin`.
- `readServerRuntimeOptions`.

## Owns

This package owns generic server runtime parsing. Nest `ConfigService` already
satisfies the `ConfigReader` shape.

## App Still Owns

The app owns concrete secret names beyond generic Labkit keys, config classes,
secret providers, deployment provider mapping, and direct Nest bootstrap.

## Minimal Usage

```ts
import {
  getEnvFilePaths,
  readRequiredConfigString,
  readServerCorsOptions,
  readServerRuntimeOptions,
} from "@omgjs/labkit-server-config";

ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: getEnvFilePaths(),
});

const secret = readRequiredConfigString(config, "ACCESS_TOKEN_SECRET", {
  minLength: 32,
  trim: true,
});
const cors = readServerCorsOptions(config);
const runtime = readServerRuntimeOptions(config);
```

## Runtime Notes

`readServerCorsOptions` enables credentials unless refresh tokens use
`response_body` transport. This keeps HttpOnly refresh cookies compatible with
browser requests.

Package README and source:
[`../../packages/server-config/README.md`](../../packages/server-config/README.md),
[`../../packages/server-config/src/index.ts`](../../packages/server-config/src/index.ts).
