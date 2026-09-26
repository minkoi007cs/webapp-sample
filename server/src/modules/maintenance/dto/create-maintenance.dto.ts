import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { MaintenanceFrequencyType } from '../maintenance.types';
import { AssetMaintenanceType } from '../../../common/entities/asset-maintenance.entity';

export class CreateMaintenanceDto {
  @IsUUID()
  assetId: string;

  @IsDateString()
  startDate: string;

  @IsEnum(AssetMaintenanceType)
  type: AssetMaintenanceType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(MaintenanceFrequencyType)
  frequencyType?: MaintenanceFrequencyType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  frequencyValue?: number;

  /** Khi có frequencyType: dùng để sinh số bản ghi (1–48), không lưu DB */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  repeatCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  reminderDaysBefore?: number;
}
