import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Group } from './group.entity';
import { GoUsMember } from './gous-member.entity';
import { GoUsDocument } from './gous-document.entity';
import { GoUsTask } from './gous-task.entity';
import { GoUsExpense } from './gous-expense.entity';
import { GoUsStage } from '../enums/gous.enums';

export { GoUsStage };

@Entity('sm_gous_cases')
export class GoUsCase extends BaseEntity {
  @Index({ unique: true })
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

  get family(): Group {
    return this.group;
  }

  @Column({ default: 'F4 - Anh/Chị/Em công dân Mỹ' })
  visaCategory: string;

  @Column({ nullable: true })
  caseNumber: string;

  @Column({ nullable: true })
  invoiceId: string;

  @Column({ type: 'date', nullable: true })
  priorityDate: string;

  @Column({ type: 'date', nullable: true })
  approvalDate: string;

  @Column({
    type: 'enum',
    enum: GoUsStage,
    default: GoUsStage.NVC_CASE_CREATION,
  })
  currentStage: GoUsStage;

  @Column({ nullable: true })
  receiptNumber: string;

  @Column({ nullable: true })
  petitionerName: string;

  @Column({ nullable: true })
  petitionerRelationship: string;

  @Column({ nullable: true })
  petitionerAddress: string;

  @Column({ nullable: true })
  petitionerPhone: string;

  @Column({ nullable: true })
  petitionerEmail: string;

  @Column({ nullable: true })
  principalApplicantName: string;

  @Column({ type: 'text', nullable: true })
  jointSponsorInfo: string;

  @Column({ type: 'timestamp', nullable: true })
  interviewDate: Date;

  @Column({ nullable: true, default: 'Tổng Lãnh sự quán Hoa Kỳ tại TP.HCM (4 Lê Duẩn, Q.1)' })
  interviewLocation: string;

  @Column({ type: 'date', nullable: true })
  medicalExamDate: string;

  @Column({ type: 'date', nullable: true })
  vaccinationDate: string;

  @Column({ type: 'date', nullable: true })
  intendedDepartureDate: string;

  @Column({ nullable: true })
  portOfEntry: string;

  @Column({ nullable: true })
  destinationAddress: string;

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
