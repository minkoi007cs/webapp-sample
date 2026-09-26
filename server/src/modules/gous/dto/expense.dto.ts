import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { ExpenseCategory, ExpensePaymentStatus } from '../../../common/enums/gous.enums';

export class CreateGoUsExpenseDto {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  estimatedAmount?: number;

  @IsOptional()
  @IsNumber()
  actualAmount?: number;

  @IsOptional()
  @IsEnum(ExpensePaymentStatus)
  status?: ExpensePaymentStatus;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  payer?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateGoUsExpenseDto extends PartialType(CreateGoUsExpenseDto) {}
