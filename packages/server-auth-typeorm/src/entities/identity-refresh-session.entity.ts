import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from "typeorm";
import { IdentityUserEntity } from "./identity-user.entity";

@Entity("identity_refresh_session")
@Unique("UQ_identity_refresh_session_token_hash", ["tokenHash"])
export class IdentityRefreshSessionEntity {
  @PrimaryColumn()
  id!: string;

  @Column({ name: "user_id" })
  userId!: number;

  @Column()
  provider!: string;

  @Column({ name: "provider_subject" })
  providerSubject!: string;

  @Column({ name: "token_hash" })
  tokenHash!: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({ name: "revoked_at", nullable: true, type: "timestamptz" })
  revokedAt?: Date;

  @Column({ name: "replaced_by_session_id", nullable: true })
  replacedBySessionId?: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "last_used_at", nullable: true, type: "timestamptz" })
  lastUsedAt?: Date;

  @ManyToOne(() => IdentityUserEntity, (user) => user.refreshSessions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: IdentityUserEntity;
}
