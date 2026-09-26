import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { GroupUser } from './group-user.entity';
import { Invite } from './invite.entity';

export enum UserRole {
  APP_ADMIN = 'APP_ADMIN',
  GROUP_ADMIN = 'GROUP_ADMIN',
  FAMILY_ADMIN = 'GROUP_ADMIN', // Alias for backwards-compat
  MEMBER = 'MEMBER',
}

export enum SystemRole {
  USER = 'USER',
  APP_ADMIN = 'APP_ADMIN',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ type: 'text', nullable: true, comment: 'Comma-separated aliases' })
  otherNames: string;

  @Column({ nullable: true })
  googleId: string;

  @Column({
    type: 'enum',
    enum: SystemRole,
    default: SystemRole.USER,
  })
  systemRole: SystemRole;

  @Column({ type: 'uuid', nullable: true })
  lastActiveGroupId: string | null;

  get lastActiveFamilyId(): string | null {
    return this.lastActiveGroupId;
  }
  set lastActiveFamilyId(val: string | null) {
    this.lastActiveGroupId = val;
  }

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => GroupUser, (groupUser) => groupUser.user)
  memberships: GroupUser[];

  @OneToMany(() => Invite, (invite) => invite.invitedByUser)
  invitesSent: Invite[];
}
