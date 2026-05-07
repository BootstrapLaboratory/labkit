import { Module, type Provider } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import {
  SERVER_AUTH_IDENTITY_ACCOUNT_REPOSITORY,
  SERVER_AUTH_REFRESH_SESSION_REPOSITORY,
  SERVER_AUTH_ROLE_REPOSITORY,
  SERVER_AUTH_TRANSACTION_RUNNER,
  type ServerAuthCreateIdentityAccountInput,
  type ServerAuthCreateRefreshSessionInput,
  type ServerAuthIdentityAccountRecord,
  type ServerAuthIdentityAccountRepository,
  type ServerAuthPersistenceRepositories,
  type ServerAuthRefreshSessionRecord,
  type ServerAuthRefreshSessionRepository,
  type ServerAuthRevokeActiveRefreshSessionsForUserInput,
  type ServerAuthRevokeRefreshSessionInput,
  type ServerAuthRoleRepository,
  type ServerAuthRotateRefreshSessionInput,
  type ServerAuthTransactionRunner,
  type ServerAuthUserRecord,
} from "@omgjs/labkit-server-auth";
import type { ServerDatabaseFeatureManifest } from "@omgjs/labkit-server-database";
import { DataSource, EntityManager, IsNull, Repository } from "typeorm";
import { IdentityAccountEntity } from "./entities/identity-account.entity";
import { IdentityRefreshSessionEntity } from "./entities/identity-refresh-session.entity";
import { IdentityUserRoleEntity } from "./entities/identity-user-role.entity";
import { IdentityUserEntity } from "./entities/identity-user.entity";
import { CreateIdentityTables20260429143000 } from "./migrations/20260429143000-CreateIdentityTables";

export const SERVER_AUTH_TYPEORM_PACKAGE_NAME =
  "@omgjs/labkit-server-auth-typeorm";

export {
  CreateIdentityTables20260429143000,
  IdentityAccountEntity,
  IdentityRefreshSessionEntity,
  IdentityUserEntity,
  IdentityUserRoleEntity,
};

export const SERVER_AUTH_TYPEORM_ENTITIES = [
  IdentityAccountEntity,
  IdentityRefreshSessionEntity,
  IdentityUserEntity,
  IdentityUserRoleEntity,
] as const;
export const SERVER_AUTH_TYPEORM_MIGRATIONS = [
  CreateIdentityTables20260429143000,
] as const;

export const serverAuthTypeormDatabaseManifest = {
  entities: SERVER_AUTH_TYPEORM_ENTITIES,
  migrations: SERVER_AUTH_TYPEORM_MIGRATIONS,
} satisfies ServerDatabaseFeatureManifest;

export type ServerAuthTypeormDatabaseManifest =
  typeof serverAuthTypeormDatabaseManifest;

export type ServerAuthTypeormRepositoryAdapters =
  ServerAuthPersistenceRepositories;

export class TypeormServerAuthIdentityAccountRepository implements ServerAuthIdentityAccountRepository {
  constructor(
    private readonly accountRepository: Repository<IdentityAccountEntity>,
    private readonly userRepository: Repository<IdentityUserEntity>,
    private readonly roleRepository: Repository<IdentityUserRoleEntity>,
    private readonly wrapWritesInTransaction = true,
  ) {}

  async createIdentityAccount(
    input: ServerAuthCreateIdentityAccountInput,
  ): Promise<ServerAuthIdentityAccountRecord> {
    const createAccount = async (manager: EntityManager) => {
      const userRepository = manager.getRepository(IdentityUserEntity);
      const accountRepository = manager.getRepository(IdentityAccountEntity);
      const roleRepository = manager.getRepository(IdentityUserRoleEntity);

      const user = await userRepository.save(
        userRepository.create({
          displayName: input.displayName,
          email: input.email,
          isActive: true,
        }),
      );

      const account = await accountRepository.save(
        accountRepository.create({
          passwordHash: input.passwordHash,
          provider: input.provider,
          subject: input.subject,
          user,
          userId: user.id,
        }),
      );

      if (input.roles.length > 0) {
        await roleRepository.save(
          input.roles.map((role) =>
            roleRepository.create({
              role,
              user,
              userId: user.id,
            }),
          ),
        );
      }

      account.user = user;
      return toIdentityAccountRecord(account);
    };

    if (!this.wrapWritesInTransaction) {
      return createAccount(this.userRepository.manager);
    }

    return this.userRepository.manager.transaction(createAccount);
  }

