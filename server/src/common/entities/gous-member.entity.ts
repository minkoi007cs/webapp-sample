import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { GoUsCase } from './gous-case.entity';
import { MemberRoleInCase, ProcessStatus } from '../enums/gous.enums';

export { MemberRoleInCase, ProcessStatus };

@Entity('gous_members')
export class GoUsMember extends BaseEntity {
  @Column()
  caseId: string;

  @ManyToOne(() => GoUsCase, (gCase) => gCase.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case: GoUsCase;

  @Column()
  fullName: string;

  @Column({
    type: 'enum',
    enum: MemberRoleInCase,
    default: MemberRoleInCase.CHILD,
  })
  roleInCase: MemberRoleInCase;

  @Column({ type: 'date', nullable: true })
  dob: string; // Ngày sinh YYYY-MM-DD

  @Column({ nullable: true })
  gender: string; // Nam / Nữ

  @Column({ nullable: true })
  passportNumber: string;

  @Column({ type: 'date', nullable: true })
  passportExpiry: string; // Hạn hộ chiếu

  @Column({ nullable: true })
  ds260ConfirmationNumber: string; // Mã xác nhận đơn DS-260 (AA00xxxxxx)

  @Column({
    type: 'enum',
    enum: ProcessStatus,
    default: ProcessStatus.NOT_STARTED,
  })
  ds260Status: ProcessStatus;

  @Column({
    type: 'enum',
    enum: ProcessStatus,
    default: ProcessStatus.NOT_STARTED,
  })
  policeCertStatus: ProcessStatus; // Lý lịch tư pháp số 2

  @Column({ type: 'date', nullable: true })
  policeCertIssueDate: string; // Ngày cấp LLTP số 2

  @Column({
    type: 'enum',
    enum: ProcessStatus,
    default: ProcessStatus.NOT_STARTED,
  })
  medicalStatus: ProcessStatus; // Khám sức khỏe & Tiêm chủng

  @Column({
    type: 'enum',
    enum: ProcessStatus,
    default: ProcessStatus.NOT_STARTED,
  })
  visaStatus: ProcessStatus; // Visa Mỹ

  @Column({ type: 'boolean', default: false })
  uscisFeePaid: boolean; // Đã đóng phí thẻ xanh $220 sau phỏng vấn

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  cspaAge: number; // Tuổi CSPA đã tính toán

  @Column({ nullable: true })
  cspaStatus: string; // 'SAFE' | 'WARNING' | 'AGED_OUT' | 'NOT_APPLICABLE'

  @Column({ type: 'text', nullable: true })
  notes: string;
}
