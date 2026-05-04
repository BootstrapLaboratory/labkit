import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { IdentityUserEntity } from "./identity-user.entity";

@Entity("identity_user_role")
@Unique("UQ_identity_user_role_user_role", ["userId", "role"])
export class IdentityUserRoleEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "user_id" })
  userId!: number;

  @Column()
  role!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => IdentityUserEntity, (user) => user.roles, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: IdentityUserEntity;
}
