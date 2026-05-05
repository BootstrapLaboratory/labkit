# @omgjs/labkit-server-config

`@omgjs/labkit-server-config` contains server-side configuration helpers and typed
readers. It adapts generic parsing from `@omgjs/labkit-runtime-config` to server
configuration sources.

## Owns

- `ConfigReader` and environment-backed config readers.
- Raw, optional, required, lowercase, boolean, number, and list readers.
- `.env` file path selection for local/test/production modes.
- Refresh-token transport config parsing.
- Cookie SameSite parsing.
- CORS option parsing and summaries.
- Server host, port, GraphQL path, and health path runtime options.

## Does Not Own

- Direct Nest application bootstrap.
- Product-specific environment variable names beyond generic helper inputs.
- Secrets management providers.
- Deployment provider mapping.

## Usage

```ts
import {
  getEnvFilePaths,
  readRequiredConfigString,
  readServerCorsOptions,
} from "@omgjs/labkit-server-config";

ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: getEnvFilePaths(),
});

const jwtSecret = readRequiredConfigString(
  configService,
  "ACCESS_TOKEN_SECRET",
);
const cors = readServerCorsOptions(configService);
```

Apps can use Nest's `ConfigService` directly because it satisfies the
`ConfigReader` shape.

## Release Channel

This package is published on npm as part of the Labkit release train. Patch
releases may include documentation-only clarifications, so consumers can update
within the same minor line without expecting runtime API changes.

## Package Format

This is a server-only CommonJS package.
