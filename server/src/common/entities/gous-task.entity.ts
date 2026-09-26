import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { GoUsCase } from './gous-case.entity';
import { GoUsStage, TaskPriority, TaskStatus } from '../enums/gous.enums';

export { TaskPriority, TaskStatus };

@Entity('gous_tasks')
export class GoUsTask extends BaseEntity {
  @Column()
  caseId: string;

  @ManyToOne(() => GoUsCase, (gCase) => gCase.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case: GoUsCase;

  @Column({
    type: 'enum',
    enum: GoUsStage,
    default: GoUsStage.NVC_CASE_CREATION,
  })
  stage: GoUsStage;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @Column({ type: 'date', nullable: true })
  dueDate: string;

  @Column({ nullable: true })
  assignedTo: string; // Tên người phụ trách trong gia đình

  @Column({ type: 'boolean', default: false })
  isSystemSuggested: boolean; // Gợi ý mặc định từ chuyên gia

  @Column({ type: 'text', nullable: true })
  expertTips: string; // Lời khuyên của chuyên viên / luật sư
}
