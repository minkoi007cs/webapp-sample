import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { GoUsCase } from './gous-case.entity';
import { GoUsMember } from './gous-member.entity';
import { DocumentCategory, DocumentStatus } from '../enums/gous.enums';

export { DocumentCategory, DocumentStatus };

@Entity('gous_documents')
export class GoUsDocument extends BaseEntity {
  @Column()
  caseId: string;

  @ManyToOne(() => GoUsCase, (gCase) => gCase.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case: GoUsCase;

  @Column({ nullable: true })
  memberId: string; // Nếu giấy tờ thuộc 1 thành viên cụ thể

  @ManyToOne(() => GoUsMember, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'memberId' })
  member: GoUsMember;

  @Column({
    type: 'enum',
    enum: DocumentCategory,
    default: DocumentCategory.CIVIL_IDENTITY,
  })
  category: DocumentCategory;

  @Column()
  title: string; // Tên giấy tờ

  @Column({ type: 'text', nullable: true })
  description: string; // Hướng dẫn chi tiết / Yêu cầu quy cách

  @Column({ type: 'boolean', default: true })
  isRequired: boolean; // Bắt buộc hay Tự chọn

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.NOT_PREPARED,
  })
  status: DocumentStatus;

  @Column({ type: 'date', nullable: true })
  issueDate: string; // Ngày cấp

  @Column({ type: 'date', nullable: true })
  expiryDate: string; // Ngày hết hạn

  @Column({ nullable: true })
  fileUrl?: string; // Link file đính kèm chính / đầu tiên nếu có

  @Column({ type: 'json', nullable: true })
  fileUrls?: string[]; // Danh sách các file đính kèm (hỗ trợ nhiều hình / file)

  @Column({ type: 'text', nullable: true })
  expertNotes: string; // Lưu ý quan trọng từ luật sư / chuyên viên
}
