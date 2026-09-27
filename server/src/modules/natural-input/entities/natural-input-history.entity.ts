import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Group } from '../../../common/entities/group.entity';
import { User } from '../../../common/entities/user.entity';

@Entity('sm_natural_input_history')
export class NaturalInputHistory extends BaseEntity {
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

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text' })
  inputMessage: string;

  @Column({ nullable: true })
  intent: string;

  @Column({ type: 'float', nullable: true })
  confidence: number;

  @Column({ type: 'jsonb', nullable: true })
  resultData: any;
}
