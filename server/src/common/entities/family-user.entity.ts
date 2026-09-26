import { Entity, ManyToOne, JoinColumn, Column, Index } from 'typeorm';
import { Family } from './family.entity';
import { User } from './user.entity';
import { Role } from './role.entity';
import { BaseEntity } from './base.entity';

export enum FamilyUserStatus {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  REMOVED = 'REMOVED',
}

@Entity('fml_family_users')
@Index(['familyId', 'userId'], { unique: true })
export class FamilyUser extends BaseEntity {
  @Column()
  familyId: string;

  @ManyToOne(() => Family, (family) => family.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'familyId' })
  family: Family;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  roleId: string;

  @ManyToOne(() => Role, (role) => role.familyUsers)
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({
    type: 'enum',
    enum: FamilyUserStatus,
    default: FamilyUserStatus.ACTIVE,
  })
  status: FamilyUserStatus;

  @Column({ type: 'uuid', nullable: true })
  invitedByUserId: string | null;
}
