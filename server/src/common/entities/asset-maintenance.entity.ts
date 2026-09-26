import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Asset } from './asset.entity';

export enum MaintenanceStatus {
  OPEN = 'open',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

export enum AssetMaintenanceType {
  MAINTENANCE = 'maintenance',
  OPERATION = 'operation',
  LIABILITY = 'liability',
}

@Entity('fml_asset_maintenances')
@Index(['familyId', 'scheduledDate'])
@Index(['familyId', 'assetId'])
export class AssetMaintenance extends BaseEntity {
  @Column()
  familyId: string;

  @Column()
  createdBy: string;

  @Column()
  assetId: string;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'assetId' })
  asset: Asset;

  @Column({ type: 'date' })
  scheduledDate: string;

  @Column({
    type: 'enum',
    enum: AssetMaintenanceType,
    default: AssetMaintenanceType.MAINTENANCE,
  })
  type: AssetMaintenanceType;

  @Column({
    type: 'enum',
    enum: MaintenanceStatus,
    default: MaintenanceStatus.OPEN,
  })
  status: MaintenanceStatus;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  cost: number | null;

  @Column({ type: 'uuid', nullable: true })
  expenseId: string | null;

  @Column({ type: 'uuid', nullable: true })
  calendarEventId: string | null;

  @Column({ type: 'int', nullable: true })
  reminderDaysBefore: number | null;
}
