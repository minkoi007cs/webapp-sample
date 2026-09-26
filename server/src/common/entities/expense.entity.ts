import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Asset } from './asset.entity';
import { Category } from './category.entity';

export enum ExpenseEntryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

@Entity('fml_expenses')
@Index(['familyId', 'expenseDate'])
export class Expense extends BaseEntity {
  @Index()
  @Column()
  familyId: string;

  @Column({ nullable: true })
  assetId: string;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'assetId' })
  asset: Asset;

  @Column({ nullable: true })
  categoryId: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ default: 'VND' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ExpenseEntryType,
    default: ExpenseEntryType.EXPENSE,
  })
  entryType: ExpenseEntryType;

  @Column({ type: 'date' })
  expenseDate: Date;

  @Column({ default: false })
  isTransfer: boolean;

  @Column({ default: false })
  reminderEnabled: boolean;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'json', nullable: true })
  customFields: Record<string, unknown>;

  @Column()
  createdBy: string;
}
