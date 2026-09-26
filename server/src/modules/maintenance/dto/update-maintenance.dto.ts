import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AssetMaintenanceType, MaintenanceStatus } from '../../../common/entities/asset-maintenance.entity';

export class UpdateMaintenanceDto {
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsEnum(AssetMaintenanceType)
  type?: AssetMaintenanceType;

  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  reminderDaysBefore?: number | null;
}
