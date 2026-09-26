import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Family } from '../../../common/entities/family.entity';
import { User } from '../../../common/entities/user.entity';

@Entity('fml_natural_input_history')
export class NaturalInputHistory extends BaseEntity {
  @Column()
  familyId: string;

  @ManyToOne(() => Family)
  @JoinColumn({ name: 'familyId' })
  family: Family;

  @Column()
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
