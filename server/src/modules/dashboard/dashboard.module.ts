import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Sample } from '../../common/entities/sample.entity';
import { CalendarEvent } from '../../common/entities/calendar-event.entity';
import { Document } from '../../common/entities/document.entity';
import { GroupUser } from '../../common/entities/group-user.entity';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sample, CalendarEvent, Document, GroupUser]),
    PermissionModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
