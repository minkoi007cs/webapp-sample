import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { GoUsCase } from './gous-case.entity';
import { ExpenseCategory, ExpensePaymentStatus } from '../enums/gous.enums';

export { ExpenseCategory, ExpensePaymentStatus };

@Entity('gous_expenses')
export class GoUsExpense extends BaseEntity {
  @Column()
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
  currency: string; // 'USD' hoặc 'VND'

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  estimatedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  actualAmount: number;

  @Column({
    type: 'enum',
    enum: ExpensePaymentStatus,
    default: ExpensePaymentStatus.ESTIMATED,
  })
  status: ExpensePaymentStatus;

  @Column({ type: 'date', nullable: true })
  paymentDate: string;

  @Column({ nullable: true })
  payer: string; // Người chi trả (vd: 'Người bảo lãnh tại Mỹ' | 'Gia đình Việt Nam')

  @Column({ type: 'text', nullable: true })
  notes: string;
}
