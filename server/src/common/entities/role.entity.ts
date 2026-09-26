import { Entity, Column, PrimaryGeneratedColumn, OneToMany, Index } from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { FamilyUser } from './family-user.entity';
import { Invite } from './invite.entity';

export enum RoleScope {
  SYSTEM = 'SYSTEM',
  FAMILY = 'FAMILY',
}

@Entity('fml_roles')
@Index(['code'], { unique: true })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: RoleScope,
    default: RoleScope.FAMILY,
  })
  scope: RoleScope;

  @Column({ default: true })
  isTemplate: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions: RolePermission[];

  @OneToMany(() => FamilyUser, (familyUser) => familyUser.role)
  familyUsers: FamilyUser[];

  @OneToMany(() => Invite, (invite) => invite.role)
  invites: Invite[];
}
