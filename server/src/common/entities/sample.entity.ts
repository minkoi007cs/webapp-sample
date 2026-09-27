import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Group } from './group.entity';
import { Category } from './category.entity';

export enum SampleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

@Entity('sm_samples')
export class Sample extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ length: 100, nullable: true })
  code?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 100, nullable: true })
  type?: string;

  @Column({
    type: 'enum',
    enum: SampleStatus,
    default: SampleStatus.ACTIVE,
  })
  status: SampleStatus;

  @Column({ type: 'uuid', nullable: true })
  categoryId?: string;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  @Column({ type: 'uuid' })
  groupId: string;

  get familyId(): string {
    return this.groupId;
  }
  set familyId(val: string) {
    this.groupId = val;
  }

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  imageUrl?: string;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId?: string;

  // Compatibility computed property
  get currentValue(): number {
    return 0;
  }
}

// Alias for compatibility
export { Sample as Asset, SampleStatus as AssetStatus };
