import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { IdentityUserEntity } from "./identity-user.entity";

@Entity("identity_account")
@Unique("UQ_identity_account_provider_subject", ["provider", "subject"])
export class IdentityAccountEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "user_id" })
  userId!: number;

  @Column()
  provider!: string;

  @Column()
  subject!: string;

  @Column({ name: "password_hash", nullable: true })
  passwordHash?: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => IdentityUserEntity, (user) => user.accounts, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: IdentityUserEntity;
}
