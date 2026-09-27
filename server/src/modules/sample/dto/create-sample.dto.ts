import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SampleStatus } from '../../../common/entities/sample.entity';

export class CreateSampleDto {
  @IsNotEmpty({ message: 'Tên mẫu không được để trống' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  status?: SampleStatus;

  @IsOptional()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  metadata?: Record<string, any>;
}
