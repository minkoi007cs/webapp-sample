import { Entity, Column, ManyToOne, JoinColumn, PrimaryGeneratedColumn, Index } from 'typeorm';
import { Group } from './group.entity';
import { Role } from './role.entity';
import { User } from './user.entity';

export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('sm_invites')
@Index(['token'], { unique: true })
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  token: string;

  @Column({ type: 'uuid' })
  groupId: string;

  get familyId(): string {
    return this.groupId;
  }
  set familyId(val: string) {
    this.groupId = val;
  }

  @ManyToOne(() => Group, (group) => group.invites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  get family(): Group {
    return this.group;
  }

  @Column()
  roleId: string;

  @ManyToOne(() => Role, (role) => role.invites)
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({
    type: 'enum',
    enum: InviteStatus,
    default: InviteStatus.PENDING,
  })
  status: InviteStatus;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'uuid', nullable: true })
  invitedByUserId: string | null;

  @ManyToOne(() => User, (user) => user.invitesSent, { nullable: true })
  @JoinColumn({ name: 'invitedByUserId' })
  invitedByUser: User | null;

  @Column({ type: 'uuid', nullable: true })
  acceptedByUserId: string | null;
}
