import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Group } from './group.entity';
import { User } from './user.entity';
import { Role } from './role.entity';

export enum GroupUserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  REMOVED = 'REMOVED',
}

@Entity('group_users')
@Unique(['groupId', 'userId'])
export class GroupUser extends BaseEntity {
  @Column({ type: 'uuid' })
  groupId: string;

  // Compatibility alias
  get familyId(): string {
    return this.groupId;
  }
  set familyId(val: string) {
    this.groupId = val;
  }

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  roleId: string;

  @Column({
    type: 'enum',
    enum: GroupUserStatus,
    default: GroupUserStatus.ACTIVE,
  })
  status: GroupUserStatus;

  @Column({ type: 'uuid', nullable: true })
  invitedByUserId?: string;

  @ManyToOne(() => Group, (group) => group.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  get family(): Group {
    return this.group;
  }

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Role, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roleId' })
  role: Role;
}

// Alias for compatibility
export { GroupUser as FamilyUser, GroupUserStatus as FamilyUserStatus };
