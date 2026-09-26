import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { FamilyUser } from './family-user.entity';
import { Invite } from './invite.entity';

export enum UserRole {
  APP_ADMIN = 'APP_ADMIN',
  FAMILY_ADMIN = 'FAMILY_ADMIN',
  MEMBER = 'MEMBER',
}

export enum SystemRole {
  USER = 'USER',
  APP_ADMIN = 'APP_ADMIN',
}

@Entity('fml_users')
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
  lastActiveFamilyId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => FamilyUser, (familyUser) => familyUser.user)
  memberships: FamilyUser[];

  @OneToMany(() => Invite, (invite) => invite.invitedByUser)
  invitesSent: Invite[];
}
