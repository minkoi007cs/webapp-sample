import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Asset } from '../../common/entities/asset.entity';
import { Expense } from '../../common/entities/expense.entity';
import { CalendarEvent } from '../../common/entities/calendar-event.entity';
import { PermissionModule } from '../permission/permission.module';
import { AssetModule } from '../asset/asset.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, Expense, CalendarEvent]),
    PermissionModule,
    AssetModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
