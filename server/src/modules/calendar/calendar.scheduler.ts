import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { CalendarEvent, CalendarEventType } from '../../common/entities/calendar-event.entity';
import { Asset } from '../../common/entities/asset.entity';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class CalendarScheduler {
  private readonly logger = new Logger(CalendarScheduler.name);

  constructor(
    @InjectRepository(CalendarEvent)
    private eventRepository: Repository<CalendarEvent>,
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    private notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleEventReminders() {
    this.logger.log('Checking for upcoming calendar event reminders...');
    
    const now = new Date();
    const checkWindow = new Date();
    checkWindow.setHours(now.getHours() + 1); // Check events in the next hour

    const upcomingEvents = await this.eventRepository.find({
      where: {
        startDate: LessThanOrEqual(checkWindow),
        // Simplification: We would need a way to track if a reminder was already sent
      },
    });

    for (const event of upcomingEvents) {
      // In a real app, we'd check if (event.startDate - now) <= event.reminderMinutes
      // and ensure we only send ONE notification.
      this.logger.log(`Reminder for event: ${event.title}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async handleDailyMaintenanceCheck() {
    this.logger.log('Checking for scheduled asset maintenance...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const next3Days = new Date(today);
    next3Days.setDate(today.getDate() + 3);

    const assetsToMaintain = await this.assetRepository.find({
      where: {
        nextMaintenanceDate: LessThanOrEqual(next3Days),
      },
    });

    for (const asset of assetsToMaintain) {
      await this.notificationService.create(
        asset.familyId,
        asset.assignedToUserId || asset.createdBy,
        'Nhắc nhở bảo trì',
        `Tài sản "${asset.name}" cần được bảo trì vào ngày ${asset.nextMaintenanceDate.toLocaleDateString()}`,
        { assetId: asset.id, type: 'MAINTENANCE' }
      );
    }
  }
}
