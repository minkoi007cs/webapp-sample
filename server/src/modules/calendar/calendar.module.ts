import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from '../../common/entities/calendar-event.entity';
import { Asset } from '../../common/entities/asset.entity';
import { AssetMaintenance } from '../../common/entities/asset-maintenance.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { CalendarScheduler } from './calendar.scheduler';
import { NotificationModule } from '../notification/notification.module';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarEvent, Asset, AssetMaintenance]),
    NotificationModule,
    PermissionModule,
  ],
  controllers: [CalendarController],
  providers: [CalendarService, CalendarScheduler],
  exports: [CalendarService],
})
export class CalendarModule {}
