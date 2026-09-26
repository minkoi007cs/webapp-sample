import { Type } from 'class-transformer';
import { IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CompleteMaintenanceDto {
  @IsString()
  content: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost: number;

  @IsUUID()
  categoryId: string;
}
