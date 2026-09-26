import { Entity, Column, ManyToOne, JoinColumn, PrimaryGeneratedColumn, Index } from 'typeorm';
import { Family } from './family.entity';
import { Role } from './role.entity';
import { User } from './user.entity';

export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('fml_invites')
@Index(['token'], { unique: true })
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  token: string;

  @Column()
  familyId: string;

  @ManyToOne(() => Family, (family) => family.invites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'familyId' })
  family: Family;

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
