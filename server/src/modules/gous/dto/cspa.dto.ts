import { IsDateString, IsNotEmpty, IsOptional } from 'class-validator';

export class CalculateCspaDto {
  @IsNotEmpty()
  @IsDateString()
  dob: string; // Ngày sinh con

  @IsNotEmpty()
  @IsDateString()
  priorityDate: string; // Ngày ưu tiên (PD)

  @IsNotEmpty()
  @IsDateString()
  approvalDate: string; // Ngày chấp thuận đơn I-130 (Approval Date)

  @IsOptional()
  @IsDateString()
  visaAvailableDate?: string; // Ngày visa đáo hạn (hoặc ngày phỏng vấn/hiện tại)
}

export interface CspaResult {
  actualAgeAtVisaAvailability: number;
  i130PendingDays: number;
  i130PendingYears: number;
  cspaAge: number;
  cspaStatus: 'SAFE' | 'WARNING' | 'AGED_OUT';
  message: string;
  recommendations: string[];
}
