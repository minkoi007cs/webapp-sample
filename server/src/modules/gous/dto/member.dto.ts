import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { MemberRoleInCase, ProcessStatus } from '../../../common/enums/gous.enums';

export class CreateMemberDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsOptional()
  @IsEnum(MemberRoleInCase)
  roleInCase?: MemberRoleInCase;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  passportNumber?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  passportExpiry?: string;

  @IsOptional()
  @IsString()
  ds260ConfirmationNumber?: string;

  @IsOptional()
  @IsEnum(ProcessStatus)
  ds260Status?: ProcessStatus;

  @IsOptional()
  @IsEnum(ProcessStatus)
  policeCertStatus?: ProcessStatus;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  policeCertIssueDate?: string;

  @IsOptional()
  @IsEnum(ProcessStatus)
  medicalStatus?: ProcessStatus;

  @IsOptional()
  @IsEnum(ProcessStatus)
  visaStatus?: ProcessStatus;

  @IsOptional()
  @IsBoolean()
  uscisFeePaid?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMemberDto extends PartialType(CreateMemberDto) {}
