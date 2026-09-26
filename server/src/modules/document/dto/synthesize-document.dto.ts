import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';

export class SynthesizeDocumentDto {
  @IsNotEmpty({ message: 'Vui lòng nhập chủ đề hoặc câu hỏi cần tổng hợp' })
  @IsString()
  query: string;

  @IsOptional()
  @IsArray()
  documentIds?: string[];
}