  async findIdentityAccountByProviderSubject(
    provider: string,
    subject: string,
  ): Promise<ServerAuthIdentityAccountRecord | null> {
    const account = await this.accountRepository.findOne({
      relations: {
        user: true,
      },
      where: {
        provider,
        subject,
      },
    });

    return account ? toIdentityAccountRecord(account) : null;
  }
}

export class TypeormServerAuthRoleRepository implements ServerAuthRoleRepository {
  constructor(
    private readonly roleRepository: Repository<IdentityUserRoleEntity>,
  ) {}

  async findRolesByUserId(userId: string): Promise<string[]> {
    const roles = await this.roleRepository.findBy({
      userId: toTypeormUserId(userId),
    });

    return roles.map((role) => role.role);
  }
}

export class TypeormServerAuthRefreshSessionRepository implements ServerAuthRefreshSessionRepository {
  constructor(
    private readonly refreshSessionRepository: Repository<IdentityRefreshSessionEntity>,
  ) {}

  async createRefreshSession(
    input: ServerAuthCreateRefreshSessionInput,
  ): Promise<ServerAuthRefreshSessionRecord> {
    const session = await this.refreshSessionRepository.save(
      this.refreshSessionRepository.create({
        expiresAt: input.expiresAt,
        id: input.id,
        provider: input.provider,
        providerSubject: input.providerSubject,
        tokenHash: input.tokenHash,
        userId: toTypeormUserId(input.userId),
      }),
    );

    return toRefreshSessionRecord(session);
  }

  async findRefreshSessionByTokenHash(
    tokenHash: string,
  ): Promise<ServerAuthRefreshSessionRecord | null> {
    const session = await this.refreshSessionRepository.findOne({
      relations: {
        user: true,
      },
      where: {
        tokenHash,
      },
    });

    return session ? toRefreshSessionRecord(session) : null;
  }

  async revokeActiveRefreshSessionsForUser(
    input: ServerAuthRevokeActiveRefreshSessionsForUserInput,
  ): Promise<void> {
    await this.refreshSessionRepository.update(
      {
        revokedAt: IsNull(),
        userId: toTypeormUserId(input.userId),
      },
      {
        revokedAt: input.revokedAt,
      },
    );
  }

  async revokeRefreshSession(
    input: ServerAuthRevokeRefreshSessionInput,
  ): Promise<boolean> {
    const session = await this.refreshSessionRepository.findOneBy(
      "tokenHash" in input
        ? { tokenHash: input.tokenHash }
        : { id: input.sessionId },
    );

    if (!session || session.revokedAt) {
      return false;
    }

    session.revokedAt = input.revokedAt;
    await this.refreshSessionRepository.save(session);
    return true;
  }

  async rotateRefreshSession(
    input: ServerAuthRotateRefreshSessionInput,
  ): Promise<void> {
    await this.refreshSessionRepository.update(
      {
        id: input.sessionId,
      },
      {
        lastUsedAt: input.lastUsedAt,
        replacedBySessionId: input.replacedBySessionId,
        revokedAt: input.revokedAt,
      },
    );
  }
}

export class TypeormServerAuthTransactionRunner implements ServerAuthTransactionRunner {
  constructor(private readonly dataSource: DataSource) {}

  runInTransaction<TResult>(
    operation: (
      repositories: ServerAuthTypeormRepositoryAdapters,
    ) => TResult | Promise<TResult>,
  ): Promise<TResult> {
    return this.dataSource.transaction(async (manager) =>
      operation(createServerAuthTypeormRepositories(manager)),
    );
  }
}

export function createServerAuthTypeormRepositories(
  manager: EntityManager,
): ServerAuthTypeormRepositoryAdapters {
  return {
    identityAccounts: new TypeormServerAuthIdentityAccountRepository(
      manager.getRepository(IdentityAccountEntity),
      manager.getRepository(IdentityUserEntity),
      manager.getRepository(IdentityUserRoleEntity),
      false,
    ),
    refreshSessions: new TypeormServerAuthRefreshSessionRepository(
      manager.getRepository(IdentityRefreshSessionEntity),
    ),
    roles: new TypeormServerAuthRoleRepository(
      manager.getRepository(IdentityUserRoleEntity),
    ),
  };
}

