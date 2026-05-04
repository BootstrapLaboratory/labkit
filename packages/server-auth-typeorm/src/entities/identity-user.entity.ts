import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { IdentityAccountEntity } from "./identity-account.entity";
import { IdentityRefreshSessionEntity } from "./identity-refresh-session.entity";
import { IdentityUserRoleEntity } from "./identity-user-role.entity";

@Entity("identity_user")
export class IdentityUserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  email?: string;

  @Column({ name: "display_name", nullable: true })
  displayName?: string;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => IdentityAccountEntity, (account) => account.user)
  accounts!: IdentityAccountEntity[];

  @OneToMany(() => IdentityUserRoleEntity, (role) => role.user)
  roles!: IdentityUserRoleEntity[];

  @OneToMany(() => IdentityRefreshSessionEntity, (session) => session.user)
  refreshSessions!: IdentityRefreshSessionEntity[];
}
