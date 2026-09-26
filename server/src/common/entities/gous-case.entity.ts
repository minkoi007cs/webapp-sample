import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Family } from './family.entity';
import { GoUsMember } from './gous-member.entity';
import { GoUsDocument } from './gous-document.entity';
import { GoUsTask } from './gous-task.entity';
import { GoUsExpense } from './gous-expense.entity';
import { GoUsStage } from '../enums/gous.enums';

export { GoUsStage };

@Entity('gous_cases')
export class GoUsCase extends BaseEntity {
  @Index({ unique: true })
  @Column()
  familyId: string;

  @ManyToOne(() => Family, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'familyId' })
  family: Family;

  @Column({ default: 'F4 - Anh/Chị/Em công dân Mỹ' })
  visaCategory: string;

  @Column({ nullable: true })
  caseNumber: string; // HCMxxxxxxxxxx

  @Column({ nullable: true })
  invoiceId: string;

  @Column({ type: 'date', nullable: true })
  priorityDate: string; // Ngày ưu tiên (PD)

  @Column({ type: 'date', nullable: true })
  approvalDate: string; // Ngày chấp thuận I-797

  @Column({
    type: 'enum',
    enum: GoUsStage,
    default: GoUsStage.NVC_CASE_CREATION,
  })
  currentStage: GoUsStage;

  @Column({ nullable: true })
  receiptNumber: string; // Mã số biên nhận Sở Di Trú USCIS (WAC/EAC/LIN/IOE...)

  @Column({ nullable: true })
  petitionerName: string; // Tên người bảo lãnh tại Mỹ

  @Column({ nullable: true })
  petitionerRelationship: string; // Quan hệ với đương đơn chính (Anh/chị/em, Cha/mẹ, Vợ/chồng...)

  @Column({ nullable: true })
  petitionerAddress: string;

  @Column({ nullable: true })
  petitionerPhone: string;

  @Column({ nullable: true })
  petitionerEmail: string;

  @Column({ nullable: true })
  principalApplicantName: string; // Tên đương đơn chính (Chủ hộ)

  @Column({ type: 'text', nullable: true })
  jointSponsorInfo: string; // Người đồng bảo trợ nếu có

  @Column({ type: 'timestamp', nullable: true })
  interviewDate: Date; // Ngày & giờ phỏng vấn tại LSQ

  @Column({ nullable: true, default: 'Tổng Lãnh sự quán Hoa Kỳ tại TP.HCM (4 Lê Duẩn, Q.1)' })
  interviewLocation: string; // Địa điểm phỏng vấn

  @Column({ type: 'date', nullable: true })
  medicalExamDate: string; // Ngày khám sức khỏe

  @Column({ type: 'date', nullable: true })
  vaccinationDate: string; // Ngày tiêm chủng

  @Column({ type: 'date', nullable: true })
  intendedDepartureDate: string; // Ngày dự kiến bay

  @Column({ nullable: true })
  portOfEntry: string; // Cảng nhập cảnh dự kiến tại Mỹ (SFO, LAX, JFK...)

  @Column({ nullable: true })
  destinationAddress: string; // Địa chỉ cư trú tại Mỹ (Nhận Thẻ Xanh & SSN)

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => GoUsMember, (member) => member.case, { cascade: true })
  members: GoUsMember[];

  @OneToMany(() => GoUsDocument, (doc) => doc.case, { cascade: true })
  documents: GoUsDocument[];

  @OneToMany(() => GoUsTask, (task) => task.case, { cascade: true })
  tasks: GoUsTask[];

  @OneToMany(() => GoUsExpense, (expense) => expense.case, { cascade: true })
  expenses: GoUsExpense[];
}
