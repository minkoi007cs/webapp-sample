import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetMaintenance } from '../../common/entities/asset-maintenance.entity';
import { Asset } from '../../common/entities/asset.entity';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { PermissionModule } from '../permission/permission.module';
import { CalendarModule } from '../calendar/calendar.module';
import { ExpenseModule } from '../expense/expense.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssetMaintenance, Asset]),
    PermissionModule,
    CalendarModule,
    ExpenseModule,
  ],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