export function createServerAuthTypeormRepositoryProviders(): Provider[] {
  return [
    {
      provide: TypeormServerAuthIdentityAccountRepository,
      useFactory: (dataSource: DataSource) =>
        new TypeormServerAuthIdentityAccountRepository(
          dataSource.getRepository(IdentityAccountEntity),
          dataSource.getRepository(IdentityUserEntity),
          dataSource.getRepository(IdentityUserRoleEntity),
        ),
      inject: [getDataSourceToken()],
    },
    {
      provide: SERVER_AUTH_IDENTITY_ACCOUNT_REPOSITORY,
      useExisting: TypeormServerAuthIdentityAccountRepository,
    },
    {
      provide: TypeormServerAuthRoleRepository,
      useFactory: (dataSource: DataSource) =>
        new TypeormServerAuthRoleRepository(
          dataSource.getRepository(IdentityUserRoleEntity),
        ),
      inject: [getDataSourceToken()],
    },
    {
      provide: SERVER_AUTH_ROLE_REPOSITORY,
      useExisting: TypeormServerAuthRoleRepository,
    },
    {
      provide: TypeormServerAuthRefreshSessionRepository,
      useFactory: (dataSource: DataSource) =>
        new TypeormServerAuthRefreshSessionRepository(
          dataSource.getRepository(IdentityRefreshSessionEntity),
        ),
      inject: [getDataSourceToken()],
    },
    {
      provide: SERVER_AUTH_REFRESH_SESSION_REPOSITORY,
      useExisting: TypeormServerAuthRefreshSessionRepository,
    },
    {
      provide: TypeormServerAuthTransactionRunner,
      useFactory: (dataSource: DataSource) =>
        new TypeormServerAuthTransactionRunner(dataSource),
      inject: [getDataSourceToken()],
    },
    {
      provide: SERVER_AUTH_TRANSACTION_RUNNER,
      useExisting: TypeormServerAuthTransactionRunner,
    },
  ];
}

export const SERVER_AUTH_TYPEORM_REPOSITORY_EXPORTS = [
  TypeormServerAuthIdentityAccountRepository,
  SERVER_AUTH_IDENTITY_ACCOUNT_REPOSITORY,
  TypeormServerAuthRoleRepository,
  SERVER_AUTH_ROLE_REPOSITORY,
  TypeormServerAuthRefreshSessionRepository,
  SERVER_AUTH_REFRESH_SESSION_REPOSITORY,
  TypeormServerAuthTransactionRunner,
  SERVER_AUTH_TRANSACTION_RUNNER,
] as const;

@Module({
  providers: [...createServerAuthTypeormRepositoryProviders()],
  exports: [...SERVER_AUTH_TYPEORM_REPOSITORY_EXPORTS],
})
export class ServerAuthTypeormModule {}

function toIdentityAccountRecord(
  account: IdentityAccountEntity,
): ServerAuthIdentityAccountRecord {
  return {
    passwordHash: account.passwordHash ?? null,
    provider: account.provider,
    subject: account.subject,
    user: toUserRecord(account.user),
    userId: String(account.userId),
  };
}

function toRefreshSessionRecord(
  session: IdentityRefreshSessionEntity,
): ServerAuthRefreshSessionRecord {
  return {
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    id: session.id,
    lastUsedAt: session.lastUsedAt ?? null,
    provider: session.provider,
    providerSubject: session.providerSubject,
    replacedBySessionId: session.replacedBySessionId ?? null,
    revokedAt: session.revokedAt ?? null,
    tokenHash: session.tokenHash,
    user: session.user ? toUserRecord(session.user) : null,
    userId: String(session.userId),
  };
}

function toUserRecord(user: IdentityUserEntity): ServerAuthUserRecord {
  return {
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    isActive: user.isActive,
    userId: String(user.id),
  };
}

function toTypeormUserId(userId: string): number {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId)) {
    throw new Error("TypeORM auth adapter requires numeric user ids");
  }

  return numericUserId;
}
