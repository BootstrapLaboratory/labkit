---
title: "Auth"
sidebar_label: "Auth"
description: "Server auth adapters and TypeORM persistence."
---

Add Labkit server auth with the TypeORM persistence adapter. The app still owns
the GraphQL DTOs, token signing service, password hasher, and resolver names.

## `server/src/identity/identity-config.service.ts`

```ts
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  readConfigNumber,
  readCookieSameSite,
  readRefreshTokenTransport,
  readRequiredConfigString,
} from "@omgjs/labkit-server-config";
import type {
  IdentityProviderRegistryConfig,
  ServerAuthLocalIdentityProviderConfigReader,
  ServerAuthRefreshCookieSameSite,
  ServerAuthRefreshTokenTransportConfigReader,
} from "@omgjs/labkit-server-auth";

@Injectable()
export class IdentityConfigService
  implements
    IdentityProviderRegistryConfig,
    ServerAuthLocalIdentityProviderConfigReader,
    ServerAuthRefreshTokenTransportConfigReader
{
  constructor(private readonly config: ConfigService) {}

  getAccessTokenSecret(): string {
    return readRequiredConfigString(this.config, "ACCESS_TOKEN_SECRET", {
      minLength: 32,
      trim: true,
    });
  }

  getAccessTokenTtlSeconds(): number {
    return readConfigNumber(this.config, "ACCESS_TOKEN_TTL_SECONDS", 900);
  }

  getRefreshTokenTtlSeconds(): number {
    return readConfigNumber(this.config, "AUTH_REFRESH_TOKEN_TTL_SECONDS", 2592000);
  }

  getRefreshCookieName(): string {
    return "__Host-labkit_refresh";
  }

  getRefreshCookiePath(): string {
    return "/graphql";
  }

  getRefreshCookieSameSite(): ServerAuthRefreshCookieSameSite {
    return readCookieSameSite(this.config, "AUTH_REFRESH_COOKIE_SAME_SITE", "lax");
  }

  isRefreshCookieSecure(): boolean {
    return process.env.NODE_ENV === "production";
  }

  getRefreshTokenTransport() {
    return readRefreshTokenTransport(this.config);
  }

  getDefaultLoginProvider(): string {
    return "local";
  }

  getRegistrationProvider(): string {
    return "local";
  }

  getDefaultRole(): string {
    return "user";
  }
}
```

## `server/src/identity/password.service.ts`

```ts
import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { ServerAuthPasswordHasher } from "@omgjs/labkit-server-auth";

const scrypt = promisify(scryptCallback);

@Injectable()
export class PasswordService implements ServerAuthPasswordHasher {
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("base64url");
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${derived.toString("base64url")}`;
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    const [, salt, encoded] = hash.split(":");
    if (!salt || !encoded) return false;
    const expected = Buffer.from(encoded, "base64url");
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
```

## `server/src/identity/token.service.ts`

```ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { sign, verify } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import {
  createServerAuthAccessTokenClaims,
  createServerAuthPrincipalFromAccessTokenPayload,
  getServerAuthAccessTokenExpiresAt,
  getServerAuthAccessTokenExpiresInSeconds,
  type Principal,
  type ServerAuthAccessTokenService,
} from "@omgjs/labkit-server-auth";
import { IdentityConfigService } from "./identity-config.service";

@Injectable()
export class AccessTokenService implements ServerAuthAccessTokenService {
  constructor(private readonly config: IdentityConfigService) {}

  getAccessTokenExpiresAt(now = new Date()): Date {
    return getServerAuthAccessTokenExpiresAt(
      this.config.getAccessTokenTtlSeconds(),
      now,
    );
  }

  async issueAccessToken(
    principal: Principal,
    sessionId: string,
    expiresAt: Date,
  ): Promise<string> {
    return sign(
      createServerAuthAccessTokenClaims(principal, sessionId),
      this.config.getAccessTokenSecret(),
      {
        algorithm: "HS256",
        expiresIn: getServerAuthAccessTokenExpiresInSeconds(expiresAt),
        jwtid: randomUUID(),
        subject: principal.userId,
      },
    );
  }

  async verifyAccessToken(accessToken: string): Promise<Principal> {
    const payload = verify(accessToken, this.config.getAccessTokenSecret(), {
      algorithms: ["HS256"],
    });
    if (typeof payload === "string") {
      throw new UnauthorizedException("Invalid access token");
    }
    const principal = createServerAuthPrincipalFromAccessTokenPayload(payload);
    if (!principal) {
      throw new UnauthorizedException("Invalid access token claims");
    }
    return principal;
  }
}
```

Install the JWT package:

```bash
npm install -w server jsonwebtoken
npm install -w server -D @types/jsonwebtoken
```

## `server/src/identity/identity.module.ts`

```ts
import { Module } from "@nestjs/common";
import {
  createIdentityProviderRegistryConfigProvider,
  createServerAuthLocalIdentityProviderProvider,
  createServerAuthRefreshTokenTransportProvider,
  IDENTITY_PROVIDERS,
  IdentityProviderRegistry,
  ServerAuthLocalIdentityProvider,
} from "@omgjs/labkit-server-auth";
import { ServerAuthTypeormModule } from "@omgjs/labkit-server-auth-typeorm";
import { AccessTokenService } from "./token.service";
import { IdentityConfigService } from "./identity-config.service";
import { PasswordService } from "./password.service";

@Module({
  imports: [ServerAuthTypeormModule],
  providers: [
    AccessTokenService,
    IdentityConfigService,
    PasswordService,
    createIdentityProviderRegistryConfigProvider(IdentityConfigService),
    createServerAuthLocalIdentityProviderProvider({
      configReaderToken: IdentityConfigService,
      passwordHasherToken: PasswordService,
    }),
    createServerAuthRefreshTokenTransportProvider({
      configReaderToken: IdentityConfigService,
    }),
    IdentityProviderRegistry,
    {
      provide: IDENTITY_PROVIDERS,
      useFactory: (local: ServerAuthLocalIdentityProvider) => [local],
      inject: [ServerAuthLocalIdentityProvider],
    },
  ],
  exports: [AccessTokenService, IdentityConfigService],
})
export class IdentityModule {}
```

Then switch `AppModule` from `createServerGraphqlModule` to
`createServerAuthAccessTokenGraphqlModule` and import `IdentityModule`.

```ts
createServerAuthAccessTokenGraphqlModule({
  imports: [IdentityModule],
  accessTokenServiceToken: AccessTokenService,
  configReaderToken: ConfigService,
});
```

## Auth Env

```dotenv
ACCESS_TOKEN_SECRET=replace-this-with-at-least-32-characters
ACCESS_TOKEN_TTL_SECONDS=900
AUTH_REFRESH_TOKEN_TTL_SECONDS=2592000
AUTH_REFRESH_TOKEN_TRANSPORT=cookie
AUTH_REFRESH_COOKIE_SAME_SITE=lax
```

The resolver that exposes `login`, `register`, `refresh`, and `logout` remains
app-owned because GraphQL field names and DTO classes are part of your product
contract.
