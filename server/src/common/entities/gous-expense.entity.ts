import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { GoUsCase } from './gous-case.entity';
import { ExpenseCategory, ExpensePaymentStatus } from '../enums/gous.enums';

@Entity('sm_gous_expenses')
export class GoUsExpense extends BaseEntity {
  @Column({ type: 'uuid' })
  caseId: string;

  @ManyToOne(() => GoUsCase, (gCase) => gCase.expenses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case: GoUsCase;

  @Column({
    type: 'enum',
    enum: ExpenseCategory,
    default: ExpenseCategory.NVC_GOVERNMENT_FEE,
  })
  category: ExpenseCategory;

  @Column()
  title: string;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  estimatedAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  actualAmount: number;

  @Column({
    type: 'enum',
    enum: ExpensePaymentStatus,
    default: ExpensePaymentStatus.ESTIMATED,
  })
  status: ExpensePaymentStatus;

  @Column({ nullable: true })
  payer: string;

  @Column({ type: 'date', nullable: true })
  paidDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
