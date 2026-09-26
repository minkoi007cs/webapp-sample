import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Family } from './family.entity';
import { User } from './user.entity';

export enum DocumentStatus {
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

@Entity('fml_documents')
export class Document extends BaseEntity {
  @Column()
  @Index()
  familyId: string;

  @ManyToOne(() => Family, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'familyId' })
  family: Family;

  @Column({ nullable: true })
  uploadedByUserId?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploadedByUserId' })
  uploadedByUser?: User;

  @Column()
  title: string;

  @Column({ nullable: true })
  originalFileName: string;

  @Column()
  fileUrl: string;

  @Column({ nullable: true })
  thumbnailUrl?: string;

  @Column({ default: 'application/octet-stream' })
  mimeType: string;

  @Column({ type: 'bigint', default: 0 })
  fileSize: number;

  @Column({ default: 'Khác' })
  @Index()
  category: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({ type: 'text', nullable: true })
  extractedContent?: string;

  @Column({ type: 'jsonb', nullable: true })
  structuredData?: Record<string, any>;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.READY,
  })
  status: DocumentStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'text', nullable: true })
  userNote?: string;
}
