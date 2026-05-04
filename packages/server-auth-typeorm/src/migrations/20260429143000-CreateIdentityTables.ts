import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from "typeorm";

export class CreateIdentityTables20260429143000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "identity_user",
        columns: [
          {
            name: "id",
            type: "integer",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "email",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "display_name",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "is_active",
            type: "boolean",
            default: true,
          },
          {
            name: "created_at",
            type: "timestamptz",
            default: "now()",
          },
          {
            name: "updated_at",
            type: "timestamptz",
            default: "now()",
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "identity_account",
        columns: [
          {
            name: "id",
            type: "integer",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "user_id",
            type: "integer",
            isNullable: false,
          },
          {
            name: "provider",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "subject",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "password_hash",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamptz",
            default: "now()",
          },
          {
            name: "updated_at",
            type: "timestamptz",
            default: "now()",
          },
        ],
        uniques: [
          {
            columnNames: ["provider", "subject"],
            name: "UQ_identity_account_provider_subject",
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      "identity_account",
      new TableForeignKey({
        columnNames: ["user_id"],
        referencedColumnNames: ["id"],
        referencedTableName: "identity_user",
        onDelete: "CASCADE",
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "identity_user_role",
        columns: [
          {
            name: "id",
            type: "integer",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "user_id",
            type: "integer",
            isNullable: false,
          },
          {
            name: "role",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "created_at",
            type: "timestamptz",
            default: "now()",
          },
        ],
        uniques: [
          {
            columnNames: ["user_id", "role"],
            name: "UQ_identity_user_role_user_role",
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      "identity_user_role",
      new TableForeignKey({
        columnNames: ["user_id"],
        referencedColumnNames: ["id"],
        referencedTableName: "identity_user",
        onDelete: "CASCADE",
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "identity_refresh_session",
        columns: [
          {
            name: "id",
            type: "varchar",
            isPrimary: true,
          },
          {
            name: "user_id",
            type: "integer",
            isNullable: false,
          },
          {
            name: "provider",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "provider_subject",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "token_hash",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "expires_at",
            type: "timestamptz",
            isNullable: false,
          },
          {
            name: "revoked_at",
            type: "timestamptz",
            isNullable: true,
          },
          {
            name: "replaced_by_session_id",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamptz",
            default: "now()",
          },
          {
            name: "last_used_at",
            type: "timestamptz",
            isNullable: true,
          },
        ],
        uniques: [
          {
            columnNames: ["token_hash"],
            name: "UQ_identity_refresh_session_token_hash",
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      "identity_refresh_session",
      new TableForeignKey({
        columnNames: ["user_id"],
        referencedColumnNames: ["id"],
        referencedTableName: "identity_user",
        onDelete: "CASCADE",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("identity_refresh_session");
    await queryRunner.dropTable("identity_user_role");
    await queryRunner.dropTable("identity_account");
    await queryRunner.dropTable("identity_user");
  }
}
