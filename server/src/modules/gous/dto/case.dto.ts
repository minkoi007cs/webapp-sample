import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, ValidateIf } from 'class-validator';
import { GoUsStage } from '../../../common/enums/gous.enums';

export class CreateGoUsCaseDto {
  @IsOptional()
  @IsString()
  visaCategory?: string;

  @IsOptional()
  @IsString()
  caseNumber?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  priorityDate?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  approvalDate?: string;

  @IsOptional()
  @IsEnum(GoUsStage)
  currentStage?: GoUsStage;

  @IsOptional()
  @IsString()
  receiptNumber?: string;

  @IsOptional()
  @IsString()
  petitionerName?: string;

  @IsOptional()
  @IsString()
  petitionerRelationship?: string;

  @IsOptional()
  @IsString()
  petitionerAddress?: string;

  @IsOptional()
  @IsString()
  petitionerPhone?: string;

  @IsOptional()
  @IsString()
  petitionerEmail?: string;

  @IsOptional()
  @IsString()
  principalApplicantName?: string;

  @IsOptional()
  @IsString()
  jointSponsorInfo?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  interviewDate?: string;

  @IsOptional()
  @IsString()
  interviewLocation?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  medicalExamDate?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  vaccinationDate?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  intendedDepartureDate?: string;

  @IsOptional()
  @IsString()
  portOfEntry?: string;

  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateGoUsCaseDto extends PartialType(CreateGoUsCaseDto) {}
