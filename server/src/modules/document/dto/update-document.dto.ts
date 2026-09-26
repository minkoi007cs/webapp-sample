import { IsOptional, IsString, IsArray, IsObject } from 'class-validator';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  extractedContent?: string;

  @IsOptional()
  @IsObject()
  structuredData?: Record<string, any>;

  @IsOptional()
  @IsString()
  userNote?: string;
}
