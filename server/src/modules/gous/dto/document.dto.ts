import { PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { DocumentCategory, DocumentStatus } from '../../../common/enums/gous.enums';

export class CreateDocumentDto {
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileUrls?: string[];

  @IsOptional()
  @IsString()
  expertNotes?: string;
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}
