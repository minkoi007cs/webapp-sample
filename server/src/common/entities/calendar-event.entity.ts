import { Entity, Column, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Group } from './group.entity';
import { User } from './user.entity';

export enum CalendarEventType {
  EVENT = 'EVENT',
  REMINDER = 'REMINDER',
  SAMPLE_REVIEW = 'SAMPLE_REVIEW',
  MEETING = 'MEETING',
}

@Entity('sm_calendar_events')
export class CalendarEvent extends BaseEntity {
  @Column({ type: 'uuid' })
  groupId: string;

  get familyId(): string {
    return this.groupId;
  }
  set familyId(val: string) {
    this.groupId = val;
  }

  @ManyToOne(() => Group)
  @JoinColumn({ name: 'groupId' })
  group: Group;

  get family(): Group {
    return this.group;
  }

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ default: false })
  isFullDay: boolean;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'int', default: 0 })
  reminderMinutes: number;

  @Column({
    type: 'enum',
    enum: CalendarEventType,
    default: CalendarEventType.EVENT,
  })
  type: CalendarEventType;

  @Column({ nullable: true })
  metadata: string;

  @Column({ nullable: true })
  recurrenceRule: string;

  @ManyToMany(() => User)
  @JoinTable({
    name: 'sm_calendar_event_participants',
    joinColumn: { name: 'calendarEventId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' }
  })
  participants: User[];

  @Column()
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;
}
