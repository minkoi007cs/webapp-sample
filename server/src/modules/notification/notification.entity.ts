import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../common/entities/user.entity';

@Entity('fml_notifications')
@Index(['familyId', 'userId'])
export class Notification extends BaseEntity {
  @Index()
  @Column()
  familyId: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  /** Null = immediate; future date = defer until cron picks it up. */
  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date | null;
}
