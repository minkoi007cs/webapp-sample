import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { GroupUser } from './group-user.entity';
import { Invite } from './invite.entity';

export enum GroupStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('sm_groups')
export class Group extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: GroupStatus,
    default: GroupStatus.ACTIVE,
  })
  status: GroupStatus;

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, any>;

  @OneToMany(() => GroupUser, (gu) => gu.group)
  members: GroupUser[];

  @OneToMany(() => Invite, (invite) => invite.group)
  invites: Invite[];
}

// Alias for compatibility
export { Group as Family, GroupStatus as FamilyStatus };
